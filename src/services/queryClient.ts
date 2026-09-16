import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client — shared across the whole app.
 *
 * staleTime: 30s — data is "fresh" for 30 seconds, no refetch on window focus.
 * gcTime: 5min   — unused cache entries are garbage collected after 5 minutes.
 * retry: 1       — retry failed requests once before showing error.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
