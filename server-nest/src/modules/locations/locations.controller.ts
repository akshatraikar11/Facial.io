import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LocationsService } from './locations.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active locations for the org' })
  findAll(@OrgId() orgId: string) {
    return this.locationsService.findAll(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new check-in location' })
  create(@OrgId() orgId: string, @Body() dto: CreateLocationDto) {
    return this.locationsService.create(orgId, dto);
  }

  @Delete(':locationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a location (soft delete)' })
  remove(@OrgId() orgId: string, @Param('locationId') locationId: string) {
    return this.locationsService.softDelete(orgId, locationId);
  }
}
