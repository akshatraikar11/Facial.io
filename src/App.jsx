import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Register from './pages/Register';
import Attendance from './pages/Attendance';
import Dashboard from './pages/Dashboard';
import { FaceApiProvider } from './components/FaceApiContext';

import Layout from './components/Layout';

const App = () => {
    return (
        <BrowserRouter>
            <FaceApiProvider>
                <Routes>
                    <Route element={<Layout />}>
                        <Route path="/" element={<Home />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/attendance" element={<Attendance />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                    </Route>
                </Routes>
            </FaceApiProvider>
        </BrowserRouter>
    );
};

export default App;
