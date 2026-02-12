import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  WEB_URL: z.string().default('http://localhost:3000'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Dynamic.xyz
  DYNAMIC_ENVIRONMENT_ID: z.string(),
  DYNAMIC_PUBLIC_KEY: z.string(),

  // Trading key encryption
  TRADING_KEY_ENCRYPTION_KEY: z.string().length(64),

  // Polymarket
  POLYMARKET_CLOB_API_URL: z.string().default('https://clob.polymarket.com'),
  POLYMARKET_GAMMA_API_URL: z.string().default('https://gamma-api.polymarket.com'),
  POLYMARKET_DATA_API_URL: z.string().default('https://data-api.polymarket.com'),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
});

export type Config = z.infer<typeof configSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = configSchema.parse(process.env);
  }
  return _config;
}
