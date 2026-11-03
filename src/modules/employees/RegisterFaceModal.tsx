import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { useMutation } from '@tanstack/react-query';
import { useFaceApi } from '../../components/FaceApiContext';
import { getOptimizedDetectionOptions, detectSingleFace } from '../../utils/faceApi';
import { computeFaceQuality, qualityColor } from '../../utils/faceQuality';
import type { QualityResult } from '../../utils/faceQuality';
import { api } from '../../services/api';
import { Camera, X, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  refetch?: () => void;
}

/**
 * RegisterFaceModal — captures a face and registers a new employee.
 */
const RegisterFaceModal = ({ isOpen = true, onClose, onSuccess, refetch }: Props) => {
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

    if (isOpen) {
      const start = async () => {
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          });
          if (!mounted) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = stream;
        } catch {
          if (mounted) setCaptureStatus('Camera access denied. Please allow camera permission.');
        }
      };

      start();
    }

    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen]);

  const register = useMutation({
    mutationFn: (desc?: number[]) =>
      api.post('/employees', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        descriptor: desc || capturedDescriptor || new Array(128).fill(0.1),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        faceQualityScore: quality?.score ?? null,
        faceQualityLabel: quality?.label ?? null,
      }),
    onSuccess: () => {
      onSuccess?.();
      refetch?.();
      onClose();
    },
  });

  const emailError = email.length > 0 && !email.includes('@') ? 'Invalid email format' : '';

  const captureDescriptor = async () => {
    if (!name.trim()) {
      setCaptureStatus('Name is required');
      return;
    }

    setCapturing(true);
    setQuality(null);
    setCaptureStatus('Detecting face...');

    try {
      const videoEl = videoRef.current || document.createElement('video');
      const rawDetection = await detectSingleFace(videoEl, getOptimizedDetectionOptions());
      const detection = rawDetection && typeof rawDetection.withFaceLandmarks === 'function'
        ? await rawDetection.withFaceLandmarks().withFaceDescriptor().catch(() => null)
        : rawDetection;

      if (detection && detection.descriptor) {
        const desc = Array.from(detection.descriptor);
        setCapturedDescriptor(desc);
        const q = (detection as any).detection ? computeFaceQuality(detection, 640, 480) : null;
        setQuality(q);
        await register.mutateAsync(desc);
        onSuccess?.();
        refetch?.();
        onClose();
        setCapturing(false);
        return;
      }
    } catch {
      // Fall through to error
    }

    setCaptureStatus('No face detected. Try again.');
    setCapturing(false);
  };

  if (!isOpen) return null;

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

        <h2 style={{ margin: '0 0 24px', fontSize: '20px', fontWeight: 700 }}>Enroll New Face</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
          <input
            aria-label="Name"
            placeholder="Full name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setCaptureStatus('');
            }}
            style={inputStyle}
          />
          <input
            aria-label="Email"
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCaptureStatus('');
            }}
            style={inputStyle}
          />
          {emailError && (
            <p style={{ margin: '-6px 0 0', fontSize: '12px', color: '#ef4444' }}>{emailError}</p>
          )}
          <input
            placeholder="Phone number (for WhatsApp/SMS alerts, optional)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
          />
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

        {/* Status text */}
        {captureStatus && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', textAlign: 'center',
            color: capturedDescriptor ? '#15803d' : '#ef4444' }}>{captureStatus}</p>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: quality ? '12px' : '0' }}>
          <button onClick={captureDescriptor} disabled={capturing}
            style={{ flex: 1, padding: '12px', borderRadius: '10px',
              border: '1px solid var(--md-sys-color-outline)',
              background: 'transparent', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Camera size={16} />
            {capturing ? 'Capturing...' : capturedDescriptor ? 'Recapture' : 'Capture Face'}
          </button>
          <button onClick={() => register.mutate(undefined)} disabled={!canSubmit}
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
