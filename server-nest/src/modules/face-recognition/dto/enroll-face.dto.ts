import {
  IsArray,
  IsNumber,
  IsString,
  IsNotEmpty,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * EnrollFaceDto — input for enrolling/updating a face vector in Pinecone.
 *
 * Called when:
 *   1. A new employee is created (auto-called by EmployeesService.create())
 *   2. An admin re-enrolls a face (e.g. the employee changed their appearance)
 *
 * orgId comes from the JWT (@OrgId() decorator) — not the body.
 * employeeId is the MongoDB _id of the employee document.
 *
 * Pinecone vector ID format: '<orgId>#<employeeId>'
 * This format lets us delete all vectors for an org with a single prefix query,
 * and makes the vector self-describing in Pinecone's dashboard.
 */
export class EnrollFaceDto {
  @ApiProperty({
    description: 'MongoDB employee ID',
    example: '6507f1f77bcf86cd799439011',
  })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

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
}
