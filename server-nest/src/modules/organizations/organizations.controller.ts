import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  HttpCode,
  BadRequestException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Webhook, WebhookVerificationError } from 'svix';
import { Request } from 'express';
import { OrganizationsService } from './organizations.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';
import { FaceRecognitionService } from '../face-recognition/face-recognition.service.js';

/**
 * Clerk Webhook Payload shapes — just the fields we need.
 * Clerk sends much more data but we only destructure what matters.
 */
interface ClerkOrganizationCreatedData {
  id: string;        // org_2abc... — this becomes our orgId
  name: string;
  slug: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkOrganizationCreatedData;
}

/**
 * OrganizationsController — handles two concerns:
 *
 * 1. Clerk webhook endpoint (POST /api/organizations/webhook)
 *    — Receives Clerk events when orgs are created/deleted/updated.
 *    — Verifies the webhook signature using svix (Clerk's delivery library).
 *    — On 'organization.created': creates the org record in MongoDB.
 *    — @Public() because Clerk sends this, not an authenticated user.
 *
 * 2. Current org info endpoint (GET /api/organizations/me)
 *    — Returns the authenticated org's details (plan, name, etc.)
 *    — Protected — requires Clerk JWT.
 *
 * Why we verify the webhook signature:
 *   Anyone can POST to a webhook URL. Signature verification proves
 *   the request actually came from Clerk, not a random attacker.
 *   svix uses HMAC-SHA256 with our CLERK_WEBHOOK_SECRET.
 *
 * Interview answer:
 * "The Clerk webhook fires when an org is created in the Clerk dashboard.
 *  We verify the svix signature header to prove authenticity, then create
 *  the organization record in MongoDB. This is the moment a tenant comes
 *  into existence in our system."
 */
@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  private readonly logger = new Logger(OrganizationsController.name);

  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly faceRecognitionService: FaceRecognitionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * POST /api/organizations/webhook
   *
   * Receives Clerk webhook events.
   * @Public() — bypasses ClerkAuthGuard (Clerk is not a logged-in user)
   * @HttpCode(200) — Clerk expects 200, not 201
   *
   * The raw body is needed for svix signature verification.
   * NestJS gives us access to the raw buffer via RawBodyRequest.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clerk webhook receiver — org lifecycle events' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleClerkWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ received: boolean }> {
    const webhookSecret = this.config.get<string>('clerk.webhookSecret');

    if (!webhookSecret) {
      this.logger.error('CLERK_WEBHOOK_SECRET is not configured');
      throw new BadRequestException('Webhook not configured');
    }

    // ── Verify signature ─────────────────────────────────────────────────
    const wh = new Webhook(webhookSecret);
    let event: ClerkWebhookEvent;

    const body = req.rawBody ?? Buffer.from(JSON.stringify(req.body));

    // Wrap svix verify() — invalid signature throws WebhookVerificationError,
    // not an HttpException, so without this the global filter returns 500.
    try {
      event = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Clerk webhook received: ${event.type}`);

    // ── Handle events ────────────────────────────────────────────────────
    switch (event.type) {
      case 'organization.created':
        await this.organizationsService.create({
          orgId: event.data.id,
          name: event.data.name,
        });
        break;

      case 'organization.deleted':
        // Clean up all org data from Pinecone when org is removed from Clerk
        this.logger.warn(`Org deleted from Clerk: ${event.data.id}`);
        try {
          await this.faceRecognitionService.deleteAllVectorsForOrg(event.data.id);
        } catch (err) {
          this.logger.error(`Failed to delete Pinecone vectors for org ${event.data.id}`, err);
        }
        break;

      default:
        // Ignore other event types (user.created, session.created, etc.)
        break;
    }

    return { received: true };
  }

  /**
   * GET /api/organizations/me
   *
   * Returns the current org's details.
   * orgId extracted from the verified Clerk JWT via @OrgId() decorator.
   */
  @Get('me')
  @ApiOperation({ summary: "Get the authenticated user's organization details" })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyOrg(@OrgId() orgId: string) {
    if (!orgId) {
      throw new UnauthorizedException('No organization context in token');
    }

    const org = await this.organizationsService.findByOrgId(orgId);

    if (!org) {
      throw new UnauthorizedException('Organization not found');
    }

    // Return only safe fields — no internal IDs exposed
    return {
      orgId: org.orgId,
      name: org.name,
      plan: org.plan,
      createdAt: (org as unknown as { createdAt: Date }).createdAt,
    };
  }
}
