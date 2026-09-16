import axios from 'axios';

/**
 * Axios instance — the single HTTP client for the entire app.
 *
 * baseURL pulls from Vite env var, falls back to localhost for dev.
 *
 * Request interceptor:
 *   Before every request, gets the Clerk session token and attaches it
 *   as Authorization: Bearer <token>. The NestJS ClerkAuthGuard reads this.
 *
 *   window.__clerk is set by Clerk's React SDK after initialization.
 *   We access it directly here to avoid circular imports between
 *   the API service and React component context.
 *
 * Response interceptor:
 *   Unwraps the { status: 'success', data: ... } envelope automatically.
 *   Components receive data directly without unwrapping every call.
 *   On error, extracts the message from our standard error shape.
 */
export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach Clerk JWT to every request
api.interceptors.request.use(async (config) => {
  try {
    const clerk = (window as any).__clerk;
    if (clerk?.session) {
      const token = await clerk.session.getToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // No session — request goes through without auth (public routes)
  }
  return config;
});

// Unwrap response envelope { status, data } → data
api.interceptors.response.use(
  (response) => {
    // Our NestJS TransformInterceptor wraps everything in { status, data }
    if (response.data?.status === 'success') {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.message ?? error.message ?? 'An error occurred';
    return Promise.reject(new Error(message));
  },
);
