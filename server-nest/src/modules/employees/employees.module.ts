import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';
import { Employee, EmployeeSchema } from './schemas/employee.schema.js';
import { AuditModule } from '../audit/audit.module.js';

/**
 * EmployeesModule — owns all employee-related functionality.
 *
 * exports: [EmployeesService]
 *   FaceRecognitionModule (Phase 4) needs EmployeesService to:
 *     - call setPineconeId() after enrolling a vector
 *     - call findAllWithDescriptors() for bulk re-enrollment
 *   AttendanceModule needs it to verify employee exists on check-in.
 *   By exporting the service, those modules can inject it without
 *   circular dependency issues.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    AuditModule,
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
