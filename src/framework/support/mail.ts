import nodemailer from "nodemailer";
import { mailConfig } from "@/config/index.js";
import { CircuitBreaker } from "@/framework/circuit-breaker/cb.js";
import { logger } from "@/framework/support/logger.js";

type MailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

function getTransporter() {
  const isSsl = mailConfig.encryption === "ssl" || Number(mailConfig.port) === 465;
  return nodemailer.createTransport({
    host: mailConfig.host,
    port: Number(mailConfig.port),
    secure: isSsl,
    auth: mailConfig.username ? { user: mailConfig.username, pass: mailConfig.password } : undefined,
    tls: {
      rejectUnauthorized: false,
      servername: mailConfig.host
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

const mailBreaker = new CircuitBreaker();

export const mail = {
  /**
   * Sends transactional email through configured SMTP transport
   */
  async sendMail(payload: MailPayload) {
    try {
      const transporter = getTransporter();
      const result = await mailBreaker.exec(() =>
        transporter.sendMail({
          from: mailConfig.fromAddress,
          ...payload
        })
      );
      logger.info("Email sent successfully", { to: payload.to, subject: payload.subject });
      return result;
    } catch (error) {
      logger.error("Mail send failed", {
        to: payload.to,
        subject: payload.subject,
        error: error instanceof Error ? error.message : error
      });

      if (!mailConfig.failSilent) throw error;
      return null;
    }
  },

  /**
   * Send Signup Email Verification OTP
   */
  async sendSignupOtpMail(to: string, name: string, otp: string) {
    console.log(`\n======================================================`);
    console.log(`🔐 [SIGNUP VERIFICATION OTP] Sent to: ${to}`);
    console.log(`👉 VERIFICATION CODE: ${otp} (Valid for 10 minutes)`);
    console.log(`======================================================\n`);

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Bond Data Analytics</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #bfdbfe;">Account Verification</p>
        </div>
        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 24px 0; color: #64748b;">Thank you for registering. To complete your account activation, please enter the one-time verification code below:</p>
          
          <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: monospace;">${otp}</span>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #94a3b8;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          </div>

          <p style="font-size: 13px; color: #94a3b8; margin: 0;">If you did not initiate this registration, you can safely ignore this email.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; ${new Date().getFullYear()} Bond Analytics & Reporting System. All rights reserved.
        </div>
      </div>
    `;

    return this.sendMail({
      to,
      subject: `Your Bond Analytics Verification Code: ${otp}`,
      html,
      text: `Hello ${name},\n\nYour Bond Analytics verification code is: ${otp}\nThis code will expire in 10 minutes.`
    });
  },

  /**
   * Send 2FA Login OTP
   */
  async sendLoginOtpMail(to: string, name: string, otp: string) {
    console.log(`\n======================================================`);
    console.log(`🔐 [LOGIN 2FA OTP] Sent to: ${to}`);
    console.log(`👉 LOGIN CODE: ${otp} (Valid for 5 minutes)`);
    console.log(`======================================================\n`);

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Bond Data Analytics</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #94a3b8;">Two-Factor Authentication (2FA)</p>
        </div>
        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 24px 0; color: #64748b;">A login request was detected for your account. Please use the secure 6-digit one-time password below to authorize login:</p>
          
          <div style="background-color: #eff6ff; border: 2px solid #93c5fd; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #2563eb; font-family: monospace;">${otp}</span>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Code expires in <strong>5 minutes</strong>. Single-use only.</p>
          </div>

          <div style="padding: 12px 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; margin: 0 0 20px 0;">
            <p style="margin: 0; font-size: 12px; color: #991b1b;"><strong>Security Alert:</strong> If you did not attempt to log in, please reset your password immediately to protect your account.</p>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; ${new Date().getFullYear()} Bond Analytics & Reporting System.
        </div>
      </div>
    `;

    return this.sendMail({
      to,
      subject: `Your Login Verification Code: ${otp}`,
      html,
      text: `Hello ${name},\n\nYour login code is: ${otp}\nThis code will expire in 5 minutes.`
    });
  },

  /**
   * Send Password Reset OTP
   */
  async sendResetPasswordOtpMail(to: string, name: string, otp: string) {
    console.log(`\n======================================================`);
    console.log(`🔐 [PASSWORD RESET OTP] Sent to: ${to}`);
    console.log(`👉 RESET CODE: ${otp} (Valid for 10 minutes)`);
    console.log(`======================================================\n`);

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Bond Data Analytics</h2>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: #fecaca;">Password Reset Request</p>
        </div>
        <div style="padding: 32px 28px; color: #334155; line-height: 1.6;">
          <p style="font-size: 15px; margin: 0 0 16px 0;">Hello <strong>${name || "User"}</strong>,</p>
          <p style="font-size: 14px; margin: 0 0 24px 0; color: #64748b;">We received a request to reset your password. Use the verification code below to set a new password:</p>
          
          <div style="background-color: #fef2f2; border: 2px dashed #fca5a5; border-radius: 10px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #b91c1c; font-family: monospace;">${otp}</span>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #991b1b;">This code expires in <strong>10 minutes</strong>.</p>
          </div>

          <p style="font-size: 13px; color: #94a3b8; margin: 0;">If you did not request a password reset, please ignore this message.</p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px 28px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
          &copy; ${new Date().getFullYear()} Bond Analytics & Reporting System.
        </div>
      </div>
    `;

    return this.sendMail({
      to,
      subject: `Your Password Reset Code: ${otp}`,
      html,
      text: `Hello ${name},\n\nYour password reset code is: ${otp}\nThis code will expire in 10 minutes.`
    });
  }
};
