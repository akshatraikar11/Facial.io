import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmployeesService, IFaceRecognitionService } from './employees.service.js';
import { Employee, EmployeeDocument } from './employees.schema.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for EmployeesService
 *
 * Tests cover:
 * - Creating employees with face descriptors
 * - Finding employees by ID and orgId
 * - Updating employee details
 * - Deactivating employees
 * - Face descriptor enrollment integration
 * - Error handling for not found / validation failures
 */
describe('EmployeesService', () => {
  let service: EmployeesService;
  let model: Model<EmployeeDocument>;
  let faceRecognitionService: IFaceRecognitionService;

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
  };

  const mockCreateDto: CreateEmployeeDto = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'employee',
    department: 'Engineering',
    descriptor: new Array(128).fill(0.1),
  };

  beforeEach(async () => {
    // Mock mongoose model methods
    const mockModelMethods = {
      create: vi.fn(),
      findOne: vi.fn(),
      findById: vi.fn(),
      find: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      countDocuments: vi.fn(),
      exec: vi.fn(),
    };

    // Mock face recognition service
    const mockFaceRecognitionService = {
      upsertFaceVector: vi.fn().mockResolvedValue({
        success: true,
        pineconeId: 'emp_507f1f77bcf86cd799439011',
      }),
      deleteFaceVector: vi.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getModelToken(Employee.name),
          useValue: mockModelMethods,
        },
        {
          provide: 'IFaceRecognitionService',
          useValue: mockFaceRecognitionService,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    model = module.get<Model<EmployeeDocument>>(getModelToken(Employee.name));
    faceRecognitionService = module.get<IFaceRecognitionService>('IFaceRecognitionService');
  });

  describe('create', () => {
    it('should create an employee with face descriptor', async () => {
      const createdEmployee = { ...mockEmployee, save: vi.fn() };
      vi.spyOn(model, 'create').mockResolvedValueOnce(createdEmployee as any);

      const result = await service.create('org_123', mockCreateDto);

      expect(model.create).toHaveBeenCalledWith({
        orgId: 'org_123',
        name: mockCreateDto.name,
        email: mockCreateDto.email.toLowerCase(),
        role: mockCreateDto.role,
        department: mockCreateDto.department,
        pineconeId: expect.any(String),
        isActive: true,
      });

      expect(faceRecognitionService.upsertFaceVector).toHaveBeenCalledWith(
        'org_123',
        expect.any(String),
        mockCreateDto.descriptor,
        { name: mockCreateDto.name, email: mockCreateDto.email.toLowerCase() },
      );

      expect(result).toEqual(createdEmployee);
    });

    it('should normalize email to lowercase', async () => {
      const dtoWithUpperEmail = { ...mockCreateDto, email: 'JOHN@EXAMPLE.COM' };
      const createdEmployee = { ...mockEmployee, save: vi.fn() };
      vi.spyOn(model, 'create').mockResolvedValueOnce(createdEmployee as any);

      await service.create('org_123', dtoWithUpperEmail);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'john@example.com' }),
      );
    });

    it('should still create employee even if Pinecone enrollment fails', async () => {
      const createdEmployee = { ...mockEmployee, save: vi.fn() };
      vi.spyOn(model, 'create').mockResolvedValueOnce(createdEmployee as any);
      vi.spyOn(faceRecognitionService, 'upsertFaceVector').mockRejectedValueOnce(
        new Error('Pinecone connection failed'),
      );

      const result = await service.create('org_123', mockCreateDto);

      // Employee should still be created
      expect(result).toEqual(createdEmployee);
      expect(model.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find an employee by ID within the org', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(mockEmployee),
      };
      vi.spyOn(model, 'findOne').mockReturnValueOnce(mockChain as any);

      const result = await service.findOne('org_123', mockEmployee._id);

      expect(model.findOne).toHaveBeenCalledWith({
        _id: mockEmployee._id,
        orgId: 'org_123',
      });
      expect(result).toEqual(mockEmployee);
    });

    it('should throw NotFoundException if employee not found', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(null),
      };
      vi.spyOn(model, 'findOne').mockReturnValueOnce(mockChain as any);

      await expect(
        service.findOne('org_123', 'nonexistent_id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return employee from different org', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(null),
      };
      vi.spyOn(model, 'findOne').mockReturnValueOnce(mockChain as any);

      await expect(
        service.findOne('org_different', mockEmployee._id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all active employees for an org', async () => {
      const mockEmployees = [mockEmployee, { ...mockEmployee, _id: '507f1f77bcf86cd799439012' }];
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(mockEmployees),
      };
      vi.spyOn(model, 'find').mockReturnValueOnce(mockChain as any);

      const result = await service.findAll('org_123');

      expect(model.find).toHaveBeenCalledWith({
        orgId: 'org_123',
        isActive: true,
      });
      expect(result).toEqual(mockEmployees);
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no employees found', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce([]),
      };
      vi.spyOn(model, 'find').mockReturnValueOnce(mockChain as any);

      const result = await service.findAll('org_empty');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update employee details', async () => {
      const updateDto: UpdateEmployeeDto = {
        name: 'John Smith',
        department: 'Product',
      };
      const updatedEmployee = { ...mockEmployee, ...updateDto };

      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(updatedEmployee),
      };
      vi.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce(mockChain as any);

      const result = await service.update('org_123', mockEmployee._id, updateDto);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockEmployee._id,
        updateDto,
        { new: true },
      );
      expect(result.name).toBe('John Smith');
      expect(result.department).toBe('Product');
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(null),
      };
      vi.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce(mockChain as any);

      await expect(
        service.update('org_123', 'nonexistent_id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate an employee (soft delete)', async () => {
      const deactivatedEmployee = { ...mockEmployee, isActive: false };
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(deactivatedEmployee),
      };
      vi.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce(mockChain as any);

      const result = await service.deactivate('org_123', mockEmployee._id);

      expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
        mockEmployee._id,
        { isActive: false },
        { new: true },
      );
      expect(result.isActive).toBe(false);
    });

    it('should throw NotFoundException if employee not found', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(null),
      };
      vi.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce(mockChain as any);

      await expect(
        service.deactivate('org_123', 'nonexistent_id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllWithDescriptors', () => {
    it('should return employees with descriptors for face matching', async () => {
      const employeesWithDesc = [
        { ...mockEmployee, descriptor: new Array(128).fill(0.1) },
      ];
      const mockChain = {
        exec: vi.fn().mockResolvedValueOnce(employeesWithDesc),
      };
      vi.spyOn(model, 'find').mockReturnValueOnce(mockChain as any);

      const result = await service.findAllWithDescriptors('org_123');

      expect(model.find).toHaveBeenCalledWith({
        orgId: 'org_123',
        isActive: true,
        descriptor: { $exists: true, $ne: null },
      });
      expect(result[0].descriptor).toBeDefined();
      expect(result[0].descriptor).toHaveLength(128);
    });
  });
});
