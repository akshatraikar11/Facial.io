import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadModels } from '../utils/faceApi';

const FaceApiContext = createContext();

export const useFaceApi = () => useContext(FaceApiContext);

export const FaceApiProvider = ({ children }) => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const initModels = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const success = await loadModels();
            if (success) {
                setModelsLoaded(true);
            } else {
                setError('Failed to load face detection models');
            }
        } catch (err) {
            setError(err.message ?? 'Unknown error loading models');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { initModels(); }, [initModels]);

    return (
        <FaceApiContext.Provider value={{ modelsLoaded, loading, error, retry: initModels }}>
            {children}
        </FaceApiContext.Provider>
    );
};
