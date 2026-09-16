import {
  IsArray,
  IsNumber,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * MatchFaceDto — input for the face matching endpoint.
 *
 * The kiosk captures a frame, face-api.js extracts a 128-dim descriptor,
 * and sends it here. The server queries Pinecone for the nearest vector
 * in the org's namespace and returns the best match.
 *
 * orgId is in the body here (not JWT) because this endpoint is @Public()
 * — the kiosk screen has no logged-in user.
 *
 * threshold (optional):
 *   Pinecone returns a cosine similarity score (0–1, higher = more similar).
 *   We default to 0.75. Below this score = no match (unknown face).
 *   The original faceApi.ts used a distance threshold of 0.65 —
 *   cosine similarity is the inverse, so ~0.75 is equivalent.
 */
export class MatchFaceDto {
  @ApiProperty({
    description: 'Clerk organization ID — identifies which org to search in',
    example: 'org_2abc123xyz',
  })
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty({
    description: '128-dimension face descriptor from face-api.js',
    type: [Number],
    minItems: 128,
    maxItems: 128,
  })
  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  descriptor: number[];

  @ApiPropertyOptional({
    description: 'Minimum cosine similarity score to accept a match (0–1). Default: 0.75',
    example: 0.75,
  })
  @IsNumber()
  @IsOptional()
  threshold?: number;
}
