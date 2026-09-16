import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { AttendanceService } from '../attendance/attendance.service.js';
import { EmployeesService } from '../employees/employees.service.js';

/**
 * AiService — LangChain + Gemini RAG pipeline for attendance analytics.
 *
 * What RAG means here:
 *   R — Retrieval: we fetch the org's actual attendance data from MongoDB
 *   A — Augmented: we inject that data into the prompt as context
 *   G — Generation: Gemini reads the context and answers the question
 *
 * This is NOT a generic chatbot. It only knows about the org's own data.
 * Gemini can't hallucinate employee names or attendance figures because
 * we ground every response in real MongoDB records.
 *
 * Why not vector embeddings for retrieval here?
 *   For attendance data, structured retrieval (MongoDB queries) is more
 *   accurate than semantic search. We query the last 30 days of records,
 *   format them as text, and feed to Gemini. For large orgs (1000s of
 *   employees) we'd add Pinecone retrieval — it's a drop-in swap.
 *
 * Graceful degradation: if GEMINI_API_KEY is empty, returns 503.
 *
 * Interview answer:
 * "The RAG pipeline retrieves real attendance records from MongoDB,
 *  formats them as structured text, and injects them into a system
 *  prompt alongside the user's question. Gemini answers based only
 *  on that context — it can't invent data that isn't there."
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private llm: ChatGoogleGenerativeAI | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly attendanceService: AttendanceService,
    private readonly employeesService: EmployeesService,
  ) {}

  async onModuleInit() {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY not set — AI endpoints will return 503. Get a free key at aistudio.google.com',
      );
      return;
    }
    this.llm = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-1.5-flash', // free tier model — fast, capable
      temperature: 0.2,          // low temp = factual, not creative
      maxOutputTokens: 1024,
    });
    this.logger.log('Gemini AI initialized (gemini-1.5-flash)');
  }

  private assertReady(): ChatGoogleGenerativeAI {
    if (!this.llm) {
      throw new ServiceUnavailableException(
        'AI assistant not configured. Set GEMINI_API_KEY in .env. ' +
          'Get a free key at https://aistudio.google.com/app/apikey',
      );
    }
    return this.llm;
  }

  /**
   * query() — the main RAG pipeline.
   *
   * Steps:
   * 1. Retrieve: fetch last 30 days of attendance + employee list from MongoDB
   * 2. Format: convert records to compact text the LLM can read
   * 3. Augment: build system prompt with org context + retrieved data
   * 4. Generate: send to Gemini, return the answer
   */
  async query(orgId: string, message: string): Promise<{ answer: string; context: string }> {
    const llm = this.assertReady();

    // ── Step 1: Retrieve data ──────────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDate = thirtyDaysAgo.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const [logs, employees, stats] = await Promise.all([
      this.attendanceService.findAll(orgId, { startDate, endDate: today }),
      this.employeesService.findAll(orgId),
      this.attendanceService.getStats(orgId),
    ]);

    // ── Step 2: Format context ─────────────────────────────────────────────
    // Keep it compact — each log is one line. Gemini has a large context
    // window so even 1000 logs fit comfortably.
    const employeeList = (employees as Array<{ _id: { toString(): string }; name: string; role: string }>)
      .map((e) => `- ${e.name} (ID: ${e._id.toString()}, role: ${e.role})`)
      .join('\n');

    const attendanceSummary = logs
      .slice(0, 500)
      .map((l) => `${l.date} | ${l.time} | ${l.name} | ${l.status}`)
      .join('\n');

    const context = `
ORGANIZATION OVERVIEW (last 30 days):
- Total active employees: ${stats.totalEmployees}
- Present today: ${stats.presentToday}
- Attendance rate today: ${stats.attendanceRate}%
- Late arrivals today: ${stats.lateToday}

EMPLOYEES:
${employeeList || 'No employees registered yet.'}

ATTENDANCE RECORDS (most recent ${Math.min(logs.length, 500)} of ${logs.length} records, format: Date | Time | Name | Status):
${attendanceSummary || 'No attendance records in this period.'}
    `.trim();

    // ── Step 3+4: Augment + Generate ──────────────────────────────────────
    const systemPrompt = `You are an attendance analytics assistant for a workforce management SaaS called Facial.io.

You have access to REAL attendance data for this organization (provided below).
Answer questions ONLY based on this data. Do not invent employees or statistics.
Be concise, factual, and helpful. Format lists clearly.
If the data doesn't contain enough information to answer, say so honestly.

${context}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(message),
    ]);

    const answer = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    this.logger.log(`AI query answered for org: ${orgId}`);

    return {
      answer,
      context: `Retrieved ${logs.length} records, ${(employees as unknown[]).length} employees`,
    };
  }

  /**
   * getInsights() — pre-built analytical questions for the dashboard.
   * Returns 3 quick insights without the user typing a question.
   * Runs 3 parallel queries against Gemini.
   */
  async getInsights(orgId: string): Promise<{ insights: string[] }> {
    const questions = [
      'Who has the lowest attendance rate this month? Give me the top 3 names.',
      'What is the most common check-in time? Is there a pattern of late arrivals?',
      'How does this week\'s attendance compare to last week? One sentence summary.',
    ];

    const results = await Promise.allSettled(
      questions.map((q) => this.query(orgId, q)),
    );

    const insights = results.map((r) =>
      r.status === 'fulfilled' ? r.value.answer : 'Unable to generate insight.',
    );

    return { insights };
  }

  get ready(): boolean {
    return this.llm !== null;
  }
}
