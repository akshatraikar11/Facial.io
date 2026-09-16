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
import { ShiftsService } from './shifts.service.js';
import { CreateShiftDto } from './dto/create-shift.dto.js';
import { OrgId } from '../../common/decorators/org-id.decorator.js';

@ApiTags('shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @ApiOperation({ summary: 'List all active shifts for the org' })
  findAll(@OrgId() orgId: string) {
    return this.shiftsService.findAll(orgId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new shift' })
  create(@OrgId() orgId: string, @Body() dto: CreateShiftDto) {
    return this.shiftsService.create(orgId, dto);
  }

  @Delete(':shiftId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a shift (soft delete)' })
  remove(@OrgId() orgId: string, @Param('shiftId') shiftId: string) {
    return this.shiftsService.softDelete(orgId, shiftId);
  }
}
