<template>
  <div class="bond-dashboard-container py-3">
    <!-- Hidden Direct File Input -->
    <input
      ref="fileInputRef"
      type="file"
      class="d-none"
      accept=".xlsx, .xls, .csv"
      @change="onFileSelected" />

    <!-- Freeze / Fullscreen Upload Progress Overlay -->
    <div
      v-if="uploading"
      class="upload-freeze-overlay d-flex flex-column align-items-center justify-content-center">
      <div class="card border-0 shadow-lg p-4 text-center upload-progress-card">
        <div class="mb-3">
          <div class="spinner-border text-primary" style="width: 3.5rem; height: 3.5rem;" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>

        <h5 class="fw-bold mb-1 text-dark">Saving to Database</h5>
        <p class="text-muted small mb-3">{{ uploadStatusText || 'Saving records in chunks...' }}</p>

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
          <span>Batch: 1,000 Rows/Req</span>
          <span class="fw-bold text-success">{{ uploadProgress }}% Completed</span>
        </div>

        <div class="mt-3 text-muted" style="font-size: 0.75rem;">
          <i class="bi bi-lock-fill me-1 text-warning"></i>
          Page is locked until database save finishes to preserve data integrity.
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show shadow-sm mb-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- ========================================== -->
    <!-- DATA PREVIEW BANNER / CARD (When file chosen) -->
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
              @click="commitPreviewToDatabase">
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
              <div class="text-muted small">Save Batching</div>
              <div class="fw-bold fs-5 text-info">1,000 / Chunk</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Table -->
      <div class="card-body p-0">
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
          <table class="table table-hover table-striped align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
            <thead class="table-dark sticky-top small text-uppercase">
              <tr>
                <th class="ps-3">#</th>
                <th>BANK_NAME</th>
                <th>BRANCH_NAME</th>
                <th>LC ID</th>
                <th class="text-end">LC_VALUE</th>
                <th>LC_DATE</th>
                <th>LC_EXPIRY_DATE</th>
                <th>EXPORTER_INFO</th>
                <th>BENEFICIARY_BANK</th>
                <th>BENEFICIARY_NAME</th>
                <th>BENEFICIARY_ADDRESS</th>
                <th class="pe-3">Entry Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in previewDisplayRows" :key="idx">
                <td class="ps-3 text-muted small">{{ idx + 1 }}</td>
                <td class="fw-semibold text-dark">{{ r.bankName }}</td>
                <td>{{ r.branchName || '-' }}</td>
                <td class="fw-bold text-primary">{{ r.lcId }}</td>
                <td class="text-end fw-bold text-success">{{ formatNumber(r.lcValue) }}</td>
                <td>{{ formatDate(r.lcDate) }}</td>
                <td>{{ formatDate(r.lcExpiryDate) }}</td>
                <td style="max-width: 200px;" class="text-truncate" :title="r.exporterInfo || ''">
                  {{ r.exporterInfo || '-' }}
                </td>
                <td>{{ r.beneficiaryBank || '-' }}</td>
                <td style="max-width: 180px;" class="fw-semibold text-truncate" :title="r.beneficiaryName || ''">
                  {{ r.beneficiaryName || '-' }}
                </td>
                <td style="max-width: 220px;" class="text-truncate text-muted" :title="r.beneficiaryAddress || ''">
                  {{ r.beneficiaryAddress || '-' }}
                </td>
                <td class="pe-3 text-muted">{{ formatDate(r.entryDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="previewRows.length > 100" class="p-2 text-center text-muted small bg-light border-top">
          Showing preview of first 100 rows out of {{ previewRows.length.toLocaleString() }} total records.
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- UNIFIED PERMANENT REPORT DASHBOARD         -->
    <!-- ========================================== -->
    <!-- Top Action Bar -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h4 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <i class="bi bi-file-earmark-bar-graph-fill text-primary"></i>
          LC & Bond License Portfolio Report
        </h4>
        <p class="text-muted small mb-0">
          Automated analysis of Bank LCs, Exporters, Beneficiaries & Entry dates from Bangladesh Bank files.
        </p>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="records.length > 0 || (summary && summary.totalRecords > 0)"
          class="btn btn-outline-success btn-sm d-flex align-items-center gap-2 shadow-sm"
          @click="handleExport">
          <i class="bi bi-file-earmark-excel"></i>
          <span>Export Excel Report</span>
        </button>

        <button
          v-if="records.length > 0"
          class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm"
          title="Clear all saved records"
          @click="clearAllRecords">
          <i class="bi bi-trash"></i>
          <span>Clear All</span>
        </button>

        <button
          class="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm"
          @click="triggerFileInput">
          <i class="bi bi-cloud-arrow-up-fill"></i>
          <span>Upload Excel / CSV</span>
        </button>
      </div>
    </div>

    <!-- KPI Summary Cards Row (3 Cards) -->
    <div class="row g-3 mb-4">
      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-card">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted text-uppercase small fw-semibold">Total LC Records</span>
              <span class="badge bg-info-subtle text-info p-2 rounded-circle">
                <i class="bi bi-layers-fill fs-5"></i>
              </span>
            </div>
            <h3 class="fw-bold text-primary mb-1">{{ (summary?.totalRecords || 0).toLocaleString() }}</h3>
            <div class="small text-muted">Stored in database</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-card">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted text-uppercase small fw-semibold">Issuing Banks</span>
              <span class="badge bg-success-subtle text-success p-2 rounded-circle">
                <i class="bi bi-bank fs-5"></i>
              </span>
            </div>
            <h3 class="fw-bold text-success mb-1">{{ Object.keys(summary?.bankBreakdown || {}).length }}</h3>
            <div class="small text-muted">Financial institutions</div>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-card">
          <div class="card-body p-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted text-uppercase small fw-semibold">Bond Licenses</span>
              <span class="badge bg-warning-subtle text-warning p-2 rounded-circle">
                <i class="bi bi-award-fill fs-5"></i>
              </span>
            </div>
            <h3 class="fw-bold text-dark mb-1">{{ Object.keys(summary?.bondLicenseBreakdown || {}).length }}</h3>
            <div class="small text-muted">Active license holders</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Table & Filter Section -->
    <div class="card border-0 shadow-sm mb-4">
      <div class="card-header bg-transparent border-0 p-3 pb-0">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h6 class="fw-bold mb-0 text-dark">
              <i class="bi bi-table text-primary me-1"></i> LC & Bond Report Records
            </h6>
            <span class="text-muted small">Showing {{ records.length }} records (Total: {{ pagination.total.toLocaleString() }})</span>
          </div>

          <button
            v-if="records.length > 0"
            class="btn btn-outline-success btn-sm d-flex align-items-center gap-2"
            @click="handleExport">
            <i class="bi bi-download"></i>
            <span>Export Report (.xlsx)</span>
          </button>
        </div>

        <!-- Filter Toolbar -->
        <div class="p-3 bg-light rounded-3 d-flex flex-wrap align-items-center gap-2">
          <!-- Search input -->
          <div class="flex-grow-1" style="min-width: 220px;">
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
              <input
                v-model="searchQuery"
                type="text"
                class="form-control border-start-0"
                placeholder="Search LC ID, Bank, Beneficiary, Exporter..."
                @input="applyFilters" />
            </div>
          </div>

          <!-- Bank Filter -->
          <div style="min-width: 160px;">
            <select v-model="filterBank" class="form-select form-select-sm" @change="applyFilters">
              <option value="">All Banks</option>
              <option v-for="(_, b) in summary?.bankBreakdown" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <!-- Beneficiary Bank Filter -->
          <div style="min-width: 170px;">
            <select v-model="filterBeneficiaryBank" class="form-select form-select-sm" @change="applyFilters">
              <option value="">All Beneficiary Banks</option>
              <option v-for="bBank in uniqueBeneficiaryBanks" :key="bBank" :value="bBank">{{ bBank }}</option>
            </select>
          </div>

          <!-- Reset Filters -->
          <button
            v-if="searchQuery || filterBank || filterBeneficiaryBank"
            class="btn btn-light btn-sm text-danger border d-flex align-items-center gap-1"
            title="Reset all filters"
            @click="resetFilters">
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- The 11 Specified Columns Table -->
      <div class="card-body p-0 mt-3">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 text-nowrap" style="font-size: 0.85rem;">
            <thead class="table-light text-muted small text-uppercase">
              <tr>
                <th class="ps-3">#</th>
                <th>BANK_NAME</th>
                <th>BRANCH_NAME</th>
                <th>LC ID</th>
                <th class="text-end">LC_VALUE</th>
                <th>LC_DATE</th>
                <th>LC_EXPIRY_DATE</th>
                <th>EXPORTER_INFO</th>
                <th>BENEFICIARY_BANK</th>
                <th>BENEFICIARY_NAME</th>
                <th>BENEFICIARY_ADDRESS</th>
                <th class="pe-3">Entry Date</th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading State -->
              <tr v-if="loading">
                <td colspan="12" class="text-center py-5 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Loading records...
                </td>
              </tr>

              <!-- Empty State inside Table -->
              <tr v-else-if="records.length === 0">
                <td colspan="12" class="text-center py-5">
                  <div class="py-4">
                    <div class="display-5 text-primary mb-3">
                      <i class="bi bi-cloud-arrow-up"></i>
                    </div>
                    <h5 class="fw-bold mb-1">No LC / Bond Data in Database Yet</h5>
                    <p class="text-muted small mb-3 mx-auto" style="max-width: 440px;">
                      Upload your Bangladesh Bank Excel (.xlsx, .xls) or CSV file to view data analysis and report.
                    </p>
                    <button class="btn btn-primary px-4 py-2 shadow-sm d-inline-flex align-items-center gap-2" @click="triggerFileInput">
                      <i class="bi bi-cloud-arrow-up-fill"></i>
                      <span class="fw-semibold">Choose Excel / CSV File</span>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr v-for="(r, idx) in records" :key="r.id">
                <td class="ps-3 text-muted small">{{ (pagination.page - 1) * pagination.limit + idx + 1 }}</td>
                <td class="fw-semibold text-dark">{{ r.bankName }}</td>
                <td>{{ r.branchName || '-' }}</td>
                <td class="fw-bold text-primary">{{ r.lcId }}</td>
                <td class="text-end fw-bold text-success">{{ formatNumber(r.lcValue) }}</td>
                <td>{{ formatDate(r.lcDate) }}</td>
                <td>{{ formatDate(r.lcExpiryDate) }}</td>
                <td style="max-width: 200px;" class="text-truncate" :title="r.exporterInfo || ''">
                  {{ r.exporterInfo || '-' }}
                </td>
                <td>{{ r.beneficiaryBank || '-' }}</td>
                <td style="max-width: 180px;" class="fw-semibold text-truncate" :title="r.beneficiaryName || ''">
                  {{ r.beneficiaryName || '-' }}
                </td>
                <td style="max-width: 220px;" class="text-truncate text-muted" :title="r.beneficiaryAddress || ''">
                  {{ r.beneficiaryAddress || '-' }}
                </td>
                <td class="pe-3 text-muted">{{ formatDate(r.entryDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { computed, onMounted, ref } from "vue";
import { useBond } from "@/composables/useBond";

useHead({ title: "LC & Bond Portfolio Report" });

const {
  loading,
  uploading,
  uploadProgress,
  uploadStatusText,
  records,
  summary,
  pagination,
  error,
  previewFile,
  previewRows,
  isPreviewMode,
  prepareFilePreview,
  cancelPreview,
  commitPreviewToDatabase,
  fetchRecords,
  exportReport,
  clearAllRecords
} = useBond();

const fileInputRef = ref<HTMLInputElement | null>(null);

const searchQuery = ref("");
const filterBank = ref("");
const filterBeneficiaryBank = ref("");

// Display first 100 rows in preview mode
const previewDisplayRows = computed(() => {
  return previewRows.value.slice(0, 100);
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

// Unique list of Beneficiary Banks for filtering
const uniqueBeneficiaryBanks = computed(() => {
  const set = new Set<string>();
  records.value.forEach((r) => {
    if (r.beneficiaryBank && r.beneficiaryBank.trim() !== "") {
      set.add(r.beneficiaryBank.trim());
    }
  });
  return Array.from(set).sort();
});

onMounted(async () => {
  await fetchRecords();
});

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function onFileSelected(e: any) {
  const file = e.target.files?.[0];
  if (!file) return;

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

function applyFilters() {
  fetchRecords({
    search: searchQuery.value,
    bank: filterBank.value,
    beneficiaryBank: filterBeneficiaryBank.value
  });
}

function resetFilters() {
  searchQuery.value = "";
  filterBank.value = "";
  filterBeneficiaryBank.value = "";
  applyFilters();
}

function handleExport() {
  exportReport({
    search: searchQuery.value,
    bank: filterBank.value,
    beneficiaryBank: filterBeneficiaryBank.value
  });
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

function formatCurrencyBreakdown(totals: Record<string, number> | undefined): string {
  if (!totals) return "USD";
  return Object.entries(totals)
    .map(([curr, amt]) => `${curr}: ${amt.toLocaleString()}`)
    .join(", ");
}
</script>

<style scoped>
.bond-dashboard-container {
  min-height: 75vh;
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

.kpi-card {
  border-radius: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
}
</style>
