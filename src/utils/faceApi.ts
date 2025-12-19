import * as faceapi from 'face-api.js';

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
