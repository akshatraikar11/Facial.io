import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AiQueryDto {
  @ApiProperty({
    example: 'Who was absent more than 3 times this month?',
    description: 'Natural language question about attendance data',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;
}
