import { Module } from '@nestjs/common';
import { FaceRecognitionController } from './face-recognition.controller.js';
import { FaceRecognitionService } from './face-recognition.service.js';
import { EmployeesModule } from '../employees/employees.module.js';
import { FACE_RECOGNITION_SERVICE } from '../employees/employees.service.js';

/**
 * FaceRecognitionModule — Pinecone vector search for face matching.
 *
 * imports: [EmployeesModule]
 *   FaceRecognitionService needs EmployeesService for:
 *     1. findOne()                — verify employee exists before enrolling
 *     2. setPineconeId()          — update employee's pineconeId after upsert
 *     3. findAllWithDescriptors() — bulk enrollment
 *   FaceRecognitionController also injects EmployeesService directly
 *   to fetch employee.name before calling upsertVector().
 *
 * exports: [FaceRecognitionService, FACE_RECOGNITION_SERVICE token]
 *   The custom token FACE_RECOGNITION_SERVICE is exported so EmployeesModule
 *   can optionally inject FaceRecognitionService without a direct class import.
 *   This breaks the circular dependency:
 *     FaceRecognitionModule imports EmployeesModule (for EmployeesService)
 *     EmployeesModule injects FACE_RECOGNITION_SERVICE token (@Optional)
 *   The token is a string constant — no class import needed in employees.service.ts.
 *
 * No MongooseModule.forFeature() here:
 *   This module has no schemas of its own. It talks to Pinecone (external)
 *   and to EmployeesService (via DI). Lean module — no DB models needed.
 *
 * Interview answer:
 * "We avoid circular dependency between EmployeesModule and FaceRecognitionModule
 *  by using a string injection token. EmployeesService declares it wants
 *  'FACE_RECOGNITION_SERVICE' with @Optional() — if the token isn't provided,
 *  it gets null and skips Pinecone. FaceRecognitionModule provides the real
 *  implementation under that token. No forwardRef() needed."
 */
@Module({
  imports: [EmployeesModule],
  controllers: [FaceRecognitionController],
  providers: [
    FaceRecognitionService,
    // Provide FaceRecognitionService under the string token so
    // EmployeesService can inject it without importing the class directly.
    {
      provide: FACE_RECOGNITION_SERVICE,
      useExisting: FaceRecognitionService,
    },
  ],
  exports: [
    FaceRecognitionService,
    FACE_RECOGNITION_SERVICE,
  ],
})
export class FaceRecognitionModule {}
