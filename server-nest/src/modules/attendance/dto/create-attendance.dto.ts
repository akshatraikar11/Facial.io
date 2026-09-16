import { IsString, IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateAttendanceDto — validated input for a kiosk check-in.
 *
 * For authenticated dashboard flows, orgId comes from the Clerk JWT via @OrgId().
 * For the public kiosk flow (@Public()), orgId must be included in the body
 * because there is no JWT. Both shapes are accepted here — the controller
 * strips orgId from the DTO before passing the remainder to the service.
 */
export class CreateAttendanceDto {
  @ApiProperty({ example: '6507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ example: 'Akshat Sharma' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'org_2abc123', description: 'Required for public kiosk check-in (no JWT)' })
  @IsOptional()
  @IsString()
  orgId?: string;

  @ApiPropertyOptional({
    example: '2026-08-28',
    description: 'Date in YYYY-MM-DD format. Defaults to today if omitted.',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({
    example: '09:30',
    description: 'Time in HH:MM (24h) format. Defaults to now if omitted.',
  })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'time must be in HH:MM format',
  })
  time?: string;

  @ApiPropertyOptional({
    enum: ['present', 'late', 'absent'],
    default: 'present',
  })
  @IsEnum(['present', 'late', 'absent'])
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ example: 'main-gate', description: 'Kiosk location slug' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ example: 'Main Gate', description: 'Location display name (resolved server-side)' })
  @IsOptional()
  @IsString()
  locationName?: string;
}
