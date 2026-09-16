import * as faceapi from 'face-api.js';

/**
 * Face enrollment quality score — computed client-side at registration time.
 *
 * We analyse three signals from a single detection result:
 *
 * 1. Detection confidence (0–1)
 *    The SSD MobileNet score for the face bounding box.
 *    Low confidence = blurry, partially visible, or very small face.
 *
 * 2. Face size relative to frame
 *    Small faces have less texture information, leading to poor descriptors.
 *    We check (box area) / (video area). Ideal is 15–60 % of frame.
 *
 * 3. Pose symmetry (landmark-based)
 *    We compare left-eye to right-eye distances from the nose centre.
 *    A significantly asymmetric reading means the head is turned away.
 *    score = min(left,right) / max(left,right) — ideal is close to 1.0.
 *
 * Final score: weighted average → 0–100.
 * Labels: Good ≥ 70 | Fair 40–69 | Poor < 40
 *
 * Why client-side?
 *   The face-api.js detection runs in the browser. We have direct access to
 *   the detection score and landmarks without an extra round-trip.
 *   The quality score travels with the descriptor in the POST /employees body.
 */

export type QualityLabel = 'good' | 'fair' | 'poor';

export interface QualityResult {
  score: number;          // 0–100
  label: QualityLabel;
  warnings: string[];     // human-readable issues
}

export function computeFaceQuality(
  detection: faceapi.WithFaceLandmarks<
    { detection: faceapi.FaceDetection },
    faceapi.FaceLandmarks68
  >,
  videoWidth: number,
  videoHeight: number,
): QualityResult {
  const warnings: string[] = [];

  // ── 1. Detection confidence ──────────────────────────────────────────────
  const confidence = detection.detection.score; // 0–1
  const confidenceScore = confidence * 100;
  if (confidence < 0.75) warnings.push('Low detection confidence — try better lighting');

  // ── 2. Face size relative to frame ───────────────────────────────────────
  const box = detection.detection.box;
  const faceArea = box.width * box.height;
  const frameArea = videoWidth * videoHeight;
  const sizeRatio = faceArea / frameArea; // 0–1

  // Penalise faces that are too small (< 8% of frame) or too large (> 70%)
  let sizeScore: number;
  if (sizeRatio < 0.08) {
    sizeScore = (sizeRatio / 0.08) * 60;
    warnings.push('Face too small — move closer to the camera');
  } else if (sizeRatio > 0.70) {
    sizeScore = Math.max(60, 100 - (sizeRatio - 0.70) * 100);
    warnings.push('Face too close — move slightly back');
  } else {
    // Linear scale: 0.08→60, 0.15→100, 0.60→100, 0.70→60
    const mid = 0.15;
    if (sizeRatio < mid) {
      sizeScore = 60 + ((sizeRatio - 0.08) / (mid - 0.08)) * 40;
    } else {
      sizeScore = 100;
    }
  }

  // ── 3. Pose symmetry (yaw estimate) ─────────────────────────────────────
  const landmarks = detection.landmarks;
  const nose = landmarks.getNose();
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  // Nose tip is the last point in the nose array
  const noseTip = nose[nose.length - 1];
  // Eye centres
  const leftEyeCx = leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length;
  const rightEyeCx = rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length;

  const distLeft  = Math.abs(noseTip.x - leftEyeCx);
  const distRight = Math.abs(noseTip.x - rightEyeCx);
  const symmetry  = Math.min(distLeft, distRight) / Math.max(distLeft, distRight);
  const poseScore = symmetry * 100;

  if (symmetry < 0.6) warnings.push('Head turned — face the camera directly');
  else if (symmetry < 0.75) warnings.push('Slight head tilt detected');

  // ── Weighted final score ─────────────────────────────────────────────────
  // Confidence 40% | Size 30% | Pose 30%
  const raw = confidenceScore * 0.40 + sizeScore * 0.30 + poseScore * 0.30;
  const score = Math.round(Math.min(100, Math.max(0, raw)));

  const label: QualityLabel =
    score >= 70 ? 'good' :
    score >= 40 ? 'fair' : 'poor';

  return { score, label, warnings };
}

/** Colour + label helpers for UI display */
export const qualityColor: Record<QualityLabel, { bg: string; color: string; dot: string }> = {
  good: { bg: '#e6f4ea', color: '#137333', dot: '#34a853' },
  fair: { bg: '#fef7e0', color: '#7d5700', dot: '#fbbc04' },
  poor: { bg: '#fce8e6', color: '#c5221f', dot: '#ea4335' },
};
