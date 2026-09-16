import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Integration tests for EmployeesController
 *
 * Tests the HTTP API layer including:
 * - Request validation
 * - Auth guard integration (@OrgId decorator)
 * - Response serialization
 * - Error handling (4xx, 5xx)
 */
describe('EmployeesController (Integration)', () => {
  let app: INestApplication;
  let employeesService: EmployeesService;

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
    const mockEmployeesService = {
      create: vi.fn().mockResolvedValue(mockEmployee),
      findAll: vi.fn().mockResolvedValue([mockEmployee]),
      findOne: vi.fn().mockResolvedValue(mockEmployee),
      update: vi.fn().mockResolvedValue(mockEmployee),
      deactivate: vi.fn().mockResolvedValue({ ...mockEmployee, isActive: false }),
      findAllWithDescriptors: vi.fn().mockResolvedValue([mockEmployee]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        {
          provide: EmployeesService,
          useValue: mockEmployeesService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    
    // Apply same validation pipe as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    employeesService = module.get<EmployeesService>(EmployeesService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /employees', () => {
    it('should create a new employee', async () => {
      const response = await request(app.getHttpServer())
        .post('/employees')
        .send(mockCreateDto)
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: mockEmployee.name,
        email: mockEmployee.email,
      });
      expect(employeesService.create).toHaveBeenCalledWith(
        expect.any(String), // orgId from @OrgId() decorator
        mockCreateDto,
      );
    });

    it('should reject request with missing required fields', async () => {
      const invalidDto = { name: 'John Doe' }; // missing email, descriptor

      await request(app.getHttpServer())
        .post('/employees')
        .send(invalidDto)
        .expect(400);
    });

    it('should reject request with invalid email format', async () => {
      const invalidDto = { ...mockCreateDto, email: 'not-an-email' };

      await request(app.getHttpServer())
        .post('/employees')
        .send(invalidDto)
        .expect(400);
    });

    it('should reject request with descriptor not an array', async () => {
      const invalidDto = { ...mockCreateDto, descriptor: 'not-an-array' };

      await request(app.getHttpServer())
        .post('/employees')
        .send(invalidDto)
        .expect(400);
    });

    it('should strip unknown fields (whitelist protection)', async () => {
      const dtoWithExtraFields = {
        ...mockCreateDto,
        maliciousField: 'hack',
        isAdmin: true,
      };

      await request(app.getHttpServer())
        .post('/employees')
        .send(dtoWithExtraFields)
        .expect(400); // forbidNonWhitelisted throws on unknown fields
    });
  });

  describe('GET /employees', () => {
    it('should return all employees for the org', async () => {
      const response = await request(app.getHttpServer())
        .get('/employees')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        name: mockEmployee.name,
        email: mockEmployee.email,
      });
      expect(employeesService.findAll).toHaveBeenCalled();
    });

    it('should support withDescriptors query param', async () => {
      await request(app.getHttpServer())
        .get('/employees?withDescriptors=true')
        .expect(200);

      expect(employeesService.findAllWithDescriptors).toHaveBeenCalled();
    });
  });

  describe('GET /employees/:id', () => {
    it('should return a single employee by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/employees/${mockEmployee._id}`)
        .expect(200);

      expect(response.body.data).toMatchObject({
        name: mockEmployee.name,
        email: mockEmployee.email,
      });
      expect(employeesService.findOne).toHaveBeenCalledWith(
        expect.any(String), // orgId
        mockEmployee._id,
      );
    });

    it('should return 404 if employee not found', async () => {
      vi.spyOn(employeesService, 'findOne').mockRejectedValueOnce(
        new Error('Employee not found'),
      );

      await request(app.getHttpServer())
        .get('/employees/nonexistent_id')
        .expect(404);
    });
  });

  describe('PATCH /employees/:id', () => {
    it('should update employee details', async () => {
      const updateDto = { name: 'Jane Doe', department: 'Product' };

      const response = await request(app.getHttpServer())
        .patch(`/employees/${mockEmployee._id}`)
        .send(updateDto)
        .expect(200);

      expect(employeesService.update).toHaveBeenCalledWith(
        expect.any(String), // orgId
        mockEmployee._id,
        updateDto,
      );
    });

    it('should reject update with invalid fields', async () => {
      const invalidDto = { email: 'not-an-email' };

      await request(app.getHttpServer())
        .patch(`/employees/${mockEmployee._id}`)
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('DELETE /employees/:id', () => {
    it('should deactivate an employee (soft delete)', async () => {
      await request(app.getHttpServer())
        .delete(`/employees/${mockEmployee._id}`)
        .expect(200);

      expect(employeesService.deactivate).toHaveBeenCalledWith(
        expect.any(String), // orgId
        mockEmployee._id,
      );
    });

    it('should return 404 if employee not found', async () => {
      vi.spyOn(employeesService, 'deactivate').mockRejectedValueOnce(
        new Error('Employee not found'),
      );

      await request(app.getHttpServer())
        .delete('/employees/nonexistent_id')
        .expect(404);
    });
  });
});
