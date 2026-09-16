import { io, Socket } from 'socket.io-client';

const SOCKET_URL =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace('/api', '') ??
  'http://localhost:3001';

/**
 * Socket.io client — connects to the /attendance namespace.
 *
 * autoConnect: false — we connect manually after Clerk auth is ready.
 * This prevents the socket from connecting before we have an orgId.
 */
export const socket: Socket = io(`${SOCKET_URL}/attendance`, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

/** Connect and join an org room. Called by useSocket on mount. */
export const connectToOrg = (orgId: string): void => {
  if (!socket.connected) socket.connect();
  socket.emit('join-org', { orgId });
};

/** Leave the org room gracefully. */
export const disconnectFromOrg = (orgId: string): void => {
  socket.emit('leave-org', { orgId });
};

/**
 * Fully disconnect the socket and reset state.
 * Called by useSocket on unmount to prevent stale connections
 * when the user navigates away from the dashboard or switches orgs.
 */
export const fullDisconnect = (orgId: string): void => {
  socket.emit('leave-org', { orgId });
  socket.disconnect();
};
