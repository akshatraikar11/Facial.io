import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * AttendanceQueryDto — query string params for filtering attendance logs.
 *
 * Used by GET /api/attendance with optional filters:
 *   ?date=2026-08-28
 *   ?employeeId=abc123
 *   ?startDate=2026-08-01&endDate=2026-08-31
 *
 * All fields optional — no filter = return all logs for the org.
 *
 * Transform: true in the global ValidationPipe means these string
 * query params will be auto-converted to the class instance,
 * and the regex validators run on them properly.
 */
export class AttendanceQueryDto {
  @ApiPropertyOptional({ example: '2026-08-28', description: 'Filter by specific date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ example: '6507f1f77bcf86cd799439011', description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ example: '2026-08-01', description: 'Range start date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-31', description: 'Range end date (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;

  @ApiPropertyOptional({ example: 'main-gate', description: 'Filter by location slug' })
  @IsOptional()
  @IsString()
  locationId?: string;
}
