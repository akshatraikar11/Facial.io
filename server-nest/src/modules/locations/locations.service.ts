import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Location, LocationDocument } from './schemas/location.schema.js';
import { CreateLocationDto } from './dto/create-location.dto.js';

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
  ) {}

  async findAll(orgId: string): Promise<LocationDocument[]> {
    return this.locationModel
      .find({ orgId, isActive: true })
      .sort({ name: 1 })
      .exec();
  }

  async findBySlug(
    orgId: string,
    locationId: string,
  ): Promise<LocationDocument | null> {
    return this.locationModel.findOne({ orgId, locationId, isActive: true }).exec();
  }

  async create(
    orgId: string,
    dto: CreateLocationDto,
  ): Promise<LocationDocument> {
    const existing = await this.locationModel
      .findOne({ orgId, locationId: dto.locationId })
      .exec();

    if (existing) {
      throw new ConflictException(
        `Location "${dto.locationId}" already exists in your organization`,
      );
    }

    const location = await this.locationModel.create({
      orgId,
      locationId: dto.locationId,
      name: dto.name,
      description: dto.description ?? null,
      isActive: true,
    });

    this.logger.log(`Location created: ${dto.name} (${orgId})`);
    return location;
  }

  async softDelete(orgId: string, locationId: string): Promise<void> {
    const result = await this.locationModel
      .findOneAndUpdate(
        { orgId, locationId },
        { isActive: false },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(`Location "${locationId}" not found`);
    }

    this.logger.log(`Location deactivated: ${locationId} (${orgId})`);
  }
}
