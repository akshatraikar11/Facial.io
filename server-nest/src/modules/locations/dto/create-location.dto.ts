import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLocationDto {
  @ApiProperty({ example: 'main-gate' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'locationId must be a lowercase slug (e.g. main-gate)',
  })
  locationId: string;

  @ApiProperty({ example: 'Main Gate' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Primary entrance on the north side' })
  @IsOptional()
  @IsString()
  description?: string;
}
