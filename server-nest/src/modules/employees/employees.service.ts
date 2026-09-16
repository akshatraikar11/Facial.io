import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Employee, EmployeeDocument } from './schemas/employee.schema.js';
import { CreateEmployeeDto } from './dto/create-employee.dto.js';
import { UpdateEmployeeDto } from './dto/update-employee.dto.js';

/**
 * Minimal interface to avoid circular import.
 * FaceRecognitionService implements this — we declare it here
 * instead of importing the full class, which would create a circular dependency:
 *   EmployeesModule imports FaceRecognitionModule
 *   FaceRecognitionModule imports EmployeesModule
 * Using an interface + optional injection breaks the cycle cleanly.
 */
interface IFaceRecognitionService {
  upsertVector(
    orgId: string,
    employeeId: string,
    name: string,
    descriptor: number[],
  ): Promise<void>;
}

export const FACE_RECOGNITION_SERVICE = 'FACE_RECOGNITION_SERVICE';

/**
 * EmployeesService — all business logic for employee management.
 *
 * Key pattern: EVERY method takes orgId as its first parameter.
 * Every MongoDB query includes { orgId } in the filter.
 * This is the service-level enforcement of multi-tenancy.
 *
 * Even if a bug in the controller somehow passed the wrong orgId,
 * the query would still only return documents for that (wrong) org —
 * it could never leak data across org boundaries.
 *
 * stripeSensitiveFields():
 *   A helper that removes descriptor[] from responses by default.
 *   Face embeddings are sensitive data — we don't want them leaking
 *   into list responses. They're only needed for Pinecone operations.
 */
@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectModel(Employee.name)
    private readonly employeeModel: Model<EmployeeDocument>,
    @Optional()
    @Inject(FACE_RECOGNITION_SERVICE)
    private readonly faceRecognitionService: IFaceRecognitionService | null,
  ) {}

  /**
   * Returns all active employees in an org.
   * Excludes descriptor[] from the response — not needed for display.
   */
  async findAll(orgId: string): Promise<Omit<EmployeeDocument, 'descriptor'>[]> {
    return this.employeeModel
      .find({ orgId, isActive: true })
      .select('-descriptor') // exclude face data from list view
      .sort({ name: 1 })
      .exec() as unknown as Omit<EmployeeDocument, 'descriptor'>[];
  }

  /**
   * Returns a single employee by MongoDB _id, scoped to the org.
   * Throws NotFoundException if not found or belongs to a different org.
   */
  async findOne(orgId: string, employeeId: string): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findOne({ _id: employeeId, orgId })
      .exec();

    if (!employee) {
      throw new NotFoundException(
        `Employee ${employeeId} not found in your organization`,
      );
    }

    return employee;
  }

  /**
   * Finds an employee by email within an org.
   * Used to check for duplicates before creating.
   */
  async findByEmail(
    orgId: string,
    email: string,
  ): Promise<EmployeeDocument | null> {
    return this.employeeModel
      .findOne({ orgId, email: email.toLowerCase() })
      .exec();
  }

  /**
   * Creates a new employee with face descriptor.
   * Enforces unique email per org.
   * pineconeId starts null — set after Phase 4 face enrollment.
   */
  async create(
    orgId: string,
    dto: CreateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const existing = await this.findByEmail(orgId, dto.email);

    if (existing) {
      throw new ConflictException(
        `An employee with email ${dto.email} already exists in your organization`,
      );
    }

    const employee = await this.employeeModel.create({
      orgId,
      name: dto.name,
      email: dto.email.toLowerCase(),
      role: dto.role ?? 'employee',
      descriptor: dto.descriptor,
      pineconeId: null,
      isActive: true,
      defaultLocationId: dto.defaultLocationId ?? null,
      faceQualityScore: dto.faceQualityScore ?? null,
      faceQualityLabel: dto.faceQualityLabel ?? null,
      phone: dto.phone ?? null,
    });

    // Auto-enroll in Pinecone if FaceRecognitionService is available.
    // @Optional() injection means this is null when Pinecone isn't configured —
    // the employee is still created in MongoDB, just without a vector.
    // They can be enrolled later via POST /api/face-recognition/bulk-enroll.
    if (this.faceRecognitionService) {
      try {
        await this.faceRecognitionService.upsertVector(
          orgId,
          employee._id.toString(),
          employee.name,
          dto.descriptor,
        );
      } catch (err) {
        // Don't fail the whole create if Pinecone is temporarily unavailable.
        // Log the error and continue — the employee exists in MongoDB.
        this.logger.warn(
          `Pinecone enrollment failed for ${employee.name} — will need manual re-enrollment. Error: ${err}`,
        );
      }
    }

    this.logger.log(`Employee created: ${dto.name} (${orgId})`);
    return employee;
  }

  /**
   * Updates employee fields. PATCH semantics — only provided fields change.
   * Org-scoped: can't update an employee from another org.
   */
  async update(
    orgId: string,
    employeeId: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeDocument> {
    const employee = await this.employeeModel
      .findOneAndUpdate(
        { _id: employeeId, orgId },
        { $set: dto },
        { new: true }, // return the updated document, not the original
      )
      .exec();

    if (!employee) {
      throw new NotFoundException(
        `Employee ${employeeId} not found in your organization`,
      );
    }

    this.logger.log(`Employee updated: ${employeeId}`);
    return employee;
  }

  /**
   * Soft delete — sets isActive: false instead of removing from DB.
   * Preserves historical attendance data while stopping future recognition.
   * Hard delete is available via hardDelete() for GDPR compliance.
   */
  async softDelete(orgId: string, employeeId: string): Promise<void> {
    const result = await this.employeeModel
      .findOneAndUpdate(
        { _id: employeeId, orgId },
        { isActive: false },
        { new: true },
      )
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Employee ${employeeId} not found in your organization`,
      );
    }

    this.logger.log(`Employee deactivated: ${employeeId}`);
  }

  /**
   * Hard delete — permanently removes the employee and their face data.
   * Used for GDPR "right to erasure" requests.
   * Note: attendance logs are NOT deleted here — handled separately.
   */
  async hardDelete(orgId: string, employeeId: string): Promise<void> {
    const result = await this.employeeModel
      .findOneAndDelete({ _id: employeeId, orgId })
      .exec();

    if (!result) {
      throw new NotFoundException(
        `Employee ${employeeId} not found in your organization`,
      );
    }

    this.logger.log(`Employee permanently deleted: ${employeeId}`);
  }

  /**
   * Returns all employees WITH their descriptors.
   * Used ONLY by FaceRecognitionService (Phase 4) for Pinecone enrollment.
   * Not exposed via HTTP endpoint.
   */
  async findAllWithDescriptors(orgId: string): Promise<EmployeeDocument[]> {
    return this.employeeModel.find({ orgId, isActive: true }).exec();
  }

  /**
   * Sets the pineconeId after face enrollment in Pinecone (Phase 4).
   * Called by FaceRecognitionService after upserting the vector.
   */
  async setPineconeId(
    orgId: string,
    employeeId: string,
    pineconeId: string,
  ): Promise<void> {
    await this.employeeModel
      .findOneAndUpdate({ _id: employeeId, orgId }, { pineconeId })
      .exec();
  }

  /**
   * Count of active employees in an org.
   * Used by the dashboard stats endpoint and plan limit checks.
   */
  async countActive(orgId: string): Promise<number> {
    return this.employeeModel.countDocuments({ orgId, isActive: true }).exec();
  }
}
