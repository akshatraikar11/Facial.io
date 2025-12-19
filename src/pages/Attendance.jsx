import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Download, Trash2, ShieldCheck, AlertTriangle } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import { useFaceApi } from '../components/FaceApiContext';
import Toast from '../components/Toast';
import { arrayToDescriptor, clearAttendance, getAttendance, getUsers, saveAttendance } from '../utils/storage';



const Attendance = () => {
    const { modelsLoaded } = useFaceApi();
    const [toast, setToast] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [logs, setLogs] = useState([]);
    const logsRef = useRef([]);
    const [status, setStatus] = useState('Waiting for camera…');
    const [recognized, setRecognized] = useState(null); // { name, time }
    const lastMatchRef = useRef({ userId: null, timestamp: 0 });
    const usersRef = useRef([]);

    // Load users once on mount (or when needed to refresh)
    useEffect(() => {
        const loadUsers = async () => {
            const loadedUsers = await getUsers();
            usersRef.current = loadedUsers;
            console.log(`Attendance: Loaded ${loadedUsers.length} users into cache.`);
        };
        loadUsers();
    }, []);

    useEffect(() => {
        const loadLogs = async () => {
            const today = new Date().toISOString().slice(0, 10);
            const allLogs = await getAttendance();
            const todays = allLogs.filter((l) => l.date === today);
            setLogs(todays);
            logsRef.current = todays;
        };
        loadLogs();
    }, []);

    useEffect(() => {
        logsRef.current = logs;
    }, [logs]);

    useEffect(() => {
        if (!modelsLoaded) return;

        let timeoutId;
        const isMounted = { current: true };

        const startVideoAndLoop = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
                if (!isMounted.current) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setStatus('Camera ready. Looking for faces…');
                runDetectionLoop();
            } catch (err) {
                if (!isMounted.current) return;
                console.error('Error accessing camera', err);
                const msg = 'Unable to access camera. Please allow camera permission.';
                setStatus(msg);
                setToast({ message: msg, type: 'error' });
            }
        };

        const runDetectionLoop = async () => {
            if (!isMounted.current) return;

            const scheduleNext = () => {
                if (isMounted.current) {
                    timeoutId = setTimeout(runDetectionLoop, 100);
                }
            };

            if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) {
                scheduleNext();
                return;
            }

            try {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                const displayWidth = video.clientWidth;
                const displayHeight = video.clientHeight;

                if (!displayWidth || !displayHeight) { scheduleNext(); return; }

                if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                    canvas.width = displayWidth;
                    canvas.height = displayHeight;
                }

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, displayWidth, displayHeight);

                // Use TinyFaceDetector for better performance
                const detectionOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

                // Retrieve all faces with landmarks and descriptors
                const detections = await faceapi
                    .detectAllFaces(video, detectionOptions)
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                if (!isMounted.current) return;
                if (!detections.length) {
                    scheduleNext();
                    return;
                }

                const users = usersRef.current;
                // Removed early return if (!users.length) to allow showing detected faces even if database is empty

                // Calculate scaling
                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;
                const videoAspect = videoWidth / videoHeight;
                const containerAspect = displayWidth / displayHeight;
                let scaleX, scaleY, visibleWidth, visibleHeight, offsetX = 0, offsetY = 0;

                if (videoAspect > containerAspect) {
                    scaleY = displayHeight / videoHeight;
                    scaleX = scaleY;
                    visibleHeight = displayHeight;
                    visibleWidth = videoWidth * scaleX;
                    offsetX = (displayWidth - visibleWidth) / 2;
                } else {
                    scaleX = displayWidth / videoWidth;
                    scaleY = scaleX;
                    visibleWidth = displayWidth;
                    visibleHeight = videoHeight * scaleY;
                    offsetY = (displayHeight - visibleHeight) / 2;
                }

                const resizedDetections = faceapi.resizeResults(detections, {
                    width: visibleWidth,
                    height: visibleHeight,
                });

                const THRESHOLD = 0.65;
                const now = new Date();
                const nowMs = now.getTime();
                const date = now.toISOString().slice(0, 10);

                // Main Processing Loop
                for (const det of resizedDetections) {
                    const descriptor = det.descriptor;
                    const box = det.detection.box;
                    const adjustedBox = {
                        x: box.x + offsetX,
                        y: box.y + offsetY,
                        width: box.width,
                        height: box.height,
                    };

                    let bestUser = null;
                    let bestDistance = Number.MAX_VALUE;

                    // Match Face
                    users.forEach((u) => {
                        const userDescriptors = u.descriptors || (u.descriptor ? [u.descriptor] : []);
                        userDescriptors.forEach(d => {
                            const dist = faceapi.euclideanDistance(descriptor, arrayToDescriptor(d));
                            if (dist < bestDistance) {
                                bestDistance = dist;
                                bestUser = u;
                            }
                        });
                    });

                    // Draw Box & Label
                    // Match visual style: Blue box with label on top containing "Name (Score)"
                    const isKnown = bestUser && bestDistance < THRESHOLD;
                    const boxColor = isKnown ? '#0000ff' : '#ff0000'; // Blue for known, Red for unknown

                    ctx.strokeStyle = boxColor;
                    ctx.lineWidth = 3;
                    ctx.strokeRect(adjustedBox.x, adjustedBox.y, adjustedBox.width, adjustedBox.height);

                    // Draw Label
                    const labelText = isKnown
                        ? `${bestUser.name} (${bestDistance.toFixed(2)})`
                        : `Unknown (${bestDistance === Number.MAX_VALUE ? 'N/A' : bestDistance.toFixed(2)})`;

                    ctx.font = 'bold 16px sans-serif';
                    const textMetrics = ctx.measureText(labelText);
                    const textWidth = textMetrics.width;
                    const textHeight = 16;
                    const padding = 6;

                    // Draw filled background for text
                    ctx.fillStyle = boxColor;
                    ctx.fillRect(
                        adjustedBox.x,
                        adjustedBox.y - (textHeight + padding * 2),
                        textWidth + padding * 2,
                        textHeight + padding * 2
                    );

                    // Draw Text
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(labelText, adjustedBox.x + padding, adjustedBox.y - padding);

                    // Logic for Attendance checks
                    if (isKnown) {
                        const existingForUser = logsRef.current.find(
                            (l) => l.userId === bestUser.id && l.date === date
                        );

                        if (existingForUser) {
                            setStatus(`Welcome back, ${bestUser.name}`);
                            continue;
                        }

                        // Check debounce
                        const last = lastMatchRef.current;
                        if (last.userId !== bestUser.id || nowMs - last.timestamp > 5000) {
                            // Log Attendance
                            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const newLog = await saveAttendance({
                                userId: bestUser.id,
                                name: bestUser.name,
                                date,
                                time,
                                status: 'Present',
                            });
                            setLogs((prev) => [...prev, newLog]);
                            logsRef.current = [...logsRef.current, newLog];

                            setStatus(`Verified! Welcome ${bestUser.name}`);
                            setToast({ message: `Attendance logged for ${bestUser.name}`, type: 'success' });

                            setRecognized({ name: bestUser.name, time });
                            lastMatchRef.current = { userId: bestUser.id, timestamp: nowMs };
                        }
                    }
                }

            } catch (err) {
                console.error(err);
            }
            scheduleNext();
        };

        startVideoAndLoop();

        return () => {
            isMounted.current = false;
            if (timeoutId) clearTimeout(timeoutId);
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [modelsLoaded]);

    const attendees = logs;

    return (
        <section className="page-shell">
            <div className="page-heading">
                <Badge variant="soft">Live attendance</Badge>
                <h2>Monitor attendance with precision and ease.</h2>
                <p>Oversee live check-ins, manage kiosk feeds, and generate detailed reports directly from your command center.</p>
            </div>

            <div className="attendance-grid">
                <Card variant="glass" className="camera-panel">
                    <div className="panel-top">
                        <div>
                            <p className="section-eyebrow">Live kiosk feed</p>
                            <h3>Camera ready</h3>
                        </div>
                        <Badge variant="success" size="sm" dot>
                            Realtime
                        </Badge>
                    </div>

                    <div className="camera-frame relative">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                        <canvas
                            ref={canvasRef}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                    <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--md-sys-color-on-surface-variant)' }}>{status}</p>

                    <div className="detected-row">
                        <div className="avatar shimmer" />
                        <div>
                            <p className="detected-name">
                                {recognized?.name || 'Awaiting next attendee…'}
                            </p>
                            <p className="detected-meta">
                                {recognized?.time ? `${recognized.time} • Present` : 'Auto logging enabled'}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card variant="surface" className="attendance-card">
                    <div className="panel-top">
                        <div>
                            <p className="section-eyebrow">Today&apos;s logs</p>
                            <h3>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} overview</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    if (window.confirm('Are you sure you want to clear all attendance logs? This cannot be undone.')) {
                                        await clearAttendance();
                                        setLogs([]);
                                        logsRef.current = [];
                                        setStatus('All attendance logs cleared.');
                                    }
                                }}
                            >
                                <Trash2 size={16} />
                                Clear logs
                            </Button>

                        </div>
                    </div>

                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendees.map((attendee) => (
                                <tr key={attendee.id}>
                                    <td>{attendee.name}</td>
                                    <td>{attendee.time}</td>
                                    <td>
                                        <Badge
                                            variant={attendee.status === 'Present' ? 'success' : 'warning'}
                                            size="sm"
                                            dot
                                        >
                                            {attendee.status}
                                        </Badge>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            </div>
            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                        duration={3000}
                    />
                )
            }
        </section >
    );
};

export default Attendance;

