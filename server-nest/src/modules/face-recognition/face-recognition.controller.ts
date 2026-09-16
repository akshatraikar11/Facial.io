import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FaceRecognitionService } from './face-recognition.service.js';
import { MatchFaceDto } from './dto/match-face.dto.js';
import { EnrollFaceDto } from './dto/enroll-face.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';

/**
 * FaceRecognitionController — server-side face matching API.
 *
 * Base route: /api/face-recognition
 *
 * Routes:
 *
 *   POST   /api/face-recognition/match
 *     @Public() — kiosk sends descriptor, gets back employee match
 *     Body: { orgId, descriptor[], threshold? }
 *     Returns: { matched, employeeId, name, confidence, message }
 *
 *   POST   /api/face-recognition/enroll
 *     Protected — admin re-enrolls an employee's face
 *     Body: { employeeId, descriptor[] }
 *     Returns: { success, pineconeId }
 *
 *   DELETE /api/face-recognition/vector/:employeeId
 *     Protected — removes a single employee's vector (called on hard-delete)
 *     Returns: 204 No Content
 *
 *   POST   /api/face-recognition/bulk-enroll
 *     Protected — upserts all existing employees' vectors into Pinecone
 *     Returns: { enrolled: number }
 *
 *   GET    /api/face-recognition/health
 *     @Public() — returns Pinecone connection status
 *
 * The match → check-in flow:
 *   1. Kiosk: POST /api/face-recognition/match → gets { employeeId, name, confidence }
 *   2. Kiosk: POST /api/attendance/check-in → logs the attendance
 *   Both calls happen client-side in sequence. In a future hardening phase,
 *   step 1 would return a short-lived signed token that step 2 validates —
 *   preventing fake check-ins without a real face match.
 */
@ApiTags('face-recognition')
@Controller('face-recognition')
export class FaceRecognitionController {
  constructor(
    private readonly faceRecognitionService: FaceRecognitionService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * POST /api/face-recognition/match
   * The kiosk's primary endpoint. Sends a face descriptor, gets back a match.
   * @Public() — the kiosk has no authenticated user.
   * @Throttle() — 30 requests per 60s (higher than global default for kiosk usage)
   */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('match')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Match a face descriptor against the org\'s enrolled faces',
  })
  @ApiResponse({
    status: 200,
    description: 'Match result — matched: true/false with employee info',
  })
  @ApiResponse({ status: 503, description: 'Pinecone not configured' })
  async match(@Body() dto: MatchFaceDto) {
    return this.faceRecognitionService.matchFace(
      dto.orgId,
      dto.descriptor,
      dto.threshold,
    );
  }

  /**
   * POST /api/face-recognition/enroll
   * Enroll or re-enroll an employee's face vector in Pinecone.
   * Protected — only org admins can do this.
   */
  @Post('enroll')
  @ApiBearerAuth('clerk-jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enroll or re-enroll an employee face vector in Pinecone',
  })
  @ApiResponse({ status: 200, description: 'Face enrolled successfully' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 503, description: 'Pinecone not configured' })
  async enroll(@OrgId() orgId: string, @Body() dto: EnrollFaceDto) {
    // Verify employee exists in this org first
    const employee = await this.employeesService.findOne(orgId, dto.employeeId);

    await this.faceRecognitionService.upsertVector(
      orgId,
      dto.employeeId,
      employee.name,
      dto.descriptor,
    );

    const pineconeId = `${orgId}#${dto.employeeId}`;
    return { success: true, pineconeId };
  }

  /**
   * POST /api/face-recognition/bulk-enroll
   * Upserts ALL active employees' face vectors into Pinecone.
   * Useful when first connecting Pinecone to an org that already has employees.
   */
  @Post('bulk-enroll')
  @ApiBearerAuth('clerk-jwt')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk enroll all active employees into Pinecone',
  })
  @ApiResponse({ status: 200, description: 'Bulk enrollment result' })
  async bulkEnroll(@OrgId() orgId: string) {
    return this.faceRecognitionService.bulkEnroll(orgId);
  }

  /**
   * DELETE /api/face-recognition/vector/:employeeId
   * Remove a single employee's vector from Pinecone.
   * Called from the hard-delete employee flow (GDPR erasure).
   * Returns 204 No Content.
   */
  @Delete('vector/:employeeId')
  @ApiBearerAuth('clerk-jwt')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an employee's face vector from Pinecone" })
  @ApiParam({ name: 'employeeId', description: 'MongoDB employee ID' })
  @ApiResponse({ status: 204, description: 'Vector deleted' })
  async deleteVector(
    @OrgId() orgId: string,
    @Param('employeeId') employeeId: string,
  ) {
    await this.faceRecognitionService.deleteVector(orgId, employeeId);
  }

  /**
   * GET /api/face-recognition/health
   * Returns Pinecone connection status.
   * @Public() — used by monitoring and the admin settings page.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check Pinecone connection status' })
  health() {
    return {
      pinecone: this.faceRecognitionService.ready
        ? 'connected'
        : 'not configured',
    };
  }
}
