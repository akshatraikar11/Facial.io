import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FaceRecognitionService } from './face-recognition.service.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Unit tests for FaceRecognitionService
 *
 * Tests cover:
 * - Face matching with Pinecone vector search
 * - Upserting face vectors
 * - Deleting face vectors
 * - Bulk operations
 * - Error handling when Pinecone not configured
 * - Confidence threshold filtering
 */
describe('FaceRecognitionService', () => {
  let service: FaceRecognitionService;
  let configService: ConfigService;
  let mockPineconeIndex: any;

  const mockDescriptor = new Array(128).fill(0.1);
  const mockOrgId = 'org_123';
  const mockEmployeeId = 'emp_507f1f77bcf86cd799439011';

  beforeEach(async () => {
    // Mock Pinecone index
    mockPineconeIndex = {
      query: vi.fn(),
      upsert: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      namespace: vi.fn().mockReturnThis(),
    };

    // Mock ConfigService
    const mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'PINECONE_API_KEY') return 'test-api-key';
        if (key === 'PINECONE_INDEX_NAME') return 'test-index';
        if (key === 'PINECONE_ENVIRONMENT') return 'test-env';
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
      ],
    }).compile();

    service = module.get<FaceRecognitionService>(FaceRecognitionService);
    configService = module.get<ConfigService>(ConfigService);

    // Inject mock Pinecone index (simulate private field access for testing)
    (service as any).pineconeIndex = mockPineconeIndex;
  });

  describe('matchFace', () => {
    it('should return matched employee when confidence above threshold', async () => {
      const mockQueryResult = {
        matches: [
          {
            id: mockEmployeeId,
            score: 0.95,
            metadata: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        ],
      };

      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor, 0.85);

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
            id: mockEmployeeId,
            score: 0.70,
            metadata: { name: 'John Doe', email: 'john@example.com' },
          },
        ],
      };

      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor, 0.85);

      expect(result.matched).toBe(false);
      expect(result.employeeId).toBeNull();
      expect(result.confidence).toBe(0.70);
    });

    it('should return not matched when no results from Pinecone', async () => {
      const mockQueryResult = { matches: [] };

      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor);

      expect(result.matched).toBe(false);
      expect(result.employeeId).toBeNull();
      expect(result.message).toContain('No match found');
    });

    it('should use default threshold of 0.85 if not provided', async () => {
      const mockQueryResult = {
        matches: [
          {
            id: mockEmployeeId,
            score: 0.90,
            metadata: { name: 'John Doe', email: 'john@example.com' },
          },
        ],
      };

      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.query.mockResolvedValueOnce(mockQueryResult);

      const result = await service.matchFace(mockOrgId, mockDescriptor);

      expect(result.matched).toBe(true);
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      const serviceWithoutPinecone = new FaceRecognitionService(configService);

      await expect(
        serviceWithoutPinecone.matchFace(mockOrgId, mockDescriptor),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('upsertFaceVector', () => {
    it('should upsert face vector with metadata', async () => {
      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.upsert.mockResolvedValueOnce({ upsertedCount: 1 });

      const metadata = { name: 'John Doe', email: 'john@example.com' };
      const result = await service.upsertFaceVector(
        mockOrgId,
        mockEmployeeId,
        mockDescriptor,
        metadata,
      );

      expect(result.success).toBe(true);
      expect(result.pineconeId).toBe(mockEmployeeId);
      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(mockPineconeIndex.upsert).toHaveBeenCalledWith([
        {
          id: mockEmployeeId,
          values: mockDescriptor,
          metadata,
        },
      ]);
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      const serviceWithoutPinecone = new FaceRecognitionService(configService);

      await expect(
        serviceWithoutPinecone.upsertFaceVector(
          mockOrgId,
          mockEmployeeId,
          mockDescriptor,
        ),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('deleteFaceVector', () => {
    it('should delete a single face vector', async () => {
      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.deleteOne.mockResolvedValueOnce({});

      const result = await service.deleteFaceVector(mockOrgId, mockEmployeeId);

      expect(result.success).toBe(true);
      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(mockPineconeIndex.deleteOne).toHaveBeenCalledWith(mockEmployeeId);
    });

    it('should throw ServiceUnavailableException if Pinecone not configured', async () => {
      const serviceWithoutPinecone = new FaceRecognitionService(configService);

      await expect(
        serviceWithoutPinecone.deleteFaceVector(mockOrgId, mockEmployeeId),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('deleteAllVectorsForOrg', () => {
    it('should delete all vectors for an organization', async () => {
      mockPineconeIndex.namespace.mockReturnThis();
      mockPineconeIndex.deleteMany.mockResolvedValueOnce({});

      const result = await service.deleteAllVectorsForOrg(mockOrgId);

      expect(result.success).toBe(true);
      expect(mockPineconeIndex.namespace).toHaveBeenCalledWith(`org_${mockOrgId}`);
      expect(mockPineconeIndex.deleteMany).toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should return connected status when Pinecone configured', () => {
      const health = service.getHealth();

      expect(health.connected).toBe(true);
      expect(health.indexName).toBe('test-index');
    });

    it('should return disconnected status when Pinecone not configured', () => {
      const serviceWithoutPinecone = new FaceRecognitionService(configService);
      const health = serviceWithoutPinecone.getHealth();

      expect(health.connected).toBe(false);
    });
  });
});
