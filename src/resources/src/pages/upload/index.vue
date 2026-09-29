<template>
  <div class="upload-page-container py-3">
    <!-- Hidden File Input -->
    <input
      ref="fileInputRef"
      type="file"
      class="d-none"
      accept=".xlsx, .xls, .csv"
      @change="onFileSelected" />

    <!-- Freeze / Fullscreen Upload & Processing Progress Overlay -->
    <div
      v-if="uploading"
      class="upload-freeze-overlay d-flex flex-column align-items-center justify-content-center">
      <div class="card border-0 shadow-lg p-4 text-center upload-progress-card">
        <div class="mb-3">
          <div class="spinner-border text-primary" style="width: 3.5rem; height: 3.5rem;" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <h5 class="fw-bold mb-1 text-dark">
          {{ isCommitting ? 'Saving to Database' : 'Processing & Parsing File' }}
        </h5>
        <p class="text-muted small mb-3">{{ uploadStatusText || 'Processing records...' }}</p>

        <!-- Progress Bar with Live Percentage Display -->
        <div class="progress mb-2" style="height: 24px; border-radius: 12px;">
          <div
            class="progress-bar progress-bar-striped progress-bar-animated bg-success fw-bold"
            role="progressbar"
            :style="{ width: uploadProgress + '%' }"
            :aria-valuenow="uploadProgress"
            aria-valuemin="0"
            aria-valuemax="100">
            {{ uploadProgress }}%
          </div>
        </div>

        <div class="d-flex justify-content-between text-muted small px-1">
          <span>{{ isCommitting ? 'Batch Size: 1,000 Rows/Req' : 'Header Detection & Validation' }}</span>
          <span class="fw-bold text-success">{{ uploadProgress }}% Completed</span>
        </div>

        <div class="mt-3 text-muted" style="font-size: 0.75rem;">
          <i class="bi bi-lock-fill me-1 text-warning"></i>
          Page is locked until operation finishes to preserve data integrity.
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show shadow-sm mb-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- Page Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h4 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <i class="bi bi-cloud-arrow-up-fill text-primary"></i>
          File Upload
        </h4>
        <p class="text-muted small mb-0">
          Upload Bangladesh Bank Excel (.xlsx, .xls) or CSV files with automated header detection & data validation.
        </p>
      </div>
    </div>

    <!-- Success Message Banner -->
    <div v-if="saveSuccess" class="alert alert-success alert-dismissible fade show shadow-sm mb-4" role="alert">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-check-circle-fill fs-4 text-success"></i>
          <div>
            <strong>Successfully Saved to Database!</strong>
            <div class="small">A total of {{ savedCount.toLocaleString() }} records have been committed to the database.</div>
          </div>
        </div>
        <div class="d-flex gap-2">
          <router-link to="/data" class="btn btn-outline-success btn-sm fw-semibold">
            <i class="bi bi-database me-1"></i> View Uploaded Data
          </router-link>
          <router-link to="/reports" class="btn btn-success btn-sm fw-semibold">
            <i class="bi bi-file-earmark-bar-graph me-1"></i> View Portfolio Report
          </router-link>
        </div>
      </div>
      <button type="button" class="btn-close" @click="saveSuccess = false"></button>
    </div>

    <!-- ========================================== -->
    <!-- 1. PREVIEW MODE (When a file is selected)  -->
    <!-- ========================================== -->
    <div v-if="isPreviewMode" class="card border-warning border-2 shadow-sm mb-4">
      <div class="card-header bg-warning-subtle border-0 p-3">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-warning text-dark fw-bold px-2 py-1">
                <i class="bi bi-eye-fill me-1"></i> Data Preview
              </span>
              <h5 class="fw-bold mb-0 text-dark">{{ previewFile?.name }}</h5>
            </div>
            <p class="text-muted small mb-0">
              Found <strong>{{ previewRows.length.toLocaleString() }}</strong> valid LC records with BANK_NAME.
              Review preview below and click <strong>"Add to Database"</strong> to save.
            </p>
          </div>

          <!-- Preview Actions -->
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary btn-sm" @click="cancelPreview">
              <i class="bi bi-x-circle me-1"></i> Cancel
            </button>
            <button
              class="btn btn-success btn-sm px-3 shadow-sm fw-semibold d-flex align-items-center gap-2"
              @click="handleCommitToDatabase">
              <i class="bi bi-cloud-arrow-up-fill"></i>
              <span>Add to Database ({{ previewRows.length.toLocaleString() }} records)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Preview Summary Metrics -->
      <div class="card-body p-3 bg-light-subtle border-bottom">
        <div class="row g-2 text-center">
          <div class="col-6 col-md-3">
            <div class="p-2 bg-white rounded border">
              <div class="text-muted small">Total Rows in File</div>
              <div class="fw-bold fs-5 text-primary">{{ previewRows.length.toLocaleString() }}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-white rounded border">
              <div class="text-muted small">Estimated Total Value</div>
              <div class="fw-bold fs-5 text-success">{{ formatCurrency(previewTotalValue) }}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-white rounded border">
              <div class="text-muted small">Issuing Banks</div>
              <div class="fw-bold fs-5 text-dark">{{ previewUniqueBanksCount }}</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="p-2 bg-white rounded border">
              <div class="text-muted small">Save Method</div>
              <div class="fw-bold fs-5 text-info">1,000 / Chunk</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Table (Showing 10 rows per page with selected columns) -->
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
            <thead class="table-dark small text-uppercase">
              <tr>
                <th class="ps-3">#</th>
                <th>BANK_NAME</th>
                <th>BRANCH_NAME</th>
                <th>LC ID</th>
                <th class="text-end">LC_VALUE</th>
                <th>BENEFICIARY_NAME</th>
                <th>BENEFICIARY_ADDRESS</th>
                <th>PI_NUMBER</th>
                <th>PI_DATE</th>
                <th class="pe-3">ENTRY_DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in previewDisplayRows" :key="idx">
                <td class="ps-3 text-muted small">{{ (previewPage - 1) * previewPageLimit + idx + 1 }}</td>
                <td class="fw-semibold text-dark">{{ r.bankName }}</td>
                <td>{{ r.branchName || '-' }}</td>
                <td class="fw-bold text-primary">{{ r.lcId }}</td>
                <td class="text-end fw-bold text-success">{{ formatNumber(r.lcValue) }}</td>
                <td style="max-width: 200px;" class="fw-semibold text-truncate" :title="r.beneficiaryName || ''">
                  {{ r.beneficiaryName || '-' }}
                </td>
                <td style="max-width: 240px;" class="text-truncate text-muted" :title="r.beneficiaryAddress || ''">
                  {{ r.beneficiaryAddress || '-' }}
                </td>
                <td>{{ r.piNumber || '-' }}</td>
                <td>{{ formatDate(r.piDate) }}</td>
                <td class="pe-3 text-muted">{{ formatDate(r.entryDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 10-Row Pagination Footer for Preview -->
      <div class="card-footer bg-white p-3 d-flex flex-wrap justify-content-between align-items-center gap-2 border-top">
        <div class="text-muted small">
          Showing <strong>{{ ((previewPage - 1) * previewPageLimit) + 1 }}</strong> to <strong>{{ Math.min(previewPage * previewPageLimit, previewRows.length) }}</strong> of <strong>{{ previewRows.length.toLocaleString() }}</strong> preview records
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="previewPage <= 1"
            @click="previewPage--">
            <i class="bi bi-chevron-left"></i> Previous
          </button>
          <span class="btn btn-light btn-sm disabled border">Page {{ previewPage }} of {{ previewTotalPages }}</span>
          <button
            class="btn btn-outline-secondary btn-sm"
            :disabled="previewPage >= previewTotalPages"
            @click="previewPage++">
            Next <i class="bi bi-chevron-right"></i>
          </button>
        </div>

        <div class="d-flex gap-2">
          <button class="btn btn-outline-secondary btn-sm" @click="cancelPreview">
            Cancel
          </button>
          <button class="btn btn-success btn-sm px-3 fw-semibold d-flex align-items-center gap-1" @click="handleCommitToDatabase">
            <i class="bi bi-cloud-arrow-up-fill"></i>
            <span>Add to Database</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- 2. FILE UPLOAD DROPZONE / CHOOSER CARD     -->
    <!-- ========================================== -->
    <div v-else class="card border-0 shadow-sm">
      <div class="card-body p-5 text-center">
        <div
          class="upload-dropzone p-5 rounded-4 border-2 border-dashed bg-light-subtle d-flex flex-column align-items-center justify-content-center cursor-pointer"
          @click="triggerFileInput"
          @dragover.prevent
          @drop.prevent="onFileDropped">
          <div class="upload-icon-box mb-3 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center shadow">
            <i class="bi bi-cloud-arrow-up fs-2"></i>
          </div>
          <h5 class="fw-bold mb-1">Choose Excel / CSV File</h5>
          <p class="text-muted small mb-3" style="max-width: 440px;">
            Drag and drop your file here, or click to browse from your computer. Supports .xlsx, .xls, and .csv formats.
          </p>
          <button class="btn btn-primary px-4 py-2 shadow-sm d-flex align-items-center gap-2">
            <i class="bi bi-folder2-open fs-5"></i>
            <span class="fw-semibold">Select File</span>
          </button>
        </div>

        <!-- Specifications & Info Box -->
        <div class="row g-3 mt-4 text-start">
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100">
              <div class="d-flex align-items-center gap-2 mb-2 text-primary fw-semibold">
                <i class="bi bi-search"></i> Smart Header Detection
              </div>
              <p class="text-muted small mb-0">
                Scans the first 25 rows to identify the genuine table header, ignoring top logos and merged banner rows automatically.
              </p>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100">
              <div class="d-flex align-items-center gap-2 mb-2 text-success fw-semibold">
                <i class="bi bi-funnel-fill"></i> Bank Name Validation
              </div>
              <p class="text-muted small mb-0">
                Rows without a valid BANK_NAME or containing Total / Grand Total summary labels are automatically excluded.
              </p>
            </div>
          </div>
          <div class="col-12 col-md-4">
            <div class="p-3 border rounded-3 bg-white h-100">
              <div class="d-flex align-items-center gap-2 mb-2 text-warning fw-semibold">
                <i class="bi bi-layers-fill"></i> 1,000 Chunk Import
              </div>
              <p class="text-muted small mb-0">
                Batched in 1,000-row chunks to ensure reliable memory performance and zero server timeouts for large datasets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { computed, ref } from "vue";
import { useBond } from "@/composables/useBond";

useHead({ title: "File Upload - Bond Analytics" });

const {
  loading,
  uploading,
  isCommitting,
  uploadProgress,
  uploadStatusText,
  error,
  previewFile,
  previewRows,
  isPreviewMode,
  prepareFilePreview,
  cancelPreview,
  commitPreviewToDatabase
} = useBond();

const fileInputRef = ref<HTMLInputElement | null>(null);
const saveSuccess = ref(false);
const savedCount = ref(0);

// 10-Row Pagination for Preview Mode
const previewPage = ref(1);
const previewPageLimit = 10;

const previewTotalPages = computed(() => {
  return Math.ceil((previewRows.value.length || 0) / previewPageLimit) || 1;
});

const previewDisplayRows = computed(() => {
  const start = (previewPage.value - 1) * previewPageLimit;
  return previewRows.value.slice(start, start + previewPageLimit);
});

// Total value of preview rows
const previewTotalValue = computed(() => {
  return previewRows.value.reduce((sum, r) => sum + (Number(r.lcValue) || 0), 0);
});

// Unique banks count in preview
const previewUniqueBanksCount = computed(() => {
  const set = new Set<string>();
  previewRows.value.forEach((r) => {
    if (r.bankName) set.add(r.bankName);
  });
  return set.size;
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function onFileSelected(e: any) {
  const file = e.target.files?.[0];
  if (!file) return;
  await handleFile(file);
}

async function onFileDropped(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  await handleFile(file);
}

async function handleFile(file: File) {
  saveSuccess.value = false;
  previewPage.value = 1;
  try {
    await prepareFilePreview(file);
  } catch (err) {
    console.error("Preview error:", err);
  } finally {
    if (fileInputRef.value) {
      fileInputRef.value.value = "";
    }
  }
}

async function handleCommitToDatabase() {
  const count = previewRows.value.length;
  try {
    await commitPreviewToDatabase();
    savedCount.value = count;
    saveSuccess.value = true;
    previewPage.value = 1;
  } catch (err) {
    console.error("Commit error:", err);
  }
}

function formatCurrency(val: any): string {
  const num = Number(val || 0);
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(val: any): string {
  const num = Number(val || 0);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(val: any): string {
  if (!val) return "-";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-") return "-";
    const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (match) {
      return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    }
    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
    }
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "-";
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return "-";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
</script>

<style scoped>
.upload-page-container {
  min-height: 75vh;
}

.upload-dropzone {
  border: 2px dashed #93c5fd;
  transition: all 0.2s ease;
}

.upload-dropzone:hover {
  background-color: #eff6ff !important;
  border-color: #3b82f6;
}

.upload-icon-box {
  width: 68px;
  height: 68px;
}

.cursor-pointer {
  cursor: pointer;
}

/* Fullscreen Freeze Loading Overlay */
.upload-freeze-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(6px);
  z-index: 99999;
  user-select: none;
}

.upload-progress-card {
  width: 90%;
  max-width: 440px;
  background: #ffffff;
  border-radius: 1rem;
}
</style>
