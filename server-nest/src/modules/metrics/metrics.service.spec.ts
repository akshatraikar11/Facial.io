import { MetricsService } from './metrics.service.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(() => {
    service = new MetricsService();
  });

  it('records face verification counter and exports Prometheus text format', () => {
    service.faceVerificationsTotal.inc({ outcome: 'matched', org_id: 'org_123' });
    const output = service.getMetrics();

    expect(output).toContain('facialio_face_verifications_total');
    expect(output).toContain('outcome="matched"');
    expect(output).toContain('process_uptime_seconds');
  });

  it('records face verification latency histogram', () => {
    service.faceVerificationDurationMs.observe(45);
    const output = service.getMetrics();

    expect(output).toContain('facialio_face_verification_duration_ms_bucket{le="50"} 1');
    expect(output).toContain('facialio_face_verification_duration_ms_count 1');
  });

  it('records anti-spoofing liveness challenge counters', () => {
    service.livenessChallengesTotal.inc({ challenge: 'blink', outcome: 'success' });
    const output = service.getMetrics();

    expect(output).toContain('facialio_liveness_challenges_total{challenge="blink",outcome="success"} 1');
  });
});

