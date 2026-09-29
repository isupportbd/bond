<template>
  <div class="container position-absolute start-50 top-50 translate-middle">
    <div class="auth col-12 col-sm-10 col-md-8 col-lg-5 col-xl-4 mx-auto py-4">
      <div class="card border-0 shadow-lg rounded-4 overflow-hidden">
        <div class="card-header bg-gradient text-center py-4 border-0" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle p-2 shadow-sm mb-2" style="width: 54px; height: 54px;">
            <i class="bi bi-shield-lock-fill fs-3 text-primary"></i>
          </div>
          <h4 class="fw-bold text-white mb-0">Bond Analytics</h4>
          <p class="text-white-50 small mb-0">Reset Password</p>
        </div>

        <div class="card-body p-4 text-center">
          <p class="text-muted small mb-4">
            Password reset is securely handled with a 6-digit one-time code sent directly to your email address.
          </p>
          <router-link to="/forget-password" class="btn btn-primary w-100 py-2 fw-semibold mb-3">
            <i class="bi bi-key me-1"></i> Go to Forgot Password
          </router-link>
          <div>
            <router-link to="/login" class="small fw-semibold text-muted text-decoration-none">
              <i class="bi bi-arrow-left me-1"></i> Back to Sign In
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";

useHead({ title: "Reset Password - Bond Analytics" });
</script>
