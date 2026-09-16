import * as faceapi from 'face-api.js';

/**
 * Liveness Detection — software-based anti-spoofing
 *
 * Approach: challenge-response using facial landmarks.
 * The 68-point landmark model is already loaded by FaceApiContext.
 *
 * Two challenges (one is randomly picked per session):
 *   BLINK  — eye aspect ratio (EAR) drops below threshold when eyes close
 *   TURN   — nose tip X shifts significantly left or right of eye midpoint
 *
 * Why this works against the most common spoofing attempts:
 *   - Printed photo  → cannot blink or turn
 *   - Static screen  → cannot blink or turn
 *   - Replay attack  → random challenge selection makes pre-recording harder
 *
 * Limitation: a live video loop of someone doing the challenge could pass.
 * Depth-sensor liveness (Face ID) is the only true solution.
 * For the target market (SMBs, schools) this is sufficient.
 */

export type LivenessChallenge = 'blink' | 'turn_left' | 'turn_right';

export interface LivenessResult {
  passed: boolean;
  challenge: LivenessChallenge;
}

// ── Landmark index constants (68-point model) ────────────────────────────
// Left eye:  points 36–41
// Right eye: points 42–47
// Nose tip:  point 30
// Left eye outer corner:  36
// Right eye outer corner: 45

const EAR_BLINK_THRESHOLD = 0.22;   // below this = eyes closed
const HEAD_TURN_RATIO     = 0.15;   // nose shifts >15% of eye span = turned

/** Eye Aspect Ratio — ratio of eye height to width */
const eyeAspectRatio = (pts: faceapi.Point[], start: number): number => {
  // Vertical distances (two pairs)
  const v1 = dist(pts[start + 1], pts[start + 5]);
  const v2 = dist(pts[start + 2], pts[start + 4]);
  // Horizontal distance
  const h  = dist(pts[start],     pts[start + 3]);
  return (v1 + v2) / (2.0 * h);
};

const dist = (a: faceapi.Point, b: faceapi.Point): number =>
  Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

/** Returns true if both eyes are currently closed */
export const eyesClosed = (landmarks: faceapi.FaceLandmarks68): boolean => {
  const pts = landmarks.positions;
  const leftEAR  = eyeAspectRatio(pts, 36);
  const rightEAR = eyeAspectRatio(pts, 42);
  return (leftEAR + rightEAR) / 2 < EAR_BLINK_THRESHOLD;
};

/**
 * Returns head turn direction based on nose tip position relative to eye midpoint.
 * Negative = turned left, Positive = turned right, 0 = facing forward
 */
export const headTurnDirection = (landmarks: faceapi.FaceLandmarks68): 'left' | 'right' | 'center' => {
  const pts       = landmarks.positions;
  const noseTip   = pts[30];
  const eyeSpan   = dist(pts[36], pts[45]);
  const eyeMidX   = (pts[36].x + pts[45].x) / 2;
  const ratio     = (noseTip.x - eyeMidX) / eyeSpan;

  if (ratio < -HEAD_TURN_RATIO) return 'left';
  if (ratio >  HEAD_TURN_RATIO) return 'right';
  return 'center';
};

/** Pick a random challenge for this session */
export const randomChallenge = (): LivenessChallenge => {
  const challenges: LivenessChallenge[] = ['blink', 'turn_left', 'turn_right'];
  return challenges[Math.floor(Math.random() * challenges.length)];
};

export const challengeInstruction = (c: LivenessChallenge): string => {
  if (c === 'blink')      return 'Blink your eyes';
  if (c === 'turn_left')  return 'Turn your head left';
  return                         'Turn your head right';
};

export const challengeEmoji = (c: LivenessChallenge): string => {
  if (c === 'blink')      return '👁️';
  if (c === 'turn_left')  return '⬅️';
  return                         '➡️';
};
