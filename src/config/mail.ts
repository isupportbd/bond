import { env } from "@/env.js";

/**
 * Why: SMTP mail transport settings.
 * When: Transactional mail (signup, reset, verify) is sent.
 * Where: src/config/mail.ts.
 * How: Host, ports, encryption, from address and fail-silent are plain
 *      literals. Username/password are credentials and stay in .env.
 */
export const mailConfig = {
  host: env.MAIL_HOST || "mail.isupportbd.com",
  port: env.MAIL_PORT || 465,
  encryption: env.MAIL_ENCRYPTION || "ssl",
  username: env.MAIL_USERNAME || "admin@isupportbd.com",
  password: env.MAIL_PASSWORD || "",
  fromAddress: `"${env.MAIL_FROM_NAME || "Bond Analytics"}" <${env.MAIL_FROM_ADDRESS || "admin@isupportbd.com"}>`,
  failSilent: true,
  maildev: {
    smtpPort: 1089,
    webPort: 1080
  }
};

export type MailConfig = typeof mailConfig;
