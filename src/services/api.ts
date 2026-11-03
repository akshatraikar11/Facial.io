import axios from 'axios';

/**
 * Axios instance — the single HTTP client for the entire app.
 *
 * Auth token flow:
 *   setAuthToken() is called once from ClerkTokenSync (rendered inside
 *   ClerkProvider) whenever the Clerk session token changes.
 *   The request interceptor reads it synchronously — no polling, no race.
 */
export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// In-memory token store — set by ClerkTokenSync component
let _authToken: string | null = null;
export const setAuthToken = (token: string | null) => { _authToken = token; };

// Attach token to every request — reads from cache, falls back to window.Clerk live
api.interceptors.request.use(async (config) => {
  try {
    let token = _authToken;
    if (!token) {
      // ClerkTokenSync hasn't fired yet — fetch directly from the Clerk global
      const clerk = (window as any).Clerk ?? (window as any).__clerk;
      if (clerk?.session) {
        token = await clerk.session.getToken();
        if (token) _authToken = token; // cache it
      }
    }
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
  } catch { /* no session — public route */ }
  return config;
});

// Unwrap response envelope { status, data } → data
api.interceptors.response.use(
  (response) => {
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
