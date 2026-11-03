import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for EmployeesController
 */
describe('EmployeesController', () => {
  let controller: EmployeesController;
  let employeesService: EmployeesService;
  let auditService: AuditService;

  const mockEmployee = {
    _id: '507f1f77bcf86cd799439011',
    orgId: 'org_123',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'employee',
    department: 'Engineering',
    pineconeId: 'emp_507f1f77bcf86cd799439011',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    descriptor: Array.from({ length: 128 }, () => 0.1),
    toObject() {
      const { descriptor, ...rest } = this;
      return rest;
    },
  };

  const mockCreateDto: CreateEmployeeDto = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'employee',
    department: 'Engineering',
    descriptor: Array.from({ length: 128 }, () => 0.1),
  };

  beforeEach(async () => {
    const mockEmployeesService = {
      create: vi.fn().mockResolvedValue(mockEmployee),
      findAll: vi.fn().mockResolvedValue([mockEmployee]),
      findOne: vi.fn().mockResolvedValue(mockEmployee),
      update: vi.fn().mockResolvedValue(mockEmployee),
      softDelete: vi.fn().mockResolvedValue(undefined),
      findAllWithDescriptors: vi.fn().mockResolvedValue([mockEmployee]),
      countActive: vi.fn().mockResolvedValue(1),
    };

    const mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: mockEmployeesService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    controller = module.get<EmployeesController>(EmployeesController);
    employeesService = module.get<EmployeesService>(EmployeesService);
    auditService = module.get<AuditService>(AuditService);
  });

  describe('create', () => {
    it('should create an employee, strip descriptor, and log audit event', async () => {
      const result = await controller.create(
        'org_123',
        'user_123',
        'admin@example.com',
        mockCreateDto,
      );

      expect(employeesService.create).toHaveBeenCalledWith('org_123', mockCreateDto);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org_123',
          action: 'employee.created',
          entityType: 'employee',
        }),
      );
      expect(result).not.toHaveProperty('descriptor');
      expect(result.name).toBe(mockEmployee.name);
      expect(result.email).toBe(mockEmployee.email);
    });
  });

  describe('findAll', () => {
    it('should return all employees for the org', async () => {
      const result = await controller.findAll('org_123', false);

      expect(employeesService.findAll).toHaveBeenCalledWith('org_123');
      expect(result).toEqual([mockEmployee]);
    });

    it('should support withDescriptors=true for biometric matching', async () => {
      await controller.findAll('org_123', 'true');

      expect(employeesService.findAllWithDescriptors).toHaveBeenCalledWith('org_123');
    });
  });

  describe('count', () => {
    it('should return active employee count for plan limits', async () => {
      const result = await controller.count('org_123');

      expect(employeesService.countActive).toHaveBeenCalledWith('org_123');
      expect(result).toEqual({ total: 1 });
    });
  });

  describe('findOne', () => {
    it('should return a single employee by ID without descriptor', async () => {
      const result = await controller.findOne('org_123', mockEmployee._id);

      expect(employeesService.findOne).toHaveBeenCalledWith('org_123', mockEmployee._id);
      expect(result).not.toHaveProperty('descriptor');
      expect(result.name).toBe(mockEmployee.name);
    });

    it('should throw NotFoundException if employee not found', async () => {
      vi.spyOn(employeesService, 'findOne').mockRejectedValueOnce(
        new NotFoundException('Employee not found'),
      );

      await expect(
        controller.findOne('org_123', 'nonexistent_id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update employee details and log audit event', async () => {
      const updateDto: UpdateEmployeeDto = { name: 'Jane Doe', department: 'Product' };

      const result = await controller.update(
        'org_123',
        'user_123',
        'admin@example.com',
        mockEmployee._id,
        updateDto,
      );

      expect(employeesService.update).toHaveBeenCalledWith(
        'org_123',
        mockEmployee._id,
        updateDto,
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'employee.updated',
        }),
      );
      expect(result).not.toHaveProperty('descriptor');
    });
  });

  describe('softDelete', () => {
    it('should deactivate an employee and log audit event', async () => {
      await controller.softDelete(
        'org_123',
        'user_123',
        'admin@example.com',
        mockEmployee._id,
      );

      expect(employeesService.softDelete).toHaveBeenCalledWith('org_123', mockEmployee._id);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'employee.deactivated',
        }),
      );
    });
  });
});
