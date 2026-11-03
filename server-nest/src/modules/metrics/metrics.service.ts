import { Injectable } from '@nestjs/common';

class MetricCounter {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly labelNames: string[] = [],
  ) {}

  inc(labels: Record<string, string> = {}, val = 1) {
    const key = this.labelNames.map((l) => `${l}="${labels[l] || 'unknown'}"`).join(',');
    this.values.set(key, (this.values.get(key) || 0) + val);
  }

  toPrometheus(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} counter\n`;
    if (this.values.size === 0) {
      out += `${this.name} 0\n`;
      return out;
    }
    for (const [labels, val] of this.values.entries()) {
      out += `${this.name}${labels ? `{${labels}}` : ''} ${val}\n`;
    }
    return out;
  }
}

class MetricHistogram {
  private bucketCounts = new Map<number, number>();
  private sum = 0;
  private count = 0;

  constructor(
    public readonly name: string,
    public readonly help: string,
    public readonly buckets: number[] = [10, 25, 50, 75, 100, 250, 500, 1000],
  ) {}

  observe(val: number) {
    this.count++;
    this.sum += val;
    for (const b of this.buckets) {
      if (val <= b) {
        this.bucketCounts.set(b, (this.bucketCounts.get(b) || 0) + 1);
      }
    }
  }

  toPrometheus(): string {
    let out = `# HELP ${this.name} ${this.help}\n# TYPE ${this.name} histogram\n`;
    for (const b of this.buckets) {
      out += `${this.name}_bucket{le="${b}"} ${this.bucketCounts.get(b) || 0}\n`;
    }
    out += `${this.name}_bucket{le="+Inf"} ${this.count}\n`;
    out += `${this.name}_sum ${this.sum}\n`;
    out += `${this.name}_count ${this.count}\n`;
    return out;
  }
}

@Injectable()
export class MetricsService {
  // Biometric Vector Search Metrics
  readonly faceVerificationsTotal = new MetricCounter(
    'facialio_face_verifications_total',
    'Total biometric face matches processed via Pinecone',
    ['outcome', 'org_id'],
  );

  readonly faceVerificationDurationMs = new MetricHistogram(
    'facialio_face_verification_duration_ms',
    'Latency of Pinecone vector matching in milliseconds',
    [15, 30, 50, 80, 120, 250, 500],
  );

  // Active Anti-Spoofing Liveness Metrics
  readonly livenessChallengesTotal = new MetricCounter(
    'facialio_liveness_challenges_total',
    'Interactive anti-spoofing challenge outcomes',
    ['challenge', 'outcome'],
  );

  // Offline Kiosk Sync Metrics
  readonly offlineSyncEventsTotal = new MetricCounter(
    'facialio_offline_sync_events_total',
    'Offline attendance records synchronized from Dexie IndexedDB',
    ['status'],
  );

  // Attendance Check-in Events
  readonly attendanceRecordsTotal = new MetricCounter(
    'facialio_attendance_records_total',
    'Attendance check-in and check-out events logged',
    ['status', 'method'],
  );

  getMetrics(): string {
    return [
      this.faceVerificationsTotal.toPrometheus(),
      this.faceVerificationDurationMs.toPrometheus(),
      this.livenessChallengesTotal.toPrometheus(),
      this.offlineSyncEventsTotal.toPrometheus(),
      this.attendanceRecordsTotal.toPrometheus(),
      `# Process metrics\nprocess_uptime_seconds ${Math.floor(process.uptime())}\nprocess_memory_heap_bytes ${process.memoryUsage().heapUsed}\n`,
    ].join('\n');
  }
}

