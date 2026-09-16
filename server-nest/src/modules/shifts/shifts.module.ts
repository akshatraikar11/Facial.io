import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShiftsController } from './shifts.controller.js';
import { ShiftsService } from './shifts.service.js';
import { Shift, ShiftSchema } from './schemas/shift.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Shift.name, schema: ShiftSchema },
    ]),
  ],
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
