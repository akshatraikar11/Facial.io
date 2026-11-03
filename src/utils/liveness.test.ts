import { describe, it, expect } from 'vitest';
import {
  eyesClosed,
  headTurnDirection,
  randomChallenge,
  challengeInstruction,
  challengeEmoji,
  type LivenessChallenge,
} from './liveness';

describe('Liveness Detection Engine', () => {
  describe('randomChallenge', () => {
    it('returns a valid challenge type', () => {
      const validChallenges: LivenessChallenge[] = ['blink', 'turn_left', 'turn_right'];
      for (let i = 0; i < 20; i++) {
        const challenge = randomChallenge();
        expect(validChallenges).toContain(challenge);
      }
    });
  });

  describe('challengeInstruction & challengeEmoji', () => {
    it('returns appropriate user instructions for each challenge', () => {
      expect(challengeInstruction('blink')).toBe('Blink your eyes');
      expect(challengeInstruction('turn_left')).toBe('Turn your head left');
      expect(challengeInstruction('turn_right')).toBe('Turn your head right');
    });

    it('returns appropriate visual cues for each challenge', () => {
      expect(challengeEmoji('blink')).toBe('👁️');
      expect(challengeEmoji('turn_left')).toBe('⬅️');
      expect(challengeEmoji('turn_right')).toBe('➡️');
    });
  });

  describe('eyesClosed with EAR (Eye Aspect Ratio)', () => {
    // Helper to generate 68 mock landmark points
    const createMockLandmarks = (leftEAR: number, rightEAR: number) => {
      const positions = Array.from({ length: 68 }, (_, idx) => ({ x: idx * 5, y: 100 }));

      // Left eye (36..41): width = 20 (x: 100 to 120)
      // EAR = (v1 + v2) / (2 * h)
      // Let h = 20. Then v1 + v2 = 40 * EAR. v1 = v2 = 20 * EAR
      positions[36] = { x: 100, y: 100 };
      positions[37] = { x: 105, y: 100 - 10 * leftEAR };
      positions[38] = { x: 115, y: 100 - 10 * leftEAR };
      positions[39] = { x: 120, y: 100 };
      positions[40] = { x: 115, y: 100 + 10 * leftEAR };
      positions[41] = { x: 105, y: 100 + 10 * leftEAR };

      // Right eye (42..47): width = 20 (x: 140 to 160)
      positions[42] = { x: 140, y: 100 };
      positions[43] = { x: 145, y: 100 - 10 * rightEAR };
      positions[44] = { x: 155, y: 100 - 10 * rightEAR };
      positions[45] = { x: 160, y: 100 };
      positions[46] = { x: 155, y: 100 + 10 * rightEAR };
      positions[47] = { x: 145, y: 100 + 10 * rightEAR };

      return { positions } as any;
    };

    it('returns false when eyes are wide open (EAR > 0.22)', () => {
      const openLandmarks = createMockLandmarks(0.35, 0.35);
      expect(eyesClosed(openLandmarks)).toBe(false);
    });

    it('returns true when eyes are closed or blinking (EAR < 0.22)', () => {
      const closedLandmarks = createMockLandmarks(0.12, 0.12);
      expect(eyesClosed(closedLandmarks)).toBe(true);
    });
  });

  describe('headTurnDirection with landmark yaw ratio', () => {
    const createTurnMockLandmarks = (noseOffsetX: number) => {
      const positions = Array.from({ length: 68 }, () => ({ x: 100, y: 100 }));
      // Eye span from point 36 (x: 50) to point 45 (x: 150) -> eyeSpan = 100, midX = 100
      positions[36] = { x: 50, y: 100 };
      positions[45] = { x: 150, y: 100 };

      // Nose tip is point 30
      positions[30] = { x: 100 + noseOffsetX, y: 120 };

      return { positions } as any;
    };

    it('detects forward facing when nose is centered', () => {
      const centerLandmarks = createTurnMockLandmarks(0);
      expect(headTurnDirection(centerLandmarks)).toBe('center');
    });

    it('detects head turned left when nose shifts left past ratio threshold', () => {
      // eyeSpan = 100. HEAD_TURN_RATIO = 0.15. Shift < -15 => left
      const leftTurnLandmarks = createTurnMockLandmarks(-25);
      expect(headTurnDirection(leftTurnLandmarks)).toBe('left');
    });

    it('detects head turned right when nose shifts right past ratio threshold', () => {
      // Shift > +15 => right
      const rightTurnLandmarks = createTurnMockLandmarks(25);
      expect(headTurnDirection(rightTurnLandmarks)).toBe('right');
    });
  });
});
