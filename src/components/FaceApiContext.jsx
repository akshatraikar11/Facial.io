import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadModels } from '../utils/faceApi.js';

const FaceApiContext = createContext();

export const useFaceApi = () => useContext(FaceApiContext);

export const FaceApiProvider = ({ children }) => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initModels = async () => {
            try {
                const success = await loadModels();
                if (success) {
                    setModelsLoaded(true);
                } else {
                    setError('Failed to load face-api models');
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        initModels();
    }, []);

    return (
        <FaceApiContext.Provider value={{ modelsLoaded, loading, error }}>
            {children}
        </FaceApiContext.Provider>
    );
};
