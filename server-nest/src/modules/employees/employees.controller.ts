import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * EmployeesController — REST API for employee management.
 *
 * Base route: /api/employees
 *
 * All routes are protected by ClerkAuthGuard (global via APP_GUARD).
 * orgId is extracted from the JWT on every request via @OrgId().
 * The controller never reads orgId from the request body.
 *
 * Route summary:
 *   GET    /api/employees              — list all employees in org
 *   GET    /api/employees/count        — count active employees (for plan limits)
 *   GET    /api/employees/:id          — get one employee
 *   POST   /api/employees              — register new employee + face
 *   PATCH  /api/employees/:id          — update employee fields
 *   DELETE /api/employees/:id          — soft delete (deactivate)
 *   DELETE /api/employees/:id/hard     — hard delete (GDPR erasure)
 *
 * @ApiBearerAuth('clerk-jwt') — tells Swagger this endpoint needs the JWT
 * that was configured in main.ts DocumentBuilder.
 */
@ApiTags('employees')
@ApiBearerAuth('clerk-jwt')
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * GET /api/employees
   * List all active employees in the authenticated org.
   * ?withDescriptors=true — includes face descriptor arrays (for client-side matching).
   * Descriptor excluded by default — not needed for display.
   */
  @Get()
  @ApiOperation({ summary: 'List all employees in the organization' })
  @ApiQuery({ name: 'withDescriptors', required: false, type: Boolean, description: 'Include face descriptors' })
  @ApiResponse({ status: 200, description: 'Employee list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @OrgId() orgId: string,
    @Query('withDescriptors') withDescriptors?: string,
  ) {
    if (withDescriptors === 'true') {
      return this.employeesService.findAllWithDescriptors(orgId);
    }
    return this.employeesService.findAll(orgId);
  }

  /**
   * GET /api/employees/count
   * Returns the count of active employees.
   * Used by the dashboard stat card and plan limit checks.
   * Must be defined BEFORE /:id or Express treats 'count' as an ID param.
   */
  @Get('count')
  @ApiOperation({ summary: 'Count active employees in the organization' })
  async count(@OrgId() orgId: string) {
    const total = await this.employeesService.countActive(orgId);
    return { total };
  }

  /**
   * GET /api/employees/:id
   * Get a single employee by MongoDB ID.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single employee by ID' })
  @ApiParam({ name: 'id', description: 'MongoDB employee ID' })
  @ApiResponse({ status: 200, description: 'Employee details' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(@OrgId() orgId: string, @Param('id') id: string) {
    const employee = await this.employeesService.findOne(orgId, id);
    // Never return descriptor in single-employee responses either
    const { descriptor: _d, ...safe } = employee.toObject();
    return safe;
  }

  /**
   * POST /api/employees
   * Register a new employee with their face descriptor.
   * Returns 201 Created on success.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new employee with face descriptor' })
  @ApiResponse({ status: 201, description: 'Employee created' })
  @ApiResponse({ status: 409, description: 'Email already exists in org' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    const employee = await this.employeesService.create(orgId, dto);
    const { descriptor: _d, ...safe } = employee.toObject();
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'employee.created',
      entityType: 'employee',
      entityId: employee._id.toString(),
      after: safe,
    });
    return safe;
  }

  /**
   * PATCH /api/employees/:id
   * Update one or more employee fields.
   * Send only the fields you want to change.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update employee details (PATCH — partial update)' })
  @ApiParam({ name: 'id', description: 'MongoDB employee ID' })
  @ApiResponse({ status: 200, description: 'Employee updated' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async update(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    const before = await this.employeesService.findOne(orgId, id);
    const { descriptor: _db, ...safeBefore } = before.toObject();
    const employee = await this.employeesService.update(orgId, id, dto);
    const { descriptor: _d, ...safe } = employee.toObject();
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'employee.updated',
      entityType: 'employee',
      entityId: id,
      before: safeBefore,
      after: safe,
    });
    return safe;
  }

  /**
   * DELETE /api/employees/:id
   * Soft delete — sets isActive: false.
   * Employee's attendance history is preserved.
   * Returns 204 No Content.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an employee (soft delete)' })
  @ApiParam({ name: 'id', description: 'MongoDB employee ID' })
  @ApiResponse({ status: 204, description: 'Employee deactivated' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async softDelete(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
    @Param('id') id: string,
  ) {
    const before = await this.employeesService.findOne(orgId, id);
    const { descriptor: _d, ...safeBefore } = before.toObject();
    await this.employeesService.softDelete(orgId, id);
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'employee.deactivated',
      entityType: 'employee',
      entityId: id,
      before: safeBefore,
    });
  }

  /**
   * DELETE /api/employees/:id/hard
   * Hard delete — permanently removes the employee record.
   * Use for GDPR erasure requests.
   * Returns 204 No Content.
   */
  @Delete(':id/hard')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Permanently delete an employee (GDPR erasure)',
  })
  @ApiParam({ name: 'id', description: 'MongoDB employee ID' })
  @ApiResponse({ status: 204, description: 'Employee permanently deleted' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async hardDelete(
    @OrgId() orgId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') userEmail: string,
    @Param('id') id: string,
  ) {
    const before = await this.employeesService.findOne(orgId, id);
    const { descriptor: _d, ...safeBefore } = before.toObject();
    await this.employeesService.hardDelete(orgId, id);
    await this.auditService.log({
      orgId, userId, userEmail: userEmail ?? '',
      action: 'employee.deleted',
      entityType: 'employee',
      entityId: id,
      before: safeBefore,
    });
  }
}
