import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, UploadCloud, Check, RefreshCw, Sun, Scan } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useFaceApi } from '../components/FaceApiContext';
import { descriptorToArray, saveUser, getUsers } from '../utils/storage';
import { validateRegistrationForm, validateFaceDescriptor } from '../utils/validation.js';

const Register = () => {
  const { modelsLoaded } = useFaceApi();
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('webcam'); // 'webcam' | 'upload'
  const [imagePreview, setImagePreview] = useState(null);
  const [imageReady, setImageReady] = useState(false);
  const [errors, setErrors] = useState({ name: '', email: '' });

  // Multi-angle state
  const [capturedDescriptors, setCapturedDescriptors] = useState([]);
  const steps = [
    { id: 'center', label: 'Front View', instruction: 'Look directly at the camera' },
    { id: 'left', label: 'Left Angle', instruction: 'Turn head slightly left' },
    { id: 'right', label: 'Right Angle', instruction: 'Turn head slightly right' }
  ];
  const currentStepIndex = capturedDescriptors.length;

  useEffect(() => {
    let isMounted = true;

    if (!modelsLoaded || mode !== 'webcam') {
      // If we leave webcam mode, stop any active stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
      return;
    }

    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });

        if (!isMounted) {
          // Component unmounted while waiting for camera
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error accessing camera', err);
          setStatus('Unable to access camera. Please allow camera permission.');
        }
      }
    };

    startVideo();

    return () => {
      isMounted = false;
      const videoEl = videoRef.current;
      if (videoEl && videoEl.srcObject) {
        const tracks = videoEl.srcObject.getTracks();
        tracks.forEach((t) => t.stop());
        videoEl.srcObject = null;
      }
    };
  }, [modelsLoaded, mode]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setImageReady(false);
    setStatus('Image selected. Waiting for it to load...');
  };

  const handleCapture = async () => {
    if (!modelsLoaded) {
      setStatus('Models not ready yet.');
      return;
    }

    // Validate form data only on first step
    if (currentStepIndex === 0) {
      const existingUsers = await getUsers();
      const validation = validateRegistrationForm({ name, email }, existingUsers);

      if (!validation.valid) {
        setErrors(validation.errors);
        setStatus('Please fix the errors before capturing.');
        return;
      }
      setErrors({ name: '', email: '' });
    }

    const source = mode === 'webcam' ? videoRef.current : imageRef.current;

    if (!source) {
      setStatus(mode === 'webcam' ? 'Camera not ready.' : 'Please select an image first.');
      return;
    }

    if (mode === 'upload' && !imageReady) {
      setStatus('Image is still loading. Please wait a second and try again.');
      return;
    }

    setBusy(true);
    setStatus('Detecting face...');

    try {
      const detection = await faceapi
        .detectSingleFace(source, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('No face detected. Try again.');
        setBusy(false);
        return;
      }

      // Validate face descriptor
      const descriptorValidation = validateFaceDescriptor(detection.descriptor);
      if (!descriptorValidation.valid) {
        setStatus(descriptorValidation.message);
        setBusy(false);
        return;
      }

      // Add to captures
      const newCaptures = [...capturedDescriptors, detection.descriptor];
      setCapturedDescriptors(newCaptures);

      if (newCaptures.length === 3) {
        // All angles captured - SAVE
        const descriptorsArrays = newCaptures.map(d => descriptorToArray(d));
        await saveUser({
          name: name.trim(),
          email: email.trim(),
          descriptors: descriptorsArrays,
        });

        setStatus('Registration complete! All 3 angles saved.');
        // Reset form
        setName('');
        setEmail('');
        setCapturedDescriptors([]);
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview);
          setImagePreview(null);
        }
      } else {
        // Move to next step
        setStatus(`Saved! Next: ${steps[newCaptures.length].instruction}`);
        // If in upload mode, user needs to pick new image, so clearer status might be needed
        if (mode === 'upload') {
          setImagePreview(null);
          setImageReady(false);
        }
      }

    } catch (err) {
      console.error(err);
      setStatus('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetCapture = () => {
    setCapturedDescriptors([]);
    setStatus('Capture reset. Starting over.');
  };

  return (
    <section className="page-shell">
      <div className="page-heading">
        <Badge variant="soft">Register faces</Badge>
        <h2>Launch a Google-caliber enrollment flow.</h2>
        <p>
          Capture high-quality samples with guidance, verify on-device, and sync attendance-ready templates in seconds.
        </p>
      </div>

      <div className="split-grid">
        <Card as="form" variant="glass" className="form-card" onSubmit={(e) => e.preventDefault()}>
          <label className="form-label">Full name</label>
          <input
            className="input-field"
            placeholder="e.g. Jordan Lee"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
          />
          {errors.name && (
            <p style={{ color: 'var(--md-sys-color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {errors.name}
            </p>
          )}

          <label className="form-label">Employee ID / Email</label>
          <input
            type="email"
            className="input-field"
            placeholder="jordan@cryo.ai"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
          />
          {errors.email && (
            <p style={{ color: 'var(--md-sys-color-error)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {errors.email}
            </p>
          )}

          <label className="form-label">Capture mode</label>
          <div className="segmented-control">
            <Button
              type="button"
              variant={mode === 'webcam' ? 'soft' : 'ghost'}
              size="sm"
              className="segmented-control__btn"
              onClick={() => setMode('webcam')}
            >
              <Camera size={16} />
              Webcam
            </Button>
            <Button
              type="button"
              variant={mode === 'upload' ? 'soft' : 'ghost'}
              size="sm"
              className="segmented-control__btn"
              onClick={() => setMode('upload')}
            >
              <UploadCloud size={16} />
              Upload image
            </Button>
          </div>

          <label className="form-label">{mode === 'webcam' ? 'Live camera' : 'Uploaded photo'}</label>
          <div className="camera-placeholder">
            {mode === 'webcam' ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', borderRadius: '16px' }}
              />
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud size={16} />
                  Choose image
                </Button>
                {imagePreview && (
                  <img
                    ref={imageRef}
                    src={imagePreview}
                    alt="Uploaded preview"
                    style={{ width: '100%', marginTop: '12px', borderRadius: '16px' }}
                    onLoad={() => {
                      setImageReady(true);
                      setStatus('Image loaded. Click capture when ready.');
                    }}
                  />
                )}
              </>
            )}
            {!modelsLoaded && <p>Loading face models...</p>}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {steps.map((step, idx) => (
              <div
                key={step.id}
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: idx < currentStepIndex ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-variant)',
                  opacity: idx === currentStepIndex ? 1 : 0.5
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={handleCapture} variant="primary" size="lg" disabled={busy || !modelsLoaded} style={{ flex: 1 }}>
              <Camera size={18} />
              {busy ? 'Processing…' : currentStepIndex < 3 ? `Capture ${steps[currentStepIndex].label}` : 'Complete'}
            </Button>
            {currentStepIndex > 0 && (
              <Button onClick={resetCapture} variant="ghost" size="lg">
                <RefreshCw size={18} />
              </Button>
            )}
          </div>
          {status && <p style={{ marginTop: '12px', fontSize: '14px', textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>{status}</p>}

          <p style={{ marginTop: '16px', fontSize: '13px', textAlign: 'center', opacity: 0.7 }}>
            Step {Math.min(currentStepIndex + 1, 3)} of 3: {currentStepIndex < 3 ? steps[currentStepIndex].instruction : 'Done'}
          </p>
        </Card>

        <Card variant="surface" className="guide-card">
          <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>Enrollment tips</h3>

          <div className="guide-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ minWidth: '40px', height: '40px', borderRadius: '12px', background: 'var(--md-sys-color-surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-sys-color-on-surface)' }}>
                <Sun size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 4px 0', color: 'var(--md-sys-color-on-surface)' }}>Lighting & environment</h4>
                <p style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                  Ensure your face is evenly lit. Avoid strong backlighting or taking photos while wearing masks or dark glasses.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ minWidth: '40px', height: '40px', borderRadius: '12px', background: 'var(--md-sys-color-surface-container-high)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--md-sys-color-on-surface)' }}>
                <Scan size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 4px 0', color: 'var(--md-sys-color-on-surface)' }}>Angles matter</h4>
                <p style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                  Capture all 3 requested angles (center, left, right). This creates a complete 3D-like profile for faster recognition.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};

export default Register;

