import { ConfigService } from '@nestjs/config';
import { S3AuditStorageService } from './s3-audit-storage.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('S3AuditStorageService', () => {
  let service: S3AuditStorageService;
  let mockConfigService: any;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'AWS_S3_BUCKET') return 'test-audit-bucket';
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_ACCESS_KEY_ID') return 'AKIA_TEST_KEY';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY_123';
        return null;
      }),
    };

    service = new S3AuditStorageService(mockConfigService);
  });

  it('generates AWS S3 SigV4 Presigned Upload URL for audit capture', () => {
    const result = service.generatePresignedUploadUrl('org_123', 'evt_999');

    expect(result.uploadUrl).toContain('https://test-audit-bucket.s3.us-east-1.amazonaws.com/');
    expect(result.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result.uploadUrl).toContain('X-Amz-Signature=');
    expect(result.s3Key).toContain('audits/org_123/');
    expect(result.expiresIn).toBe(900);
  });

  it('generates AWS S3 Presigned Download URL for audit snapshot review', () => {
    const downloadUrl = service.generatePresignedDownloadUrl('audits/org_123/snap.jpg');

    expect(downloadUrl).toContain('https://test-audit-bucket.s3.us-east-1.amazonaws.com/audits/org_123/snap.jpg');
    expect(downloadUrl).toContain('X-Amz-Signature=');
  });
});

