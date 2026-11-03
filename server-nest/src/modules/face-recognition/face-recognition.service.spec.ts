import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FaceRecognitionService } from './face-recognition.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for FaceRecognitionService
 *
 * Tests cover:
 * - Face matching with Pinecone vector search
 * - Upserting face vectors into org namespace
 * - Deleting face vectors
 * - Bulk operations (deleteAllVectorsForOrg)
 * - Error handling when Pinecone is not configured (assertReady)
 * - Confidence threshold filtering
 */
describe('FaceRecognitionService', () => {
  let service: FaceRecognitionService;
  let mockPineconeIndex: any;
  let mockEmployeesService: any;
  let mockConfigService: any;

  const mockDescriptor = Array.from({ length: 128 }, () => 0.1);
  const mockOrgId = 'org_123';
  const mockEmployeeId = 'emp_507f1f77bcf86cd799439011';

  beforeEach(async () => {
    // Mock Pinecone namespace & index
    const mockNamespace = {
      query: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      deleteOne: vi.fn().mockResolvedValue({}),
      deleteAll: vi.fn().mockResolvedValue({}),
    };

    mockPineconeIndex = {
      namespace: vi.fn().mockReturnValue(mockNamespace),
    };

    mockEmployeesService = {
      setPineconeId: vi.fn().mockResolvedValue(undefined),
      findAllWithDescriptors: vi.fn().mockResolvedValue([]),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'PINECONE_API_KEY') return 'test-api-key';
        if (key === 'PINECONE_INDEX_NAME') return 'test-index';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaceRecognitionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmployeesService,
          useValue: mockEmployeesService,
        },
      ],
    }).compile();

    service = module.get<FaceRecognitionService>(FaceRecognitionService);

    // Mock internal Pinecone index state
    (service as any).index = mockPineconeIndex;
    (service as any).isReady = true;
  });

  describe('matchFace', () => {
    it('should return matched employee when confidence above threshold', async () => {
      const mockQueryResult = {
        matches: [
          {
            id: `${mockOrgId}#${mockEmployeeId}`,
            score: 0.95,
            metadata: {
              name: 'John Doe',
              employeeId: mockEmployeeId,
              orgId: mockOrgId,
            },
          },
        ],
      };

      const ns = mockPineconeIndex.namespace();
      ns.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor, 0.75);

      expect(result.matched).toBe(true);
      expect(result.employeeId).toBe(mockEmployeeId);
      expect(result.name).toBe('John Doe');
      expect(result.confidence).toBe(0.95);
      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
    });

    it('should return not matched when confidence below threshold', async () => {
      const mockQueryResult = {
        matches: [
          {
            id: `${mockOrgId}#${mockEmployeeId}`,
            score: 0.60,
            metadata: {
              name: 'John Doe',
              employeeId: mockEmployeeId,
              orgId: mockOrgId,
            },
          },
        ],
      };

      const ns = mockPineconeIndex.namespace();
      ns.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor, 0.75);

      expect(result.matched).toBe(false);
      expect(result.employeeId).toBeNull();
      expect(result.confidence).toBe(0.60);
      expect(result.message).toContain('Face not recognized');
    });

    it('should return not matched when no results from Pinecone', async () => {
      const mockQueryResult = { matches: [] };

      const ns = mockPineconeIndex.namespace();
      ns.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor);

      expect(result.matched).toBe(false);
      expect(result.employeeId).toBeNull();
      expect(result.message).toContain('No enrolled faces found');
    });

    it('should use default threshold of 0.75 if not provided', async () => {
      const mockQueryResult = {
        matches: [
          {
            id: `${mockOrgId}#${mockEmployeeId}`,
            score: 0.80,
            metadata: {
              name: 'John Doe',
              employeeId: mockEmployeeId,
              orgId: mockOrgId,
            },
          },
        ],
      };

      const ns = mockPineconeIndex.namespace();
      ns.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor);

      expect(result.matched).toBe(true);
      expect(result.confidence).toBe(0.80);
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      (service as any).isReady = false;
      (service as any).index = null;

      await expect(
        service.matchFace(mockOrgId, mockDescriptor),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('upsertVector', () => {
    it('should upsert face vector into org namespace and set pineconeId in DB', async () => {
      const ns = mockPineconeIndex.namespace();

      await service.upsertVector(
        mockOrgId,
        mockEmployeeId,
        'John Doe',
        mockDescriptor,
      );

      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(ns.upsert).toHaveBeenCalledWith({
        records: [
          {
            id: `${mockOrgId}#${mockEmployeeId}`,
            values: mockDescriptor,
            metadata: {
              orgId: mockOrgId,
              employeeId: mockEmployeeId,
              name: 'John Doe',
            },
          },
        ],
      });
      expect(mockEmployeesService.setPineconeId).toHaveBeenCalledWith(
        mockOrgId,
        mockEmployeeId,
        `${mockOrgId}#${mockEmployeeId}`,
      );
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      (service as any).isReady = false;
      (service as any).index = null;

      await expect(
        service.upsertVector(
          mockOrgId,
          mockEmployeeId,
          'John Doe',
          mockDescriptor,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('deleteVector', () => {
    it('should delete a single face vector by composite id', async () => {
      const ns = mockPineconeIndex.namespace();

      await service.deleteVector(mockOrgId, mockEmployeeId);

      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(ns.deleteOne).toHaveBeenCalledWith({ id: `${mockOrgId}#${mockEmployeeId}` });
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      (service as any).isReady = false;
      (service as any).index = null;

      await expect(
        service.deleteVector(mockOrgId, mockEmployeeId),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('deleteAllVectorsForOrg', () => {
    it('should delete all vectors for an organization', async () => {
      const ns = mockPineconeIndex.namespace();

      await service.deleteAllVectorsForOrg(mockOrgId);

      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(ns.deleteAll).toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      (service as any).isReady = false;
      (service as any).index = null;

      await expect(
        service.deleteAllVectorsForOrg(mockOrgId),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
