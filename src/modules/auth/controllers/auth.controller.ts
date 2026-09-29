import { and, desc, eq, gt, lt } from "drizzle-orm";
import type { Handler } from "hono";
import { authConfig, jwtConfig } from "@/config/index.js";
import { cookie, db, dispatchEvent, HttpStatusCodes, jwt, password, urls } from "@/framework/facade.js";
import { mail } from "@/framework/support/mail.js";
import { roles } from "@/modules/auth/database/models/role.js";
import {
  emailVerificationTokens,
  otpVerifications,
  passwordResetTokens,
  refreshTokens,
  users
} from "@/modules/auth/database/models/user.js";
import {
  generateAndSaveOtp,
  hashEmailVerificationToken,
  hashResetToken,
  issueTokens,
  makeEmailVerificationToken,
  makeResetToken,
  revokeCurrentRefreshToken,
  sanitizeUser,
  validateAndBurnOtp
} from "./auth.helpers.js";

/**
 * 1. User Registration with mandatory Email OTP
 * Route: POST /auth/register
 */
export const register: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });

    if (existingUser) {
      // If user exists and is not verified, allow them to re-verify with new OTP
      if (!existingUser.emailVerifiedAt) {
        const otp = await generateAndSaveOtp(cleanEmail, "signup", 10);
        await mail.sendSignupOtpMail(cleanEmail, existingUser.name, otp);
        return c.json(
          {
            message: "Account already exists but is unverified. A 6-digit verification code has been sent to your email.",
            requireOtp: true,
            email: cleanEmail
          },
          HttpStatusCodes.OK
        );
      }
      return c.json({ message: "An account with this email already exists" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const defaultRole = await db.query.roles.findFirst({
      where: eq(roles.name, "user")
    });

    const insertResult = await db.insert(users).values({
      name: body.name.trim(),
      email: cleanEmail,
      password: await password.hashPassword(body.password),
      roleId: defaultRole?.id ?? null
    });

    const insertedId = Number((insertResult as any)[0]?.insertId ?? (insertResult as any).insertId);
    const user = await db.query.users.findFirst({
      where: eq(users.id, insertedId || 1),
      with: { role: true }
    });

    // Generate & send 6-digit Signup OTP
    const otp = await generateAndSaveOtp(cleanEmail, "signup", 10);
    await mail.sendSignupOtpMail(cleanEmail, body.name, otp);

    return c.json(
      {
        message: "Registration successful. A 6-digit verification code has been sent to your email.",
        requireOtp: true,
        email: cleanEmail
      },
      HttpStatusCodes.CREATED
    );
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ message: "Failed to register account" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 2. Verify Signup OTP
 * Route: POST /auth/verify-otp
 */
export const verifySignupOtp: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    const validation = await validateAndBurnOtp(cleanEmail, body.otp, "signup");
    if (!validation.valid) {
      return c.json({ message: validation.message || "Invalid verification code" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
      with: { role: true }
    });

    if (!user) {
      return c.json({ message: "User account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Mark user as verified
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });

    return c.json(
      {
        message: "Email verified successfully! You are now logged in.",
        data: {
          user: sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Verify Signup OTP error:", error);
    return c.json({ message: "Failed to verify signup code" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 3. User Login - Validates Credentials and Dispatches 2FA Login OTP
 * Route: POST /auth/login
 */
export const login: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
      with: { role: true }
    });

    if (!user || !(await password.verifyPassword(body.password, user.password))) {
      return c.json({ message: "Invalid email or password" }, HttpStatusCodes.UNAUTHORIZED);
    }

    // Generate 6-digit Login OTP (Valid for 5 minutes)
    const otp = await generateAndSaveOtp(cleanEmail, "login", 5);
    await mail.sendLoginOtpMail(cleanEmail, user.name, otp);

    return c.json(
      {
        message: "A 6-digit login verification code has been sent to your email address.",
        requireOtp: true,
        email: cleanEmail
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ message: "Failed to process login request" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 4. Verify 2FA Login OTP
 * Route: POST /auth/verify-login-otp
 */
export const verifyLoginOtp: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    // Verify OTP with max attempts / anti-fake protection
    const validation = await validateAndBurnOtp(cleanEmail, body.otp, "login");
    if (!validation.valid) {
      return c.json({ message: validation.message || "Invalid or expired login code" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
      with: { role: true }
    });

    if (!user) {
      return c.json({ message: "User account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // If account was unverified, auto-verify now
    if (!user.emailVerifiedAt) {
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    }

    await revokeCurrentRefreshToken(c);
    const tokens = await issueTokens(c, user, { remember: !!body.remember });

    return c.json(
      {
        message: "Login successful! Welcome back.",
        data: {
          user: sanitizeUser(user),
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Verify Login OTP error:", error);
    return c.json({ message: "Failed to verify login code" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 5. Resend OTP for Signup, Login, or Password Reset
 * Route: POST /auth/resend-otp
 */
export const resendOtp: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();
    const type = body.type || "login";

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });

    if (!user && type !== "signup") {
      return c.json({ message: "No account found with this email" }, HttpStatusCodes.NOT_FOUND);
    }

    const name = user?.name || "User";
    const expiryMins = type === "login" ? 5 : 10;
    const otp = await generateAndSaveOtp(cleanEmail, type, expiryMins);

    if (type === "signup") {
      await mail.sendSignupOtpMail(cleanEmail, name, otp);
    } else if (type === "login") {
      await mail.sendLoginOtpMail(cleanEmail, name, otp);
    } else if (type === "reset_password") {
      await mail.sendResetPasswordOtpMail(cleanEmail, name, otp);
    }

    return c.json({ message: "A new verification code has been sent to your email." }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Resend OTP error:", error);
    return c.json({ message: "Failed to resend verification code" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 6. Initiate Forgot Password flow with 6-digit OTP
 * Route: POST /auth/forgot-password
 */
export const forgotPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });

    if (user) {
      const otp = await generateAndSaveOtp(cleanEmail, "reset_password", 10);
      await mail.sendResetPasswordOtpMail(cleanEmail, user.name, otp);
    }

    return c.json(
      {
        message: "If this email is registered, a 6-digit password reset code has been sent to your inbox.",
        requireOtp: true,
        email: cleanEmail
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ message: "Failed to process forgot password request" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 7. Reset Password with 6-digit OTP & Anti-Brute-Force Protection
 * Route: POST /auth/reset-password
 */
export const resetPassword: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    // Validate OTP
    const validation = await validateAndBurnOtp(cleanEmail, body.otp, "reset_password");
    if (!validation.valid) {
      return c.json({ message: validation.message || "Invalid or expired reset code" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });

    if (!user) {
      return c.json({ message: "User account not found" }, HttpStatusCodes.NOT_FOUND);
    }

    // Update password
    await db
      .update(users)
      .set({
        password: await password.hashPassword(body.password),
        updatedAt: new Date()
      })
      .where(eq(users.id, user.id));

    // Revoke all existing login sessions
    await db.update(refreshTokens).set({ revoked: 1 }).where(eq(refreshTokens.userId, user.id));

    return c.json(
      { message: "Password reset successfully! You can now log in with your new password." },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ message: "Failed to reset password" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * 8. Legacy Email Verification (Supports OTP or Token)
 * Route: POST /auth/verify-email
 */
export const verifyEmail: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const cleanEmail = body.email.toLowerCase().trim();

    if (body.otp) {
      const validation = await validateAndBurnOtp(cleanEmail, body.otp, "signup");
      if (!validation.valid) {
        return c.json({ message: validation.message || "Invalid verification code" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
      }
    } else if (body.token) {
      const record = await db.query.emailVerificationTokens.findFirst({
        where: and(
          eq(emailVerificationTokens.email, cleanEmail),
          eq(emailVerificationTokens.token, hashEmailVerificationToken(body.token)),
          gt(emailVerificationTokens.expiresAt, new Date())
        )
      });
      if (!record) {
        return c.json({ message: "Invalid or expired verification link" }, HttpStatusCodes.UNPROCESSABLE_ENTITY);
      }
      await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, cleanEmail));
    }

    await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.email, cleanEmail));
    return c.json({ message: "Email verified successfully!" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Verify email error:", error);
    return c.json({ message: "Failed to verify email" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Rotates refresh token and reissues access credentials.
 * When: Used when access token expires but refresh token is still valid.
 * Where: POST auth refresh-token route.
 */
export const refreshToken: Handler = async (c: any) => {
  try {
    const body = c.req.valid("json");
    const payload = await jwt.verifyToken(body.refresh_token, "refresh");

    if (!payload?.jti) return c.json({ message: "Invalid refresh token" }, HttpStatusCodes.UNAUTHORIZED);

    const storedToken = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.jti, payload.jti as string)
    });

    if (!storedToken || storedToken.revoked === 1) {
      return c.json({ message: "Refresh token revoked" }, HttpStatusCodes.UNAUTHORIZED);
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await db.delete(refreshTokens).where(eq(refreshTokens.id, storedToken.id));
      return c.json({ message: "Refresh token expired" }, HttpStatusCodes.UNAUTHORIZED);
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.id as number),
      with: { role: true }
    });
    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.UNAUTHORIZED);

    const remember = !!payload.remember;
    const refreshExpiry = remember ? jwtConfig.refreshRememberExpirySeconds : undefined;
    const accessToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        roleId: user.role?.id,
        role: user.role?.name,
        remember
      },
      "access"
    );
    const newRefreshToken = await jwt.generateToken(
      {
        id: user.id,
        email: user.email,
        roleId: user.role?.id,
        role: user.role?.name,
        remember
      },
      "refresh",
      refreshExpiry
    );

    await db
      .update(refreshTokens)
      .set({
        jti: newRefreshToken.jti as string,
        expiresAt: new Date(newRefreshToken.exp * 1000),
        revoked: 0
      })
      .where(eq(refreshTokens.id, storedToken.id));

    await cookie.setAuth(c, accessToken.token);
    await cookie.setRefresh(c, newRefreshToken.token, refreshExpiry);

    return c.json(
      {
        message: "Token refreshed successfully",
        data: {
          user: sanitizeUser(user),
          access_token: accessToken.token,
          refresh_token: newRefreshToken.token,
          token_type: "Bearer"
        }
      },
      HttpStatusCodes.OK
    );
  } catch (error) {
    console.error("Refresh token error:", error);
    return c.json({ message: "Invalid or expired refresh token" }, HttpStatusCodes.UNAUTHORIZED);
  }
};

export const me: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");
    if (!auth?.id) return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);

    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(auth.id)),
      with: { role: true }
    });

    if (!user) return c.json({ message: "User not found" }, HttpStatusCodes.UNAUTHORIZED);

    return c.json({ message: "Authenticated user", data: sanitizeUser(user) }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Me error:", error);
    return c.json({ message: "Failed to fetch user" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const logout: Handler = async (c: any) => {
  try {
    await revokeCurrentRefreshToken(c);
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);
    return c.json({ message: "Logged out successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ message: "Failed to logout" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Why: Revokes all refresh tokens for account-wide logout.
 * When: Used for "logout from all devices" security action.
 * Where: POST auth logout-all-devices route.
 */
export const logoutAllDevices: Handler = async (c: any) => {
  try {
    const auth = c.get("auth");

    if (!auth) return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);

    await db.delete(refreshTokens).where(eq(refreshTokens.userId, auth.id));
    cookie.deleteAuth(c);
    cookie.deleteRefresh(c);

    return c.json({ message: "Logged out from all devices successfully" }, HttpStatusCodes.OK);
  } catch (error) {
    console.error("Logout all devices error:", error);
    return c.json({ message: "Failed to logout from all devices" }, HttpStatusCodes.INTERNAL_SERVER_ERROR);
  }
};
