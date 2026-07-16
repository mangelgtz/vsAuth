import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

const booleanFromString = z
  .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('3000')
    .transform((v) => Number.parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n > 0 && n < 65536, {
      message: 'PORT must be a valid TCP port',
    }),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  GOOGLE_REDIRECT_URI: z.string().url('GOOGLE_REDIRECT_URI must be a valid URL'),
  /**
   * Comma-separated list of EXTRA audiences accepted when verifying Google
   * id_tokens. In a Flutter setup this typically includes the Android client_id
   * (and optionally the iOS client_id). The backend's WEB client_id is always
   * accepted automatically — no need to repeat it here.
   * Example: "1234-abc.apps.googleusercontent.com,5678-xyz.apps.googleusercontent.com"
   */
  GOOGLE_MOBILE_CLIENT_IDS: z
    .string()
    .optional()
    .transform((raw) =>
      raw === undefined || raw.trim() === ''
        ? []
        : raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
    ),
  REFRESH_TOKEN_COOKIE: booleanFromString.default('false'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
