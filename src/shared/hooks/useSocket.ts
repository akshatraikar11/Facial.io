import { useEffect, useCallback, useRef } from 'react';
import { socket, connectToOrg, fullDisconnect } from '../../services/socket';
import type { AttendanceLog } from '../../types';

/**
 * useSocket — subscribes to real-time attendance events for an org.
 *
 * Connects on mount, joins the org room, listens for 'attendance:new',
 * and FULLY disconnects (not just leave-org emit) on unmount.
 *
 * The callback ref pattern prevents stale closure issues without
 * adding onCheckIn to the effect deps (which would reconnect on every render).
 *
 * Usage:
 *   useSocket(orgId, (log) => setLogs(prev => [log, ...prev]));
 */
export const useSocket = (
  orgId: string | undefined,
  onCheckIn: (log: AttendanceLog) => void,
): void => {
  // Store callback in a ref so the effect never needs it as a dependency
  const callbackRef = useRef(onCheckIn);
  callbackRef.current = onCheckIn;

  // Stable handler that always delegates to the latest callback
  const handleNew = useCallback((log: unknown) => {
    callbackRef.current(log as AttendanceLog);
  }, []); // no deps — ref always holds the latest value

  useEffect(() => {
    if (!orgId) return;

    connectToOrg(orgId);
    socket.on('attendance:new', handleNew);

    return () => {
      socket.off('attendance:new', handleNew);
      fullDisconnect(orgId);
    };
  }, [orgId, handleNew]);
};
