import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsArray,
  IsNumber,
  IsOptional,
  IsEnum,
  ArrayMinSize,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateEmployeeDto — validated shape for registering a new employee.
 *
 * The descriptor array is the 128-dimension face embedding from face-api.js.
 * It arrives as a plain number[] from the frontend after face capture.
 *
 * Note: orgId is NOT in this DTO.
 * The controller extracts orgId from the Clerk JWT via @OrgId().
 * The client never sends orgId — it can't forge which org they belong to.
 *
 * Validation decorators used:
 *   @IsEmail()          — validates RFC 5322 email format
 *   @IsArray()          — must be an array
 *   @IsNumber({}, {each: true}) — each element must be a number
 *   @ArrayMinSize(128)  — face descriptor must have at least 128 values
 *   @IsEnum()           — only 'admin' or 'employee' accepted
 */
export class CreateEmployeeDto {
  @ApiProperty({ example: 'Akshat Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'akshat@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    example: 'employee',
    enum: ['admin', 'employee'],
    default: 'employee',
  })
  @IsEnum(['admin', 'employee'])
  @IsOptional()
  role?: string;

  @ApiProperty({
    description: '128-dimension face descriptor array from face-api.js',
    type: [Number],
    example: [0.12, -0.34, 0.56, '...128 numbers total'],
  })
  @IsArray()
  @ArrayMinSize(128)
  @IsNumber({}, { each: true })
  descriptor: number[];

  @ApiPropertyOptional({ example: '+919876543210', description: 'Phone number for WhatsApp/SMS alerts' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'main-gate', description: 'Default check-in location slug' })
  @IsOptional()
  @IsString()
  defaultLocationId?: string;

  @ApiPropertyOptional({ example: 82, description: 'Face quality score 0–100 computed on frontend' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  faceQualityScore?: number;

  @ApiPropertyOptional({ example: 'good', enum: ['good', 'fair', 'poor'] })
  @IsOptional()
  @IsEnum(['good', 'fair', 'poor'])
  faceQualityLabel?: string;
}
