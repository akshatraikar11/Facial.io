import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateShiftDto {
  @ApiProperty({ example: 'Morning Shift' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '09:00', description: 'Expected check-in time (HH:MM 24h)' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:MM' })
  startTime: string;

  @ApiProperty({ example: '17:00', description: 'Shift end time (HH:MM 24h)' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:MM' })
  endTime: string;

  @ApiPropertyOptional({ example: 15, description: 'Minutes after startTime before check-in is "late"' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  gracePeriodMinutes?: number;
}
