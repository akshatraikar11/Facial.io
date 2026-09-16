import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { EmployeesModule } from '../employees/employees.module.js';

/**
 * AiModule — LangChain + Gemini RAG attendance assistant.
 *
 * imports: [AttendanceModule, EmployeesModule]
 *   AiService needs AttendanceService (retrieve records) and
 *   EmployeesService (retrieve employee list) for the RAG context.
 *   Both modules export their services, so importing here makes
 *   them injectable in AiService.
 */
@Module({
  imports: [AttendanceModule, EmployeesModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
