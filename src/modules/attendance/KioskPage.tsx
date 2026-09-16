import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from '../../components/FaceApiContext';
import { getOptimizedDetectionOptions, DETECTION_INTERVAL_MS } from '../../utils/faceApi';
import {
  randomChallenge, challengeInstruction, challengeEmoji,
  eyesClosed, headTurnDirection,
  type LivenessChallenge,
} from '../../utils/liveness';
import { api } from '../../services/api';
import { enqueue } from '../../utils/offlineQueue';
import { useOfflineQueue } from '../../shared/hooks/useOfflineQueue';
import { CheckCircle, X, ShieldCheck, WifiOff, RefreshCw } from 'lucide-react';

/**
 * KioskPage — face-scanning check-in screen with liveness detection.
 *
 * State machine:
 *   idle        → camera not yet ready
 *   challenge   → showing liveness prompt, waiting for user action
 *   verifying   → liveness passed, now matching face against Pinecone
 *   success     → check-in complete, showing welcome
 *   error       → match failed or API error
 *
 * Liveness challenge is randomly selected per-session (blink / turn left / turn right).
 * After 4s idle the kiosk resets back to challenge state.
 */

type KioskState = 'idle' | 'challenge' | 'verifying' | 'success' | 'error';

const KioskPage = () => {
  const { modelsLoaded } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { pending, isSyncing, isOnline } = useOfflineQueue();

  const [kioskState, setKioskState]     = useState<KioskState>('idle');
  const [status, setStatus]             = useState('Initializing camera...');
  const [challenge, setChallenge]       = useState<LivenessChallenge>('blink');
  const [livenessOk, setLivenessOk]     = useState(false);
  const [lastCheckIn, setLastCheckIn]   = useState<{ name: string; time: Date } | null>(null);
  const [progressPct, setProgressPct]   = useState(0); // challenge progress bar

  const orgId =
    new URLSearchParams(window.location.search).get('org') ??
    (import.meta.env?.VITE_KIOSK_ORG_ID as string | undefined) ??
    '';

  const locationId =
    new URLSearchParams(window.location.search).get('location') ?? '';

  // ── Camera ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!orgId) {
        setStatus('No org configured. Add ?org=<orgId> to the URL.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) videoRef.current.srcObject = stream;
        resetToChallenge();
      } catch {
        if (mounted) setStatus('Camera access denied. Please allow camera permission.');
      }
    };

    startCamera();
    return () => {
      mounted = false;
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [orgId]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resetToChallenge = useCallback(() => {
    const c = randomChallenge();
    setChallenge(c);
    setLivenessOk(false);
    setLastCheckIn(null);
    setProgressPct(0);
    setStatus(challengeInstruction(c));
    setKioskState('challenge');
  }, []);

  // ── Check-in after liveness passed ───────────────────────────────────────
  const handleMatch = useCallback(async (descriptor: Float32Array) => {
    if (!orgId) return;
    setKioskState('verifying');
    setStatus('Verifying identity...');

    try {
      const matchResult = await api.post<{
        matched: boolean; message: string;
        employeeId: string | null; name: string | null; confidence: number;
      }>('/face-recognition/match', {
        orgId,
        descriptor: Array.from(descriptor),
      });

      const result = matchResult.data;

      if (!result.matched) {
        setKioskState('error');
        setStatus(result.message ?? 'Face not recognized.');
        setTimeout(resetToChallenge, 3000);
        return;
      }

      try {
        await api.post('/attendance/check-in', {
          orgId,
          employeeId: result.employeeId,
          name: result.name,
          ...(locationId ? { locationId } : {}),
        });
      } catch (checkInErr: unknown) {
        // Network failed on check-in — queue it for later sync
        const isNetworkError =
          checkInErr instanceof Error &&
          (checkInErr.message.includes('Network') || checkInErr.message.includes('fetch'));

        if (isNetworkError && result.employeeId && result.name) {
          await enqueue({ orgId, employeeId: result.employeeId, name: result.name, queuedAt: Date.now(), locationId: locationId || undefined });
          setLastCheckIn({ name: result.name, time: new Date() });
          setKioskState('success');
          setStatus(`Welcome, ${result.name}! (saved offline)`);
          setTimeout(resetToChallenge, 4000);
          return;
        }
        throw checkInErr;
      }

      setLastCheckIn({ name: result.name!, time: new Date() });
      setKioskState('success');
      setStatus(`Welcome, ${result.name}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setKioskState('error');
      setStatus(
        msg.toLowerCase().includes('already checked in')
          ? 'Already checked in today'
          : `Error: ${msg}`,
      );
    }

    setTimeout(resetToChallenge, 4000);
  }, [orgId, resetToChallenge]);

  // ── Detection loop ────────────────────────────────────────────────────────
  // Two phases:
  //   1. Challenge phase  — scan landmarks, check for blink or head turn
  //   2. Post-liveness    — capture descriptor and call handleMatch once
  const matchCalledRef = useRef(false);

  useEffect(() => {
    let active = true;
    // Track consecutive frames where challenge condition is met (smoothing)
    let conditionFrames = 0;
    const REQUIRED_FRAMES = 3; // must hold the action for 3 frames to avoid false positives

    const detect = async () => {
      if (!active || !modelsLoaded || !videoRef.current) return;
      if (videoRef.current.paused || !videoRef.current.srcObject) {
        setTimeout(detect, DETECTION_INTERVAL_MS);
        return;
      }

      // ── Phase 2: liveness passed, grab descriptor ──
      if (livenessOk && kioskState === 'challenge') {
        if (matchCalledRef.current) return;
        matchCalledRef.current = true;
        try {
          const det = await faceapi
            .detectSingleFace(videoRef.current, getOptimizedDetectionOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (active && det) {
            await handleMatch(det.descriptor);
          } else if (active) {
            // Face disappeared right after liveness — retry
            setLivenessOk(false);
            matchCalledRef.current = false;
            setTimeout(detect, DETECTION_INTERVAL_MS);
          }
        } catch {
          matchCalledRef.current = false;
          setTimeout(detect, DETECTION_INTERVAL_MS);
        }
        return;
      }

      // ── Phase 1: liveness challenge ──
      if (kioskState !== 'challenge' || livenessOk) return;

      try {
        const det = await faceapi
          .detectSingleFace(videoRef.current, getOptimizedDetectionOptions())
          .withFaceLandmarks();

        if (!active) return;

        if (!det) {
          conditionFrames = 0;
          setProgressPct(0);
          if (active) setTimeout(detect, DETECTION_INTERVAL_MS);
          return;
        }

        const landmarks = det.landmarks;
        let conditionMet = false;

        if (challenge === 'blink') {
          conditionMet = eyesClosed(landmarks);
        } else if (challenge === 'turn_left') {
          conditionMet = headTurnDirection(landmarks) === 'left';
        } else {
          conditionMet = headTurnDirection(landmarks) === 'right';
        }

        if (conditionMet) {
          conditionFrames++;
          setProgressPct(Math.min(100, (conditionFrames / REQUIRED_FRAMES) * 100));
        } else {
          conditionFrames = Math.max(0, conditionFrames - 1);
          setProgressPct(Math.max(0, (conditionFrames / REQUIRED_FRAMES) * 100));
        }

        if (conditionFrames >= REQUIRED_FRAMES) {
          setLivenessOk(true);
          setStatus('Liveness verified ✓ Scanning...');
        }
      } catch { /* frame not ready */ }

      if (active) setTimeout(detect, DETECTION_INTERVAL_MS);
    };

    if (kioskState === 'challenge' && modelsLoaded) {
      matchCalledRef.current = false;
      detect();
    }

    return () => { active = false; };
  }, [kioskState, livenessOk, challenge, modelsLoaded, handleMatch]);

  // ── Derived UI values ─────────────────────────────────────────────────────
  const dotColor =
    kioskState === 'success'   ? '#22c55e' :
    kioskState === 'verifying' ? '#3b82f6' :
    kioskState === 'error'     ? '#ef4444' :
    kioskState === 'challenge' ? '#eab308' : '#666';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '640px', padding: '24px' }}>
        <div style={{ background: '#111', border: '1px solid #222', borderRadius: '32px',
          overflow: 'hidden', color: '#fff' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%',
                display: 'inline-block', background: dotColor }} />
              <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em', color: '#666' }}>
                FACIAL.IO KIOSK{locationId ? ` — ${locationId.replace(/-/g, ' ').toUpperCase()}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Offline / sync indicator */}
              {!isOnline && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: 700, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: '99px',
                  border: '1px solid rgba(245,158,11,0.3)' }}>
                  <WifiOff size={11} /> OFFLINE
                </span>
              )}
              {isOnline && isSyncing && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: 700, color: '#3b82f6',
                  background: 'rgba(59,130,246,0.1)', padding: '3px 10px', borderRadius: '99px',
                  border: '1px solid rgba(59,130,246,0.3)' }}>
                  <RefreshCw size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                  SYNCING {pending}
                </span>
              )}
              {isOnline && !isSyncing && pending > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: 700, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)', padding: '3px 10px', borderRadius: '99px',
                  border: '1px solid rgba(245,158,11,0.3)' }}>
                  {pending} queued
                </span>
              )}
              <a href="/" style={{ color: '#444', textDecoration: 'none' }}><X size={18} /></a>
            </div>
          </div>

          {/* Video / overlays */}
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', margin: '0 16px' }}>

            {/* Success overlay */}
            {kioskState === 'success' && lastCheckIn ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#0a0a0a' }}>
                <CheckCircle size={64} color="#22c55e" />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Welcome, {lastCheckIn.name}</p>
                  <p style={{ margin: '4px 0 0', color: '#666' }}>{lastCheckIn.time.toLocaleTimeString()}</p>
                </div>
              </div>
            ) : (
              <video ref={videoRef} autoPlay muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            )}

            {/* Scan guide frame */}
            {kioskState === 'challenge' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '160px', height: '160px',
                border: `2px solid ${livenessOk ? '#22c55e' : 'rgba(11,87,208,0.7)'}`,
                borderRadius: '16px', pointerEvents: 'none',
                transition: 'border-color 0.2s',
              }} />
            )}

            {/* Liveness shield badge */}
            {kioskState === 'verifying' && (
              <div style={{ position: 'absolute', top: '12px', right: '12px',
                background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e',
                borderRadius: '8px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', fontWeight: 700, color: '#22c55e' }}>
                <ShieldCheck size={12} /> LIVE
              </div>
            )}

            {/* Status pill */}
            <div style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
              padding: '6px 16px', borderRadius: '99px',
              fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap',
            }}>
              {status}
            </div>
          </div>

          {/* Challenge prompt + progress bar */}
          {kioskState === 'challenge' && !livenessOk && (
            <div style={{ margin: '16px 16px 0', padding: '14px 18px', background: '#1a1a1a',
              borderRadius: '16px', border: '1px solid #2a2a2a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '22px' }}>{challengeEmoji(challenge)}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                    Liveness Check
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>
                    {challengeInstruction(challenge)} to proceed
                  </p>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700,
                  color: '#555', letterSpacing: '0.06em' }}>
                  ANTI-SPOOF
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ height: '4px', background: '#2a2a2a', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px',
                  background: progressPct >= 100 ? '#22c55e' : '#0b57d0',
                  width: `${progressPct}%`,
                  transition: 'width 0.1s ease, background 0.2s',
                }} />
              </div>
            </div>
          )}

          <p style={{ textAlign: 'center', color: '#444', fontSize: '12px', padding: '16px 20px 20px' }}>
            Look directly at the camera · Ensure good lighting
          </p>
        </div>
      </div>
    </div>
  );
};

export default KioskPage;
