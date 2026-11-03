import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EmployeesService, IFaceRecognitionService, FACE_RECOGNITION_SERVICE } from './employees.service.js';
import { Employee, EmployeeDocument } from './schemas/employee.schema.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for EmployeesService
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
    toObject() {
      return { ...this };
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
    // Chainable query helpers
    const makeQuery = (result: any) => ({
      select: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue(result),
    });

    const mockModelMethods = {
      create: vi.fn().mockResolvedValue(mockEmployee),
      findOne: vi.fn().mockReturnValue(makeQuery(null)),
      find: vi.fn().mockReturnValue(makeQuery([mockEmployee])),
      findOneAndUpdate: vi.fn().mockReturnValue(makeQuery(mockEmployee)),
      findOneAndDelete: vi.fn().mockReturnValue(makeQuery(mockEmployee)),
      countDocuments: vi.fn().mockReturnValue(makeQuery(1)),
    };

    const mockFaceRecognitionService = {
      upsertVector: vi.fn().mockResolvedValue(undefined),
      deleteVector: vi.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: getModelToken(Employee.name),
          useValue: mockModelMethods,
        },
        {
          provide: FACE_RECOGNITION_SERVICE,
          useValue: mockFaceRecognitionService,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    model = module.get<Model<EmployeeDocument>>(getModelToken(Employee.name));
    faceRecognitionService = module.get<IFaceRecognitionService>(FACE_RECOGNITION_SERVICE);
  });

  describe('create', () => {
    it('should create an employee with face descriptor', async () => {
      const result = await service.create('org_123', mockCreateDto);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: 'org_123',
          name: mockCreateDto.name,
          email: 'john@example.com',
        }),
      );
      expect(faceRecognitionService.upsertVector).toHaveBeenCalledWith(
        'org_123',
        mockEmployee._id.toString(),
        mockEmployee.name,
        mockCreateDto.descriptor,
      );
      expect(result).toEqual(mockEmployee);
    });

    it('should normalize email to lowercase', async () => {
      const dtoWithUpperEmail = { ...mockCreateDto, email: 'JOHN@EXAMPLE.COM' };

      await service.create('org_123', dtoWithUpperEmail);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john@example.com',
        }),
      );
    });

    it('should still create employee even if Pinecone enrollment fails', async () => {
      vi.spyOn(faceRecognitionService, 'upsertVector').mockRejectedValueOnce(
        new Error('Pinecone connection timeout'),
      );

      const result = await service.create('org_123', mockCreateDto);

      expect(result).toEqual(mockEmployee);
      expect(model.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find an employee by ID within the org', async () => {
      vi.spyOn(model, 'findOne').mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce(mockEmployee),
      } as any);

      const result = await service.findOne('org_123', mockEmployee._id);

      expect(result).toEqual(mockEmployee);
      expect(model.findOne).toHaveBeenCalledWith({
        _id: mockEmployee._id,
        orgId: 'org_123',
      });
    });

    it('should throw NotFoundException if employee not found', async () => {
      vi.spyOn(model, 'findOne').mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce(null),
      } as any);

      await expect(
        service.findOne('org_123', 'nonexistent_id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all active employees for an org', async () => {
      const result = await service.findAll('org_123');

      expect(result).toEqual([mockEmployee]);
      expect(model.find).toHaveBeenCalledWith({ orgId: 'org_123', isActive: true });
    });

    it('should return empty array if no employees found', async () => {
      vi.spyOn(model, 'find').mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([]),
      } as any);

      const result = await service.findAll('org_123');

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update employee details', async () => {
      const updateDto: UpdateEmployeeDto = { name: 'Jane Doe', department: 'Product' };
      const updatedEmployee = { ...mockEmployee, ...updateDto };

      vi.spyOn(model, 'findOneAndUpdate').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(updatedEmployee),
      } as any);

      const result = await service.update('org_123', mockEmployee._id, updateDto);

      expect(result).toEqual(updatedEmployee);
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockEmployee._id, orgId: 'org_123' },
        { $set: updateDto },
        { new: true },
      );
    });

    it('should throw NotFoundException if employee does not exist', async () => {
      vi.spyOn(model, 'findOneAndUpdate').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(null),
      } as any);

      await expect(
        service.update('org_123', 'nonexistent_id', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should deactivate an employee by setting isActive to false', async () => {
      vi.spyOn(model, 'findOneAndUpdate').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce({ ...mockEmployee, isActive: false }),
      } as any);

      await service.softDelete('org_123', mockEmployee._id);

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockEmployee._id, orgId: 'org_123' },
        { isActive: false },
        { new: true },
      );
    });

    it('should throw NotFoundException if employee not found', async () => {
      vi.spyOn(model, 'findOneAndUpdate').mockReturnValueOnce({
        exec: vi.fn().mockResolvedValueOnce(null),
      } as any);

      await expect(
        service.softDelete('org_123', 'nonexistent_id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllWithDescriptors', () => {
    it('should return employees with descriptors for face matching', async () => {
      const result = await service.findAllWithDescriptors('org_123');

      expect(model.find).toHaveBeenCalledWith({
        orgId: 'org_123',
        isActive: true,
      });
      expect(result).toEqual([mockEmployee]);
    });
  });
});
