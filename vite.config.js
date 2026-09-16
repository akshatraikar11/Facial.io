import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    // Optimize dependencies
    optimizeDeps: {
        include: ['face-api.js', 'dexie', 'react', 'react-dom', 'react-router-dom'],
        exclude: ['@splinetool/runtime']
    },

    // Build optimizations
    build: {
        // Increase chunk size warning limit for face-api models
        chunkSizeWarningLimit: 1000,

        rollupOptions: {
            output: {
                manualChunks: {
                    // Separate vendor chunks for better caching
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'face-api': ['face-api.js'],
                    'animations': ['framer-motion'],
                    'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge']
                }
            }
        },

        // Enable minification
        minify: 'esbuild',

        // Source maps for debugging
        sourcemap: false
    },

    // Dev server optimizations
    server: {
        port: 5173,
        strictPort: false,

        // Proxy API requests to backend
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false
            }
        },

        // Enable HMR
        hmr: {
            overlay: true
        },

        // Faster file watching
        watch: {
            usePolling: false
        }
    }
});
