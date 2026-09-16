import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateOrganizationDto — the validated shape of data needed to create an org.
 *
 * This DTO is used internally (called by OrganizationsService when the
 * Clerk webhook fires) — not directly from a user-facing request body.
 *
 * class-validator decorators:
 *   @IsString()    — must be a string
 *   @IsNotEmpty()  — cannot be empty string
 *   @IsOptional()  — field can be absent
 *
 * @ApiProperty() — tells Swagger to document this field.
 */
export class CreateOrganizationDto {
  @ApiProperty({ example: 'org_2abc123xyz', description: 'Clerk organization ID' })
  @IsString()
  @IsNotEmpty()
  orgId: string;

  @ApiProperty({ example: 'Acme Corp', description: 'Organization display name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'cus_stripe123', description: 'Stripe customer ID' })
  @IsString()
  @IsOptional()
  stripeCustomerId?: string;
}
