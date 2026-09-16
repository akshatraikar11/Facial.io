import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service.js';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * BillingController — Stripe subscription endpoints.
 *
 * Routes:
 *   GET  /api/billing/plans         — public pricing page data
 *   POST /api/billing/checkout      — create Stripe Checkout session
 *   POST /api/billing/portal        — create Stripe Customer Portal session
 *   POST /api/billing/webhook       — Stripe webhook receiver (@Public)
 */
@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly config: ConfigService,
  ) {}

  /** GET /api/billing/plans — returns plan definitions for the pricing page. @Public */
  @Public()
  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  getPlans() {
    return this.billingService.getPlans();
  }

  /**
   * POST /api/billing/checkout
   * Creates a Stripe Checkout Session. Returns the Stripe-hosted payment URL.
   * Frontend redirects to this URL — no custom payment UI needed.
   */
  @Post('checkout')
  @ApiBearerAuth('clerk-jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Checkout session for plan upgrade' })
  @ApiResponse({ status: 200, description: '{ url: string }' })
  async createCheckout(
    @OrgId() orgId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    const clientUrl =
      this.config.get<string>('app.clientUrl') ?? 'http://localhost:5173';
    return this.billingService.createCheckout(orgId, dto.plan, clientUrl);
  }

  /**
   * POST /api/billing/portal
   * Creates a Stripe Customer Portal session.
   * Returns the portal URL — frontend redirects to it.
   */
  @Post('portal')
  @ApiBearerAuth('clerk-jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a Stripe Customer Portal session' })
  @ApiResponse({ status: 200, description: '{ url: string }' })
  async createPortal(@OrgId() orgId: string) {
    const clientUrl =
      this.config.get<string>('app.clientUrl') ?? 'http://localhost:5173';
    return this.billingService.createPortal(orgId, clientUrl);
  }

  /**
   * POST /api/billing/webhook
   * Stripe sends all subscription events here.
   * @Public() — Stripe is not an authenticated user.
   * Uses raw body for HMAC signature verification.
   */
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    await this.billingService.handleWebhook(rawBody, signature);
    return { received: true };
  }
}
