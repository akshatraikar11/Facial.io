import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({ enum: ['pro', 'enterprise'], example: 'pro' })
  @IsEnum(['pro', 'enterprise'])
  plan: 'pro' | 'enterprise';
}
