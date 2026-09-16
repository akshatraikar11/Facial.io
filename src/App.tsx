import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import * as Sentry from '@sentry/react';
import { queryClient } from './services/queryClient';
import { FaceApiProvider, useFaceApi } from './components/FaceApiContext';
import SplashScreen from './components/SplashScreen';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';

// Lazy-load every page so each route is a separate JS chunk.
// This replaces the require() anti-pattern and gives proper tree-shaking.
const Home         = lazy(() => import('./pages/Home'));
const DashboardPage  = lazy(() => import('./modules/dashboard/DashboardPage'));
const EmployeesPage  = lazy(() => import('./modules/employees/EmployeesPage'));
const KioskPage      = lazy(() => import('./modules/attendance/KioskPage'));
const BillingPage    = lazy(() => import('./modules/billing/BillingPage'));
const AiPage         = lazy(() => import('./modules/ai/AiPage'));
const LocationsPage  = lazy(() => import('./modules/locations/LocationsPage'));
const ShiftsPage     = lazy(() => import('./modules/shifts/ShiftsPage'));
const AuditLogPage   = lazy(() => import('./modules/audit/AuditLogPage'));
const SignInPage     = lazy(() => import('./modules/auth/SignInPage'));
const SignUpPage     = lazy(() => import('./modules/auth/SignUpPage'));

const CLERK_KEY = import.meta.env?.VITE_CLERK_PUBLISHABLE_KEY ?? '';

// Initialize Sentry for error tracking and performance monitoring
// Only in production to avoid noise during development
const SENTRY_DSN = import.meta.env?.VITE_SENTRY_DSN ?? '';
if (SENTRY_DSN && import.meta.env?.MODE === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env?.MODE ?? 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Page-level loading fallback — reuse the same spinner as the splash screen
const PageFallback = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div className="loader-orbit"><span /></div>
  </div>
);

const AppRoutes = () => (
  <BrowserRouter>
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/kiosk"     element={<KioskPage />} />
        <Route element={<Layout />}>
          <Route path="/"           element={<Home />} />
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/employees"  element={<EmployeesPage />} />
          <Route path="/billing"    element={<BillingPage />} />
          <Route path="/ai"         element={<AiPage />} />
          <Route path="/locations"  element={<LocationsPage />} />
          <Route path="/shifts"     element={<ShiftsPage />} />
          <Route path="/audit"      element={<AuditLogPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

/** Gates the entire app behind the splash screen while face-api models load */
const AppGate = () => {
  const { loading, error } = useFaceApi();
  if (loading || error) return <SplashScreen error={error} />;
  return <AppRoutes />;
};

const App = () => (
  <ErrorBoundary>
    <ClerkProvider publishableKey={CLERK_KEY} fallbackRedirectUrl="/dashboard">
      <QueryClientProvider client={queryClient}>
        <FaceApiProvider>
          <AppGate />
        </FaceApiProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ClerkProvider>
  </ErrorBoundary>
);

export default App;
