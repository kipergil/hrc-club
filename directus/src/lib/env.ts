import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DIRECTUS_URL: z.string().url(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
  /** Display name — drives the "<APP_NAME> Service" policy/role name and bootstrap-tooling copy. */
  APP_NAME: z.string().min(1).default("HRC Club"),
  /** Public origin the site is served from — used for revalidation and email links. */
  APP_BASE_URL: z.string().url().default("https://hrc-club.vercel.app"),
  /** Email of the non-human directus_users row carrying the Express server's static token. */
  SERVICE_ACCOUNT_EMAIL: z.string().email().default("service@hrc-club.dev"),
});

export const env = envSchema.parse({
  DIRECTUS_URL: process.env.DIRECTUS_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  APP_NAME: process.env.APP_NAME || undefined,
  APP_BASE_URL: process.env.APP_BASE_URL || undefined,
  SERVICE_ACCOUNT_EMAIL: process.env.SERVICE_ACCOUNT_EMAIL || undefined,
});
