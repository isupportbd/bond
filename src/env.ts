import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(config({ override: true }));

const defaultPort = process.env.PORT || process.env.APP_PORT || "3000";
const defaultUrl =
  process.env.APP_URL ||
  process.env.COOLIFY_URL ||
  (process.env.COOLIFY_FQDN ? `https://${process.env.COOLIFY_FQDN}` : "http://localhost:3000");

const envSchema = z.object({
  APP_NAME: z.string().default("Bond Data Analysis"),
  APP_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_PORT: z.coerce.number().default(Number(defaultPort)),
  APP_URL: z.string().trim().default(defaultUrl),
  UI: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
  FRONTEND_URL: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  DATABASE_URL: z.string().default("sqlite:./src/storage/database/nexgen.sqlite"),
  REDIS: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
  REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
  REDIS_PREFIX: z
    .string()
    .default("bond_analysis")
    .transform((value) => value.trim()),
  JWT_ACCESS_SECRET: z.string().default("bond-data-analysis-access-secret-key-32chars"),
  JWT_REFRESH_SECRET: z.string().default("bond-data-analysis-refresh-secret-key-32chars"),
  COOKIE_SECRET: z.string().default("bond-data-analysis-cookie-secret-key-32chars"),
  STORAGE_ACCESS_KEY_ID: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  STORAGE_SECRET_ACCESS_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  MAIL_HOST: z.string().default("mail.isupportbd.com"),
  MAIL_PORT: z.coerce.number().default(465),
  MAIL_ENCRYPTION: z.enum(["none", "ssl", "tls"]).default("ssl"),
  MAIL_FROM_ADDRESS: z.string().default("admin@isupportbd.com"),
  MAIL_FROM_NAME: z.string().default("Bond Analytics"),
  MAIL_USERNAME: z.string().default("admin@isupportbd.com"),
  MAIL_PASSWORD: z.string().default(""),
  ADMIN_NAME: z.string().optional().default("Administrator"),
  ADMIN_EMAIL: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  OPEN_API: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
  SOCKET: z
    .string()
    .default("false")
    .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0"),
  SECURITY_HEADERS: z
    .string()
    .default("true")
    .transform((value) => value.trim().toLowerCase() !== "false" && value.trim() !== "0")
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  FRONTEND_URL: parsedEnv.FRONTEND_URL
};

export type Env = typeof env;
