import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { useFaceApi } from './FaceApiContext';
import { getUsers, saveAttendance, arrayToDescriptor } from '../utils/storage';
import { Camera, CheckCircle, AlertCircle, X } from 'lucide-react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';

const Kiosk = ({ onClose }) => {
    const { modelsLoaded } = useFaceApi();
    const videoRef = useRef(null);
    const [status, setStatus] = useState('Initializing camera...');
    // matchResult state removed as it was unused
    const [lastCheckIn, setLastCheckIn] = useState(null); // { name, time }
    const [isScanning, setIsScanning] = useState(true);

    // Load users and create FaceMatcher
    const [faceMatcher, setFaceMatcher] = useState(null);

    useEffect(() => {
        if (modelsLoaded) {
            const loadUsers = async () => {
                const users = await getUsers();
                if (users.length > 0) {
                    const labeledDescriptors = users
                        .filter(u => u.descriptors && u.descriptors.length > 0)
                        .map(u => {
                            const descriptors = u.descriptors.map(d => arrayToDescriptor(d));
                            return new faceapi.LabeledFaceDescriptors(u.name, descriptors);
                        });

                    if (labeledDescriptors.length > 0) {
                        console.log('Kiosk: Registered primitives:', labeledDescriptors.map(l => l.label));
                        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.65));
                    } else {
                        setStatus('No registered faces found.');
                    }
                } else {
                    setStatus('No users registered.');
                    console.warn('Kiosk: No users found in storage.');
                }
            };
            loadUsers();
        }
    }, [modelsLoaded]);

    // Start Camera
    useEffect(() => {
        let stream = null;
        const startVideo = async () => {
            try {
                // Optimize: lower resolution for faster processing
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStatus('Scan face to check in...');
            } catch (err) {
                console.error("Camera error:", err);
                setStatus('Camera access denied or unavailable.');
            }
        };

        if (isScanning) {
            startVideo();
        }

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
            // No interval to clear anymore
        };
    }, [isScanning]);

    const handleAttendance = useCallback(async (name) => {
        // Prevent double check-in within a short window (e.g., 1 minute)
        const now = new Date();
        // Simple memory debounce for this session
        // In a real app, you might check the last log in storage

        await saveAttendance({
            userId: 'lookup-needed', // We might want to store ID instead of name in matcher if possible, but name is easier for Label
            userName: name,
            type: 'check-in',
            confidence: 0, // Placeholder
            method: 'face'
        });

        setLastCheckIn({ name, time: now });
        // Pause scanning briefly
        setIsScanning(false);
        setStatus(`Welcome, ${name}!`);

        // Auto-resume after 3 seconds
        setTimeout(() => {
            setStatus('Scanning for faces...');
            setIsScanning(true);
        }, 3000);

    }, []);

    // Recognition Loop
    useEffect(() => {
        let isActive = true;

        const detectFaces = async () => {
            if (!isActive || !isScanning || !videoRef.current || !faceMatcher || !modelsLoaded) return;

            if (videoRef.current.paused || videoRef.current.ended || !videoRef.current.srcObject) {
                requestAnimationFrame(detectFaces);
                return;
            }

            try {
                // Use SSD MobileNet V1 for better accuracy, matching registration
                const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

                const detection = await faceapi.detectSingleFace(videoRef.current, options)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (isActive && detection) {
                    // Check best match
                    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

                    if (bestMatch.label !== 'unknown') {
                        // Found a match - stop loop and handle attendance
                        handleAttendance(bestMatch.label);
                        return; // Stop the loop here, handleAttendance will eventually set isScanning back to true
                    } else {
                        const dist = bestMatch.distance.toFixed(2);
                        setStatus(`Face not recognized (Dist: ${dist})`);
                    }
                } else if (isActive) {
                    setStatus('Scanning for faces...');
                }
            } catch (e) {
                console.error("Detection error", e);
            }

            // Schedule next frame
            if (isActive) {
                // Add a small delay to yield to UI thread if needed, or just next frame
                // requestAnimationFrame(detectFaces); 
                // Using setTimeout to throttle slightly more if still laggy
                setTimeout(() => detectFaces(), 100);
            }
        };

        if (isScanning && modelsLoaded && faceMatcher) {
            detectFaces();
        }

        return () => {
            isActive = false;
        };
    }, [isScanning, faceMatcher, modelsLoaded, handleAttendance]);


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '640px', padding: '24px' }}>
                <Card variant="surface" className="overflow-hidden relative" style={{ background: '#111', border: '1px solid #333', color: '#fff', borderRadius: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '8px', height: '8px', background: isScanning ? '#22c55e' : '#eab308', borderRadius: '50%' }} />
                            <span style={{ fontWeight: 500, fontSize: '14px', color: '#888' }}>KIOSK MODE</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose} style={{ color: '#666' }}>
                            <X size={20} />
                        </Button>
                    </div>

                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden" style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '24px', overflow: 'hidden' }}>
                        {!isScanning && lastCheckIn ? (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                                <CheckCircle size={64} color="#22c55e" style={{ marginBottom: '16px' }} />
                                <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Welcome, {lastCheckIn.name}</h2>
                                <p style={{ color: '#888' }}>{lastCheckIn.time.toLocaleTimeString()}</p>
                            </div>
                        ) : (
                            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                        )}

                        {/* Overlay UI */}
                        <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '8px 16px', borderRadius: '99px', fontSize: '14px', fontWeight: 500 }}>
                                {status}
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <p style={{ color: '#666', fontSize: '13px' }}>
                            Look directly at the camera. Ensure good lighting.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Kiosk;
