import { registerAs } from '@nestjs/config';

/**
 * Database configuration.
 * registerAs() namespaces this config under the key 'database'
 * so you inject it as: @Inject(databaseConfig.KEY)
 */
export default registerAs('database', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/facialio',
}));
