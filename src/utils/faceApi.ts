import * as faceapi from 'face-api.js';

// Performance optimization constants
export const DETECTION_INTERVAL_MS = 300; // Reduced from 100ms for better performance
export const MATCH_THRESHOLD = 0.65; // Distance threshold for face matching
export const DEBOUNCE_MS = 10000; // Debounce for duplicate attendance logging

// Optimized detection options - use TinyFaceDetector for speed
export const getOptimizedDetectionOptions = () => {
    return new faceapi.TinyFaceDetectorOptions({
        inputSize: 224, // Balanced size for performance
        scoreThreshold: 0.5 // Reasonable confidence threshold
    });
};

export const loadModels = async (): Promise<boolean> => {
    const MODEL_URL = '/models';
    try {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        ]);
        console.log('Models loaded successfully');
        return true;
    } catch (error) {
        console.error('Error loading models:', error);
        return false;
    }
};
