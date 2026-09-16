import { registerAs } from '@nestjs/config';

/**
 * General application configuration.
 * NODE_ENV    — 'development' | 'production' | 'test'
 * PORT        — HTTP server port (default 3001)
 * CLIENT_URL  — frontend origin, used for CORS allowlist
 */
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
}));
