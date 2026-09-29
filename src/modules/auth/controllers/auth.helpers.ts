import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { jwtConfig } from "@/config/index.js";
import { cookie, db, jwt } from "@/framework/facade.js";
import { otpVerifications, refreshTokens, users } from "@/modules/auth/database/models/user.js";

export function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, rememberToken, ...sanitized } = user;
  return sanitized;
}

export function makeEmailVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashEmailVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function makeResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hasRole(auth: any, rolesToMatch: string[]) {
  const role = String(auth?.role || "").toLowerCase();
  return rolesToMatch.includes(role);
}

export async function getCurrentUser(auth: any) {
  if (!auth?.id) return null;
  return db.query.users.findFirst({
    where: eq(users.id, Number(auth.id)),
    with: { role: true },
    columns: {
      password: false,
      rememberToken: false,
    }
  });
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP
 */
export function makeOtp(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Hashes OTP using SHA-256 for secure database storage
 */
export function hashOtp(otp: string): string {
  return createHash("sha256").update(String(otp).trim()).digest("hex");
}

/**
 * Stores a fresh OTP and purges obsolete OTPs for the given email and type
 */
export async function generateAndSaveOtp(
  email: string,
  type: "signup" | "login" | "reset_password",
  expiryMinutes = 10
): Promise<string> {
  const otp = makeOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  // Remove existing pending OTPs of this type for this email
  await db
    .delete(otpVerifications)
    .where(and(eq(otpVerifications.email, email.toLowerCase().trim()), eq(otpVerifications.type, type)));

  // Insert fresh record
  await db.insert(otpVerifications).values({
    email: email.toLowerCase().trim(),
    otpHash,
    type,
    attempts: 0,
    maxAttempts: 5,
    expiresAt,
    createdAt: new Date()
  });

  return otp;
}

/**
 * Securely validates OTP with brute-force / fake OTP protection:
 * - Checks expiration
 * - Tracks failed attempts (burns OTP after 5 wrong attempts)
 * - Single-use (burns on success)
 */
export async function validateAndBurnOtp(
  email: string,
  rawOtp: string,
  type: "signup" | "login" | "reset_password"
): Promise<{ valid: boolean; message?: string }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = String(rawOtp || "").trim();

  if (!cleanOtp || cleanOtp.length !== 6) {
    return { valid: false, message: "Please enter a valid 6-digit verification code." };
  }

  const record = await db.query.otpVerifications.findFirst({
    where: and(eq(otpVerifications.email, cleanEmail), eq(otpVerifications.type, type)),
    orderBy: [desc(otpVerifications.id)]
  });

  if (!record) {
    return { valid: false, message: "No active verification code found. Please request a new code." };
  }

  // 1. Check expiration
  if (record.expiresAt.getTime() < Date.now()) {
    await db.delete(otpVerifications).where(eq(otpVerifications.id, record.id));
    return { valid: false, message: "Verification code has expired. Please request a new code." };
  }

  // 2. Check if already exceeded max attempts
  if (record.attempts >= record.maxAttempts) {
    await db.delete(otpVerifications).where(eq(otpVerifications.id, record.id));
    return {
      valid: false,
      message: "Too many incorrect attempts. This code has been locked for security. Please request a new code."
    };
  }

  // 3. Compare hash
  const inputHash = hashOtp(cleanOtp);
  if (inputHash !== record.otpHash) {
    const newAttempts = record.attempts + 1;
    if (newAttempts >= record.maxAttempts) {
      await db.delete(otpVerifications).where(eq(otpVerifications.id, record.id));
      return {
        valid: false,
        message: "Maximum invalid attempts reached. This code has been invalidated. Please request a new code."
      };
    }

    await db
      .update(otpVerifications)
      .set({ attempts: newAttempts })
      .where(eq(otpVerifications.id, record.id));

    const remaining = record.maxAttempts - newAttempts;
    return {
      valid: false,
      message: `Invalid code. ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining before code locks.`
    };
  }

  // 4. Success: Burn OTP immediately (single-use guarantee)
  await db.delete(otpVerifications).where(eq(otpVerifications.id, record.id));
  return { valid: true };
}

/**
 * Why: Revokes currently active refresh token from cookie context.
 * When: Used before issuing new tokens or during logout.
 * Where: Called by register/login/logout flows.
 */
export async function revokeCurrentRefreshToken(c: any) {
  const token = await cookie.getRefresh(c);
  if (!token) return;

  const payload = await jwt.verifyToken(token, "refresh");
  if (payload?.jti) {
    await db.delete(refreshTokens).where(eq(refreshTokens.jti, payload.jti as string));
  }
}

/**
 * Why: Issues access+refresh tokens, persists refresh token, sets cookies.
 * When: Used after successful auth actions (register/login/refresh patterns).
 * Where: Called by auth.controller handlers.
 */
export async function issueTokens(c: any, user: any, options?: { remember?: boolean; }) {
  const remember = !!options?.remember;
  const refreshExpiry = remember ? jwtConfig.refreshRememberExpirySeconds : jwtConfig.refreshExpirySeconds;
  const role = user.role || null;
  const accessToken = await jwt.generateToken(
    {
      id: user.id,
      email: user.email,
      roleId: role?.id ?? null,
      role: role?.name ?? null,
      remember
    },
    "access"
  );
  const refreshToken = await jwt.generateToken(
    {
      id: user.id,
      email: user.email,
      roleId: role?.id ?? null,
      role: role?.name ?? null,
      remember
    },
    "refresh",
    refreshExpiry
  );

  if (refreshToken.jti) {
    await db.insert(refreshTokens).values({
      userId: user.id,
      jti: refreshToken.jti,
      revoked: 0,
      expiresAt: new Date(refreshToken.exp * 1000)
    });
  }

  await cookie.setAuth(c, accessToken.token);
  await cookie.setRefresh(c, refreshToken.token, refreshExpiry);

  return { accessToken: accessToken.token, refreshToken: refreshToken.token };
}
