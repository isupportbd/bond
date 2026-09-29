import axios from "axios";
import { defineStore } from "pinia";
import { ref } from "vue";
import { type AuthUser, clearUser, setUser } from "@/composables/useAuth";

type LoginPayload = { email: string; password: string; remember?: boolean };
type VerifyLoginOtpPayload = { email: string; otp: string; remember?: boolean };
type VerifySignupOtpPayload = { email: string; otp: string; remember?: boolean };
type ResendOtpPayload = { email: string; type?: "signup" | "login" | "reset_password" };
type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};
type VerifyEmailPayload = { email: string; token?: string; otp?: string };
type ForgotPayload = { email: string };
type ResetPayload = {
  email: string;
  otp: string;
  password: string;
  password_confirmation: string;
};

type ApiResponse<T> = { message: string; requireOtp?: boolean; email?: string; data?: T };
type AuthData = { user: AuthUser; access_token?: string; refresh_token?: string };

async function request<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<ApiResponse<T>> {
  try {
    const response = await axios.request<ApiResponse<T>>({
      method,
      url: `/api/auth${path}`,
      data: payload
    });

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw new Error(String(error.response?.data?.message || error.message || "Request failed"));
    }
    throw new Error("Request failed");
  }
}

const MAX_BOOTSTRAP_ATTEMPTS = 5;
const BOOTSTRAP_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const isAuthenticated = ref(false);
  const processing = ref(false);
  const initialized = ref(false);

  const syncUser = (value: AuthUser | null) => {
    user.value = value;
    isAuthenticated.value = !!value;
    if (value) setUser(value);
    else clearUser();
  };

  const bootstrap = async () => {
    if (initialized.value) return;

    for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt++) {
      try {
        const response = await axios.get<ApiResponse<AuthUser>>("/api/auth/me");
        syncUser((response.data?.data || null) as AuthUser | null);
        break;
      } catch (error) {
        const backendUnreachable = axios.isAxiosError(error) && !error.response;
        if (!backendUnreachable || attempt === MAX_BOOTSTRAP_ATTEMPTS) {
          syncUser(null);
          break;
        }
        await sleep(BOOTSTRAP_BACKOFF_MS * 2 ** (attempt - 1));
      }
    }

    initialized.value = true;
  };

  const login = async (payload: LoginPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/login", payload);
      if (data.requireOtp) {
        return { requireOtp: true, email: data.email || payload.email, message: data.message };
      }
      if (data?.data?.user) {
        syncUser(data.data.user as AuthUser);
        initialized.value = true;
      }
      return { requireOtp: false, message: data.message || "Login successful" };
    } finally {
      processing.value = false;
    }
  };

  const verifyLoginOtp = async (payload: VerifyLoginOtpPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/verify-login-otp", payload);
      syncUser((data?.data?.user || null) as AuthUser | null);
      initialized.value = true;
      return data.message || "Login successful";
    } finally {
      processing.value = false;
    }
  };

  const register = async (payload: RegisterPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/register", payload);
      if (data.requireOtp) {
        return { requireOtp: true, email: data.email || payload.email, message: data.message };
      }
      const createdUser = (data?.data?.user || null) as AuthUser | null;
      if (createdUser) {
        syncUser(createdUser);
        initialized.value = true;
      }
      return { requireOtp: false, message: data.message || "Registration successful" };
    } finally {
      processing.value = false;
    }
  };

  const verifySignupOtp = async (payload: VerifySignupOtpPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/verify-otp", payload);
      syncUser((data?.data?.user || null) as AuthUser | null);
      initialized.value = true;
      return data.message || "Email verified successfully";
    } finally {
      processing.value = false;
    }
  };

  const resendOtp = async (payload: ResendOtpPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/resend-otp", payload);
      return data.message || "A new verification code has been sent";
    } finally {
      processing.value = false;
    }
  };

  const verifyEmail = async (payload: VerifyEmailPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/verify-email", payload);
      return data.message || "Email verified successfully";
    } finally {
      processing.value = false;
    }
  };

  const forgotPassword = async (payload: ForgotPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/forgot-password", payload);
      return { requireOtp: true, email: data.email || payload.email, message: data.message };
    } finally {
      processing.value = false;
    }
  };

  const resetPassword = async (payload: ResetPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/reset-password", payload);
      return data.message || "Password reset successfully";
    } finally {
      processing.value = false;
    }
  };

  const logout = async () => {
    processing.value = true;
    try {
      await request<unknown>("POST", "/logout");
    } finally {
      syncUser(null);
      processing.value = false;
      initialized.value = true;
    }
  };

  return {
    user,
    isAuthenticated,
    processing,
    initialized,
    bootstrap,
    register,
    verifySignupOtp,
    login,
    verifyLoginOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    verifyEmail,
    logout
  };
});
