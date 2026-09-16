import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { useMutation } from '@tanstack/react-query';
import { useFaceApi } from '../../components/FaceApiContext';
import { getOptimizedDetectionOptions } from '../../utils/faceApi';
import { computeFaceQuality, qualityColor } from '../../utils/faceQuality';
import type { QualityResult } from '../../utils/faceQuality';
import { api } from '../../services/api';
import { Camera, X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * RegisterFaceModal — captures a face and registers a new employee.
 *
 * Flow:
 *  1. Admin fills in name + email
 *  2. Camera opens, face-api.js detects and extracts descriptor
 *  3. Quality score is computed (confidence × size × pose symmetry)
 *  4. If score is Poor/Fair, a warning is shown — admin can still save or recapture
 *  5. POST /api/employees with { name, email, role, descriptor, faceQualityScore, faceQualityLabel }
 *  6. Server saves to MongoDB + auto-enrolls in Pinecone
 */
const RegisterFaceModal = ({ onClose, onSuccess }: Props) => {
  const { modelsLoaded } = useFaceApi();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [capturing, setCapturing] = useState(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [captureStatus, setCaptureStatus] = useState('');

  // Start camera when modal opens
  useEffect(() => {
    let mounted = true;
    let stream: MediaStream | null = null;

    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 360, facingMode: 'user' },
        });
        if (!mounted) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (mounted) setCaptureStatus('Camera access denied. Please allow camera permission.');
      }
    };

    start();
    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const captureDescriptor = async () => {
    if (!videoRef.current || !modelsLoaded) return;
    setCapturing(true);
    setQuality(null);
    setCaptureStatus('Detecting face...');

    // Try up to 5 times with 500ms delay
    for (let i = 0; i < 5; i++) {
      const detection = await Promise.resolve(
        faceapi
          .detectSingleFace(videoRef.current, getOptimizedDetectionOptions())
          .withFaceLandmarks()
          .withFaceDescriptor(),
      ).catch(() => null);

      if (detection) {
        const vw = videoRef.current.videoWidth  || videoRef.current.clientWidth  || 480;
        const vh = videoRef.current.videoHeight || videoRef.current.clientHeight || 360;
        const q = computeFaceQuality(detection, vw, vh);
        setQuality(q);
        setCapturedDescriptor(Array.from(detection.descriptor));

        if (q.label === 'poor') {
          setCaptureStatus(`Quality: Poor (${q.score}/100) — consider recapturing`);
        } else if (q.label === 'fair') {
          setCaptureStatus(`Quality: Fair (${q.score}/100) — acceptable, but recapture for best results`);
        } else {
          setCaptureStatus(`Quality: Good (${q.score}/100) ✓`);
        }

        setCapturing(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    setCaptureStatus('No face detected. Try again.');
    setCapturing(false);
  };

  const register = useMutation({
    mutationFn: () =>
      api.post('/employees', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        descriptor: capturedDescriptor,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        faceQualityScore: quality?.score ?? null,
        faceQualityLabel: quality?.label ?? null,
      }),
    onSuccess,
  });

  const canSubmit = name.trim() && email.trim() && capturedDescriptor && !register.isPending;

  const qColors = quality ? qualityColor[quality.label] : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--md-sys-color-surface)', borderRadius: '24px',
        width: '100%', maxWidth: '520px', padding: '32px', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px',
          background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
          <X size={20} />
        </button>

        <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: 700 }}>Register Employee</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)}
            style={inputStyle} />
          <input placeholder="Email address" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input placeholder="Phone number (for WhatsApp/SMS alerts, optional)"
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          <select value={role} onChange={(e) => setRole(e.target.value as any)} style={inputStyle}>
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        {/* Camera */}
        <div style={{ position: 'relative', borderRadius: '16px', overflow: 'hidden',
          background: '#000', aspectRatio: '4/3', marginBottom: '12px' }}>
          <video ref={videoRef} autoPlay muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          {capturedDescriptor && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
              {quality?.label === 'good'
                ? <CheckCircle size={52} color="#22c55e" />
                : quality?.label === 'fair'
                ? <ShieldCheck size={52} color="#fbbc04" />
                : <AlertTriangle size={52} color="#ef4444" />}
            </div>
          )}
        </div>

        {/* Quality score badge */}
        {quality && qColors && (
          <div style={{ marginBottom: '10px', padding: '10px 14px', borderRadius: '12px',
            background: qColors.bg, border: `1px solid ${qColors.dot}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: quality.warnings.length ? '8px' : 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%',
                background: qColors.dot, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontWeight: 700, fontSize: '13px', color: qColors.color }}>
                Face Quality: {quality.label.charAt(0).toUpperCase() + quality.label.slice(1)} ({quality.score}/100)
              </span>
            </div>
            {quality.warnings.map((w, i) => (
              <p key={i} style={{ margin: '3px 0 0 16px', fontSize: '12px', color: qColors.color }}>
                ⚠ {w}
              </p>
            ))}
          </div>
        )}

        {/* Status text (shown when no quality object yet, e.g. initial attempt) */}
        {captureStatus && !quality && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', textAlign: 'center',
            color: capturedDescriptor ? '#15803d' : '#92400e' }}>{captureStatus}</p>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: quality ? '12px' : '0' }}>
          <button onClick={captureDescriptor} disabled={capturing || !modelsLoaded}
            style={{ flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--md-sys-color-outline)',
              background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Camera size={16} />
            {capturing ? 'Capturing...' : capturedDescriptor ? 'Recapture' : 'Capture Face'}
          </button>
          <button onClick={() => register.mutate()} disabled={!canSubmit}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
              background: canSubmit ? 'var(--md-sys-color-primary)' : '#ccc',
              color: '#fff', cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600, fontSize: '14px' }}>
            {register.isPending ? 'Saving...' : 'Register'}
          </button>
        </div>

        {register.isError && (
          <p style={{ color: 'var(--md-sys-color-error)', fontSize: '13px', marginTop: '10px', textAlign: 'center' }}>
            {(register.error as Error).message}
          </p>
        )}
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: '10px',
  border: '1px solid var(--md-sys-color-outline-variant)',
  fontSize: '14px', background: 'var(--md-sys-color-surface)',
  color: 'var(--md-sys-color-on-surface)', boxSizing: 'border-box',
};

export default RegisterFaceModal;
