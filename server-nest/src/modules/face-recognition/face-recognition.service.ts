import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';
import type { Index } from '@pinecone-database/pinecone';
import { EmployeesService } from '../employees/employees.service.js';

/**
 * Match result returned to the kiosk.
 */
export interface FaceMatchResult {
  matched: boolean;
  employeeId: string | null;
  name: string | null;
  confidence: number; // cosine similarity score 0–1
  message: string;
}

/**
 * DEFAULT_THRESHOLD — minimum cosine similarity to accept a match.
 * 0.75 is the sweet spot: high enough to reject lookalikes,
 * low enough to handle lighting/angle variation.
 * Overridable per-request via MatchFaceDto.threshold.
 */
const DEFAULT_THRESHOLD = 0.75;

/**
 * PINECONE_NAMESPACE_PREFIX — each org gets its own namespace.
 * Format: 'org_<orgId>'
 * Pinecone namespaces are like logical partitions within one index.
 * Queries in namespace 'org_abc' never see vectors from 'org_xyz'.
 * This is our Pinecone-level multi-tenancy enforcement.
 *
 * Alternative would be separate indexes per org — but free tier
 * only allows 1 index, so we use namespaces instead.
 */
const namespace = (orgId: string) => `org_${orgId}`;

/**
 * VECTOR_ID format: '<orgId>#<employeeId>'
 * Self-describing — readable in Pinecone's dashboard.
 * The # separator lets us split it back into parts if needed.
 */
const vectorId = (orgId: string, employeeId: string) =>
  `${orgId}#${employeeId}`;

/**
 * FaceRecognitionService — server-side face matching via Pinecone.
 *
 * This is the core upgrade from the prototype.
 * The prototype ran face-api.js matching in the browser:
 *   - Loop over all employee descriptors
 *   - Compute Euclidean distance for each
 *   - Find the minimum
 *   → O(n) per frame, runs in the browser, breaks with >100 employees
 *
 * Our approach runs on the server:
 *   - Employee descriptor → stored as a vector in Pinecone
 *   - Kiosk sends descriptor → Pinecone similarity search (topK=1)
 *   - Pinecone returns the nearest vector + cosine similarity score
 *   → Sub-50ms at any scale, runs server-side, no browser compute
 *
 * OnModuleInit:
 *   NestJS calls onModuleInit() after the module is fully wired.
 *   We use it to initialize the Pinecone client and get a handle
 *   to our index. If Pinecone isn't configured (empty API key),
 *   we log a warning but don't crash — the server still boots,
 *   and other features work. The face-recognition endpoints will
 *   return 503 until Pinecone is configured.
 *
 * Interview answer:
 * "We use Pinecone namespaces for multi-tenancy — each org's face vectors
 *  live in their own namespace within a single Pinecone index. This keeps
 *  us on the free tier (1 index) while ensuring zero cross-org data leakage.
 *  A kiosk query only searches within its org's namespace."
 */
@Injectable()
export class FaceRecognitionService implements OnModuleInit {
  private readonly logger = new Logger(FaceRecognitionService.name);
  private pinecone: Pinecone | null = null;
  private index: Index | null = null;
  private isReady = false;

  constructor(
    private readonly config: ConfigService,
    private readonly employeesService: EmployeesService,
  ) {}

  /**
   * Called automatically by NestJS after DI wiring is complete.
   * Initializes the Pinecone client and connects to the index.
   * Fails gracefully if PINECONE_API_KEY is not set.
   */
  async onModuleInit(): Promise<void> {
    const apiKey = this.config.get<string>('PINECONE_API_KEY');
    const indexName =
      this.config.get<string>('PINECONE_INDEX_NAME') ?? 'facialio';

    if (!apiKey) {
      this.logger.warn(
        'PINECONE_API_KEY not set — face recognition endpoints will return 503. ' +
          'Set the key in .env to enable Pinecone.',
      );
      return;
    }

    try {
      this.pinecone = new Pinecone({ apiKey });
      this.index = this.pinecone.index(indexName);
      this.isReady = true;
      this.logger.log(`Pinecone connected — index: "${indexName}"`);
    } catch (err) {
      this.logger.error('Failed to connect to Pinecone', err);
    }
  }

  /**
   * Throws 503 if Pinecone is not initialized.
   * Called at the start of every method that needs Pinecone.
   */
  private assertReady(): void {
    if (!this.isReady || !this.index) {
      throw new ServiceUnavailableException(
        'Face recognition service is not available. ' +
          'Please configure PINECONE_API_KEY in your environment.',
      );
    }
  }

  /**
   * upsertVector — stores or updates a face descriptor in Pinecone.
   *
   * "Upsert" = insert if not exists, update if exists.
   * Pinecone's upsert() handles this automatically.
   *
   * Called when:
   *   - A new employee is registered (POST /api/employees)
   *   - An employee's face is re-enrolled (POST /api/face-recognition/enroll)
   *
   * metadata stored with the vector:
   *   { orgId, employeeId, name }
   *   — returned with the match result so we know who matched
   *     without a second MongoDB lookup.
   *
   * After upserting, we update the employee's pineconeId in MongoDB.
   */
  async upsertVector(
    orgId: string,
    employeeId: string,
    employeeName: string,
    descriptor: number[],
  ): Promise<void> {
    this.assertReady();

    const id = vectorId(orgId, employeeId);
    const ns = this.index!.namespace(namespace(orgId));

    await ns.upsert({
      records: [
        {
          id,
          values: descriptor,
          metadata: {
            orgId,
            employeeId,
            name: employeeName,
          },
        },
      ],
    });

    // Update MongoDB so we know this employee has a Pinecone vector
    await this.employeesService.setPineconeId(orgId, employeeId, id);

    this.logger.log(`Vector upserted: ${id} (${employeeName})`);
  }

  /**
   * matchFace — the core recognition query.
   *
   * Sends the descriptor to Pinecone as a query vector.
   * Pinecone finds the topK=1 nearest vector in the org's namespace
   * using cosine similarity.
   *
   * Returns:
   *   matched: true/false
   *   employeeId, name — from vector metadata (no DB lookup needed)
   *   confidence — Pinecone's score (0–1)
   *   message — human-readable result string for the kiosk UI
   *
   * includeMetadata: true — required so we get name/employeeId back.
   * Without it Pinecone only returns the vector ID and score.
   */
  async matchFace(
    orgId: string,
    descriptor: number[],
    threshold: number = DEFAULT_THRESHOLD,
  ): Promise<FaceMatchResult> {
    this.assertReady();

    const ns = this.index!.namespace(namespace(orgId));

    const result = await ns.query({
      vector: descriptor,
      topK: 1,
      includeMetadata: true,
    });

    const match = result.matches?.[0];

    // No vectors in this org's namespace yet
    if (!match) {
      return {
        matched: false,
        employeeId: null,
        name: null,
        confidence: 0,
        message: 'No enrolled faces found for this organization.',
      };
    }

    const confidence = match.score ?? 0;

    // Below threshold = unknown face
    if (confidence < threshold) {
      return {
        matched: false,
        employeeId: null,
        name: null,
        confidence,
        message: `Face not recognized (confidence: ${(confidence * 100).toFixed(1)}%)`,
      };
    }

    const meta = match.metadata as {
      employeeId: string;
      name: string;
      orgId: string;
    };

    this.logger.log(
      `Face matched: ${meta.name} (score: ${confidence.toFixed(3)})`,
    );

    return {
      matched: true,
      employeeId: meta.employeeId,
      name: meta.name,
      confidence,
      message: `Welcome, ${meta.name}! (${(confidence * 100).toFixed(1)}% confidence)`,
    };
  }

  /**
   * deleteVector — removes an employee's face vector from Pinecone.
   *
   * Called when an employee is hard-deleted (GDPR erasure).
   * Soft delete does NOT remove the vector — the employee is just
   * deactivated in MongoDB, Pinecone still has their vector.
   * This is intentional: if the employee is reactivated, their
   * face still works without re-enrollment.
   */
  async deleteVector(orgId: string, employeeId: string): Promise<void> {
    this.assertReady();

    const id = vectorId(orgId, employeeId);
    const ns = this.index!.namespace(namespace(orgId));

    await ns.deleteOne({ id });

    this.logger.log(`Vector deleted: ${id}`);
  }

  /**
   * deleteAllVectorsForOrg — removes ALL vectors for an org.
   * Called when an org is deleted (Clerk webhook: organization.deleted).
   * Pinecone's deleteAll() on a namespace removes everything in it.
   */
  async deleteAllVectorsForOrg(orgId: string): Promise<void> {
    this.assertReady();

    const ns = this.index!.namespace(namespace(orgId));
    await ns.deleteAll();

    this.logger.warn(`All vectors deleted for org: ${orgId}`);
  }

  /**
   * bulkEnroll — upserts all existing employees' vectors into Pinecone.
   *
   * Used when:
   *   - An org first sets up Pinecone after already having employees
   *   - A Pinecone index is reset and needs to be repopulated
   *
   * Processes employees in batches of 100 (Pinecone upsert limit per call).
   */
  async bulkEnroll(orgId: string): Promise<{ enrolled: number }> {
    this.assertReady();

    const employees = await this.employeesService.findAllWithDescriptors(orgId);
    const BATCH_SIZE = 100;
    let enrolled = 0;

    const ns = this.index!.namespace(namespace(orgId));

    for (let i = 0; i < employees.length; i += BATCH_SIZE) {
      const batch = employees.slice(i, i + BATCH_SIZE);

      const vectors = batch
        .filter((e) => e.descriptor && e.descriptor.length === 128)
        .map((e) => ({
          id: vectorId(orgId, e._id.toString()),
          values: e.descriptor,
          metadata: {
            orgId,
            employeeId: e._id.toString(),
            name: e.name,
          },
        }));

      if (vectors.length > 0) {
        await ns.upsert({ records: vectors });
        enrolled += vectors.length;
      }
    }

    this.logger.log(`Bulk enrollment complete: ${enrolled} vectors for org ${orgId}`);
    return { enrolled };
  }

  /**
   * Exposes the ready state — used by the health check route.
   */
  get ready(): boolean {
    return this.isReady;
  }
}
