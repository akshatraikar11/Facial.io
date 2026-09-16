import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

/**
 * AttendanceGateway — the real-time WebSocket server.
 *
 * @WebSocketGateway() options:
 *
 *   cors: { origin: '*' }
 *     Allows any origin to connect via WebSocket during development.
 *     In production this should be restricted to your Vercel domain.
 *     CORS for WebSockets is separate from HTTP CORS configured in main.ts.
 *
 *   namespace: '/attendance'
 *     Namespaces in Socket.io are like separate communication channels
 *     on the same server. The frontend connects to:
 *       io('http://localhost:3001/attendance')
 *     instead of the default root namespace.
 *     This keeps attendance events isolated from any other real-time
 *     features we add later (e.g. notifications in a /notifications namespace).
 *
 * How org-based rooms work:
 *   A Socket.io "room" is a named channel that sockets can join/leave.
 *   When a dashboard client connects, it sends a 'join-org' event with its orgId.
 *   The gateway calls socket.join(orgId) — the socket is now in that org's room.
 *   When a check-in happens, AttendanceService calls gateway.emitCheckIn(orgId, log).
 *   The gateway calls server.to(orgId).emit('attendance:new', log).
 *   ONLY sockets in that org's room receive the event.
 *
 * Why rooms instead of separate namespaces per org?
 *   Namespaces are defined at server startup — you can't create them dynamically
 *   for each new org. Rooms are created on-the-fly by socket.join() — perfect
 *   for a multi-tenant system where orgs are created at runtime.
 *
 * Lifecycle interfaces:
 *   OnGatewayInit       — afterInit() called when server is ready
 *   OnGatewayConnection — handleConnection() called per new socket
 *   OnGatewayDisconnect — handleDisconnect() called when socket closes
 *
 * Interview answer:
 * "We use Socket.io rooms for multi-tenant real-time events. Each org is a
 *  room — dashboard clients join their org's room on connect, and kiosk
 *  check-ins emit only to that room. This means org A's dashboard never
 *  sees org B's check-ins, and we don't need a separate WebSocket server
 *  per tenant."
 */
@WebSocketGateway({
  cors: {
    origin: process.env['NODE_ENV'] === 'production'
      ? (process.env['CLIENT_URL'] ?? 'https://your-domain.com')
      : '*',
    credentials: true,
  },
  namespace: '/attendance',
})
export class AttendanceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AttendanceGateway.name);
  private readonly orgClientCount = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Called once when the WebSocket server is initialized.
   * Sets up Redis adapter for multi-pod WebSocket support if REDIS_URL is configured.
   * 
   * Why Redis adapter:
   *   Without Redis, WebSocket connections are sticky to a single pod.
   *   If user A connects to pod 1 and user B connects to pod 2, events
   *   emitted from pod 1 won't reach user B.
   *   
   *   Redis adapter makes Socket.io publish/subscribe work across pods:
   *   - server.to(orgId).emit() publishes to Redis
   *   - All pods subscribed to that room receive the message
   *   - Each pod broadcasts to its own connected clients
   *   
   *   Result: true multi-pod scaling with shared event bus.
   */
  async afterInit(server: Server) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      try {
        // Create two Redis clients: one for pub, one for sub
        // (Socket.io requires separate clients for publish/subscribe pattern)
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        // Attach Redis adapter to Socket.io server
        server.adapter(createAdapter(pubClient, subClient));

        this.logger.log(
          `Redis adapter connected: ${redisUrl.replace(/:[^:]*@/, ':****@')} — multi-pod WebSocket enabled`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to connect Redis adapter: ${(error as Error).message} — falling back to in-memory adapter`,
        );
        // Non-fatal: app continues with default memory adapter (single-pod only)
      }
    } else {
      this.logger.warn(
        'REDIS_URL not configured — WebSocket scaling limited to single pod. Set REDIS_URL for multi-pod support.',
      );
    }

    this.logger.log('AttendanceGateway initialized — WebSocket server ready');
  }

  /**
   * Called every time a new client connects.
   * At this point the client has connected but not yet joined an org room.
   * Room joining happens when the client sends the 'join-org' event.
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  /**
   * Called when a client disconnects (tab closed, network lost, etc.).
   * Socket.io automatically removes the socket from all rooms it joined —
   * no manual cleanup needed.
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * @SubscribeMessage('join-org') — handles the 'join-org' event from clients.
   *
   * The React dashboard sends this immediately after connecting:
   *   socket.emit('join-org', { orgId: 'org_abc123' })
   *
   * The gateway calls socket.join(orgId) which adds this socket to
   * the org's room. From this moment, server.to(orgId).emit(...) will
   * reach this client.
   *
   * We emit back a 'joined' confirmation so the frontend knows it's
   * subscribed and can start rendering the live feed.
   *
   * Security note:
   *   In production, this should verify the orgId against a Clerk JWT
   *   passed during the WebSocket handshake (via auth option in socket.io-client).
   *   For now, trust the orgId from the payload — fine for development.
   */
  @SubscribeMessage('join-org')
  handleJoinOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orgId: string },
  ) {
    const { orgId } = payload;

    if (!orgId) {
      client.emit('error', { message: 'orgId is required to join a room' });
      return;
    }

    // Join the org's room
    client.join(orgId);

    // Update room client count for logging
    const count = (this.orgClientCount.get(orgId) ?? 0) + 1;
    this.orgClientCount.set(orgId, count);

    this.logger.log(`Client ${client.id} joined org room: ${orgId} (${count} clients in room)`);

    // Confirm to the client
    client.emit('joined', {
      orgId,
      message: `Connected to live attendance feed for org: ${orgId}`,
    });
  }

  /**
   * @SubscribeMessage('leave-org') — graceful room leave.
   *
   * Clients can call this when navigating away from the dashboard.
   * Not strictly required (disconnect handles cleanup) but good practice.
   */
  @SubscribeMessage('leave-org')
  handleLeaveOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { orgId: string },
  ) {
    const { orgId } = payload;
    client.leave(orgId);

    const count = Math.max((this.orgClientCount.get(orgId) ?? 1) - 1, 0);
    this.orgClientCount.set(orgId, count);

    this.logger.log(`Client ${client.id} left org room: ${orgId}`);
  }

  /**
   * emitCheckIn — broadcasts a new attendance log to all dashboard clients
   * in the org's room.
   *
   * Called by AttendanceService.checkIn() immediately after creating the log.
   * This is the bridge between the REST API and the WebSocket layer.
   *
   * Event name: 'attendance:new'
   * Payload: the full attendance log document
   *
   * server.to(orgId).emit() sends ONLY to sockets that have joined
   * the room with that orgId. Other orgs never see this event.
   *
   * This method is called from AttendanceService (via DI) — that's why
   * the gateway is a provider in AttendanceModule and exported.
   */
  emitCheckIn(orgId: string, log: unknown) {
    this.server.to(orgId).emit('attendance:new', log);
    this.logger.log(`Emitted attendance:new to room: ${orgId}`);
  }

  /**
   * emitToOrg — generic emit for future use (Phase 9 notifications, etc.)
   * Lets any service broadcast any event to an org's connected clients.
   */
  emitToOrg(orgId: string, event: string, payload: unknown) {
    this.server.to(orgId).emit(event, payload);
  }
}
