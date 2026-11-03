import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PresignedUrlResult {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * S3AuditStorageService — Generates AWS S3 SigV4 Presigned URLs for biometric audit captures.
 *
 * Pattern: Direct-to-S3 Upload.
 * The browser/kiosk uploads verification snapshots directly to private S3 bucket.
 * The API server never buffers biometric images in memory (sub-second performance + GDPR isolation).
 */
@Injectable()
export class S3AuditStorageService {
  private readonly logger = new Logger(S3AuditStorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') || 'facialio-biometric-audit';
    this.region = this.config.get<string>('AWS_REGION') || 'us-east-1';
    this.accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID') || 'TEST_ACCESS_KEY';
    this.secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY') || 'TEST_SECRET_KEY';
  }

  /**
   * Generates a 15-minute Presigned PUT URL for uploading a snapshot image.
   */
  generatePresignedUploadUrl(orgId: string, eventId: string): PresignedUrlResult {
    const s3Key = `audits/${orgId}/${Date.now()}-${eventId}.jpg`;
    const expiresIn = 900; // 15 minutes

    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expiresIn),
      'X-Amz-SignedHeaders': 'host',
    });

    // Canonical request string
    const canonicalRequest = [
      'PUT',
      `/${s3Key}`,
      queryParams.toString(),
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    // String to sign
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // Signature calculation
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    queryParams.set('X-Amz-Signature', signature);
    const uploadUrl = `https://${host}/${s3Key}?${queryParams.toString()}`;

    return {
      uploadUrl,
      s3Key,
      expiresIn,
    };
  }

  /**
   * Generates a Presigned GET URL for viewing an audit snapshot.
   */
  generatePresignedDownloadUrl(s3Key: string): string {
    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${this.accessKeyId}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': '900',
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalRequest = [
      'GET',
      `/${s3Key}`,
      queryParams.toString(),
      `host:${host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    queryParams.set('X-Amz-Signature', signature);
    return `https://${host}/${s3Key}?${queryParams.toString()}`;
  }
}

