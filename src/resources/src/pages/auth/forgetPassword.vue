<template>
  <div class="auth-page-wrapper min-vh-100 d-flex align-items-center justify-content-center p-3">
    <div class="auth-card-container col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4">
      <div class="card border-0 shadow-lg rounded-4 overflow-hidden bg-white">
        <!-- Brand Header with Premium Gradient -->
        <div class="text-center py-4 px-4" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle p-2 shadow-sm mb-2" style="width: 50px; height: 50px;">
            <i class="bi bi-key-fill fs-3 text-primary"></i>
          </div>
          <h4 class="fw-bold text-white mb-1">Bond Analytics</h4>
          <p class="text-white-50 small mb-0">{{ isOtpStep ? 'Reset Your Password' : 'Forgot Password' }}</p>
        </div>

        <div class="card-body p-4">
          <!-- Alert Message -->
          <div v-if="errorMessage" class="alert alert-danger alert-dismissible fade show small py-2 px-3 mb-3 d-flex align-items-center gap-2" role="alert">
            <i class="bi bi-exclamation-triangle-fill fs-6 flex-shrink-0"></i>
            <div>{{ errorMessage }}</div>
            <button type="button" class="btn-close btn-sm ms-auto" @click="errorMessage = ''"></button>
          </div>

          <div v-if="successMessage" class="alert alert-success alert-dismissible fade show small py-2 px-3 mb-3 d-flex align-items-center gap-2" role="alert">
            <i class="bi bi-check-circle-fill fs-6 flex-shrink-0 text-success"></i>
            <div>{{ successMessage }}</div>
            <button type="button" class="btn-close btn-sm ms-auto" @click="successMessage = ''"></button>
          </div>

          <!-- ========================================== -->
          <!-- STEP 1: REQUEST OTP VIA EMAIL              -->
          <!-- ========================================== -->
          <form v-if="!isOtpStep" @submit.prevent="onForgotSubmit">
            <p class="text-muted small mb-3">
              Enter your registered account email and we'll send you a secure 6-digit one-time code to reset your password.
            </p>

            <div class="mb-3">
              <label class="form-label small fw-semibold text-dark">Email Address</label>
              <div class="input-group">
                <span class="input-group-text bg-light border-end-0"><i class="bi bi-envelope text-muted"></i></span>
                <input
                  v-model="email"
                  type="email"
                  class="form-control border-start-0"
                  placeholder="name@company.com"
                  required
                  autofocus />
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm rounded-3"
              :disabled="loading">
              <span v-if="loading" class="spinner-border spinner-border-sm" role="status"></span>
              <i v-else class="bi bi-send"></i>
              <span>{{ loading ? 'Sending Code...' : 'Send Reset Code' }}</span>
            </button>

            <div class="text-center mt-4 pt-2 border-top">
              <router-link to="/login" class="small fw-semibold text-decoration-none text-muted">
                <i class="bi bi-arrow-left me-1"></i> Back to Sign In
              </router-link>
            </div>
          </form>

          <!-- ========================================== -->
          <!-- STEP 2: VERIFY OTP AND SET NEW PASSWORD    -->
          <!-- ========================================== -->
          <div v-else>
            <div class="text-center mb-3">
              <div class="d-inline-flex p-3 rounded-circle bg-primary-subtle text-primary mb-2">
                <i class="bi bi-shield-lock-fill fs-2"></i>
              </div>
              <h5 class="fw-bold text-dark mb-1">Enter Code & New Password</h5>
              <p class="text-muted small mb-0">
                A 6-digit reset code was sent to <br />
                <strong class="text-dark">{{ email }}</strong>
              </p>
            </div>

            <form @submit.prevent="onResetSubmit">
              <div class="mb-3 text-center">
                <label class="form-label small fw-semibold text-dark">6-Digit Reset Code</label>
                <input
                  ref="otpInputRef"
                  v-model="otpCode"
                  type="text"
                  class="form-control form-control-lg text-center fw-bold fs-3 tracking-widest otp-input"
                  placeholder="• • • • • •"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  autofocus />
                <div class="form-text small mt-1">
                  <i class="bi bi-clock-history me-1"></i>
                  Code expires in <strong class="text-primary">{{ formattedTimeRemaining }}</strong>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label small fw-semibold text-dark">New Password</label>
                <div class="input-group">
                  <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock text-muted"></i></span>
                  <input
                    v-model="newPassword"
                    :type="showPassword ? 'text' : 'password'"
                    class="form-control border-start-0 border-end-0"
                    placeholder="Min 6 chars (upper, lower, special)"
                    required />
                  <button
                    type="button"
                    class="input-group-text bg-white border-start-0 text-muted"
                    @click="showPassword = !showPassword">
                    <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                  </button>
                </div>
                <div class="form-text small text-muted">Must contain uppercase, lowercase & special character</div>
              </div>

              <div class="mb-4">
                <label class="form-label small fw-semibold text-dark">Confirm New Password</label>
                <div class="input-group">
                  <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock-fill text-muted"></i></span>
                  <input
                    v-model="confirmPassword"
                    :type="showPasswordConfirm ? 'text' : 'password'"
                    class="form-control border-start-0 border-end-0"
                    placeholder="Re-enter new password"
                    required />
                  <button
                    type="button"
                    class="input-group-text bg-white border-start-0 text-muted"
                    @click="showPasswordConfirm = !showPasswordConfirm">
                    <i :class="showPasswordConfirm ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                class="btn btn-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm rounded-3 mb-3"
                :disabled="loading || otpCode.length !== 6">
                <span v-if="loading" class="spinner-border spinner-border-sm" role="status"></span>
                <i v-else class="bi bi-check-circle"></i>
                <span>{{ loading ? 'Resetting Password...' : 'Reset Password' }}</span>
              </button>
            </form>

            <!-- Resend Code Action -->
            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
              <button
                type="button"
                class="btn btn-link btn-sm text-decoration-none text-muted p-0"
                @click="backToEmail">
                <i class="bi bi-arrow-left me-1"></i> Edit Email
              </button>

              <button
                type="button"
                class="btn btn-link btn-sm text-decoration-none p-0 fw-semibold"
                :class="resendCooldown > 0 ? 'text-muted' : 'text-primary'"
                :disabled="resendCooldown > 0 || resending"
                @click="handleResendCode">
                <span v-if="resending" class="spinner-border spinner-border-sm me-1" role="status"></span>
                <i v-else class="bi bi-arrow-repeat me-1"></i>
                <span>{{ resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { computed, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

useHead({ title: "Forgot Password - Bond Analytics" });

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const isOtpStep = ref(false);
const otpCode = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const showPassword = ref(false);
const showPasswordConfirm = ref(false);
const otpInputRef = ref<HTMLInputElement | null>(null);

const loading = ref(false);
const resending = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

// Countdown timer for OTP (10 minutes = 600 seconds)
const timeRemaining = ref(600);
let timerInterval: any = null;

// Resend cooldown timer (60 seconds)
const resendCooldown = ref(0);
let cooldownInterval: any = null;

const formattedTimeRemaining = computed(() => {
  const mins = Math.floor(timeRemaining.value / 60);
  const secs = timeRemaining.value % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
});

function startOtpTimer() {
  clearInterval(timerInterval);
  timeRemaining.value = 600;
  timerInterval = setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--;
    } else {
      clearInterval(timerInterval);
      errorMessage.value = "Verification code has expired. Please request a new code.";
    }
  }, 1000);
}

function startResendCooldown() {
  clearInterval(cooldownInterval);
  resendCooldown.value = 60;
  cooldownInterval = setInterval(() => {
    if (resendCooldown.value > 0) {
      resendCooldown.value--;
    } else {
      clearInterval(cooldownInterval);
    }
  }, 1000);
}

onUnmounted(() => {
  clearInterval(timerInterval);
  clearInterval(cooldownInterval);
});

async function onForgotSubmit() {
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;

  try {
    const res = await auth.forgotPassword({
      email: email.value.trim()
    });

    isOtpStep.value = true;
    otpCode.value = "";
    successMessage.value = res.message || "A 6-digit password reset code has been sent to your email.";
    startOtpTimer();
    startResendCooldown();
    setTimeout(() => otpInputRef.value?.focus(), 100);
  } catch (err: any) {
    errorMessage.value = err.message || "Failed to send reset code.";
  } finally {
    loading.value = false;
  }
}

async function onResetSubmit() {
  if (otpCode.value.length !== 6) {
    errorMessage.value = "Please enter all 6 digits of the code.";
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    errorMessage.value = "Password confirmation does not match.";
    return;
  }

  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;

  try {
    const msg = await auth.resetPassword({
      email: email.value.trim(),
      otp: otpCode.value.trim(),
      password: newPassword.value,
      password_confirmation: confirmPassword.value
    });

    successMessage.value = msg || "Password reset successfully! Redirecting to login...";
    setTimeout(() => {
      router.push("/login");
    }, 1500);
  } catch (err: any) {
    errorMessage.value = err.message || "Invalid or expired reset code.";
    otpCode.value = "";
  } finally {
    loading.value = false;
  }
}

async function handleResendCode() {
  if (resendCooldown.value > 0 || resending.value) return;

  errorMessage.value = "";
  successMessage.value = "";
  resending.value = true;

  try {
    const msg = await auth.resendOtp({
      email: email.value.trim(),
      type: "reset_password"
    });
    successMessage.value = msg || "A fresh reset code has been sent.";
    startOtpTimer();
    startResendCooldown();
  } catch (err: any) {
    errorMessage.value = err.message || "Failed to resend code.";
  } finally {
    resending.value = false;
  }
}

function backToEmail() {
  isOtpStep.value = false;
  otpCode.value = "";
  errorMessage.value = "";
  successMessage.value = "";
  clearInterval(timerInterval);
}
</script>

<style scoped>
.auth-page-wrapper {
  background: #f1f5f9;
}

.auth-card-container {
  max-width: 440px;
  width: 100%;
}

.tracking-widest {
  letter-spacing: 0.35em;
}

.otp-input {
  font-family: monospace;
  background-color: #f8fafc;
  border: 2px solid #cbd5e1;
  transition: all 0.2s ease;
}

.otp-input:focus {
  background-color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
}
</style>
