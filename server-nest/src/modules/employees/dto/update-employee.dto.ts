import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsArray,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdateEmployeeDto — all fields optional for PATCH semantics.
 *
 * PATCH means "update only the fields I send".
 * PUT means "replace the whole resource".
 * We use PATCH here — more practical for real-world use
 * (e.g. admin just wants to rename an employee without re-enrolling the face).
 *
 * PartialType from @nestjs/swagger would auto-generate this,
 * but we define it explicitly so we can add IsBoolean for isActive
 * (which isn't in CreateEmployeeDto since it defaults to true on create).
 */
export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: 'Akshat Kumar Sharma' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'akshat.new@acme.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ enum: ['admin', 'employee'] })
  @IsEnum(['admin', 'employee'])
  @IsOptional()
  role?: string;

  @ApiPropertyOptional({
    description: 'Updated face descriptor (re-enrollment)',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(128)
  @IsNumber({}, { each: true })
  @IsOptional()
  descriptor?: number[];

  @ApiPropertyOptional({
    description: 'Set to false to deactivate (soft delete)',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
