<template>
  <div class="reports-page-container py-3">
    <!-- Executive Page Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <div class="report-icon-badge shadow-sm">
            <i class="bi bi-file-earmark-bar-graph-fill fs-4 text-white"></i>
          </div>
          <h4 class="fw-bold mb-0 text-dark tracking-tight">Portfolio Analytics & Report</h4>
          <span class="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 small fw-semibold">
            <i class="bi bi-shield-check me-1"></i> Live Database
          </span>
        </div>
        <p class="text-muted small mb-0">
          Executive financial reporting with smart multi-date range filtering, issuing bank analytics & Excel export.
        </p>
      </div>

      <!-- Action Toolbar -->
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button
          v-if="records.length > 0 || (summary && summary.totalRecords > 0)"
          class="btn btn-success btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2 shadow-sm rounded-3 export-btn"
          @click="handleExport">
          <i class="bi bi-file-earmark-excel-fill fs-6"></i>
          <span>Export Filtered Excel</span>
        </button>

        <button
          v-if="records.length > 0"
          class="btn btn-outline-secondary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2 rounded-3 bg-white shadow-sm"
          @click="windowPrint">
          <i class="bi bi-printer"></i>
          <span>Print</span>
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show shadow-sm mb-4 rounded-3 border-0" role="alert">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-exclamation-octagon-fill fs-5 text-danger"></i>
        <div>{{ error }}</div>
      </div>
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- ============================================================== -->
    <!-- 1. EXECUTIVE KPI MATRIX (3 METRIC CARDS)                       -->
    <!-- ============================================================== -->
    <div class="row g-3 mb-4">
      <!-- 1. Total LC Records Card -->
      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-metric-card rounded-3">
          <div class="card-body p-3 d-flex flex-column justify-content-between">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="text-uppercase small fw-bold text-muted letter-spacing-1">Total Records</span>
              <div class="kpi-icon-pill bg-primary-subtle text-primary">
                <i class="bi bi-layers-fill fs-6"></i>
              </div>
            </div>
            <div>
              <h3 class="fw-bold text-dark mb-1">{{ (summary?.totalRecords || 0).toLocaleString() }}</h3>
              <div class="small text-muted d-flex align-items-center gap-2">
                <span class="text-success fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>{{ (summary?.totalAccepted || 0).toLocaleString() }} Active</span>
                <span v-if="summary?.totalCancelled" class="text-danger fw-semibold">({{ summary.totalCancelled }} Cancelled)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Issuing Banks Card -->
      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-metric-card rounded-3">
          <div class="card-body p-3 d-flex flex-column justify-content-between">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="text-uppercase small fw-bold text-muted letter-spacing-1">Issuing Banks</span>
              <div class="kpi-icon-pill bg-info-subtle text-info">
                <i class="bi bi-bank fs-6"></i>
              </div>
            </div>
            <div>
              <h3 class="fw-bold text-dark mb-1">{{ Object.keys(summary?.bankBreakdown || {}).length }}</h3>
              <div class="small text-muted">Institutions in scope</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Bond Licenses Card -->
      <div class="col-12 col-md-4">
        <div class="card border-0 shadow-sm h-100 kpi-metric-card rounded-3">
          <div class="card-body p-3 d-flex flex-column justify-content-between">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <span class="text-uppercase small fw-bold text-muted letter-spacing-1">Bond Licenses</span>
              <div class="kpi-icon-pill bg-warning-subtle text-warning">
                <i class="bi bi-award-fill fs-6"></i>
              </div>
            </div>
            <div>
              <h3 class="fw-bold text-dark mb-1">{{ Object.keys(summary?.bondLicenseBreakdown || {}).length }}</h3>
              <div class="small text-muted">Active license holders</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- 2. SMART FILTER & DATE RANGE CONSOLE                           -->
    <!-- ============================================================== -->
    <div class="card border-0 shadow-sm rounded-3 mb-4 smart-filter-card">
      <div class="card-header bg-white border-0 p-3 pb-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex align-items-center gap-2">
          <div class="filter-header-icon">
            <i class="bi bi-funnel-fill text-primary"></i>
          </div>
          <div>
            <h6 class="fw-bold mb-0 text-dark">Smart Portfolio Filters</h6>
            <div class="text-muted small">Filter by Keywords, Issuing Bank, Beneficiary Bank, and Start / End Dates</div>
          </div>
        </div>

        <!-- Filter Presets & Clear -->
        <div class="d-flex align-items-center gap-2">
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="applyPreset('thisMonth')">
              This Month
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="applyPreset('last30')">
              Last 30 Days
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" @click="applyPreset('thisYear')">
              YTD ({{ new Date().getFullYear() }})
            </button>
          </div>

          <button
            v-if="hasActiveFilters"
            class="btn btn-light btn-sm text-danger border d-flex align-items-center gap-1 rounded-2"
            @click="resetFilters">
            <i class="bi bi-arrow-counterclockwise"></i>
            <span>Reset All</span>
          </button>
        </div>
      </div>

      <div class="card-body p-3 pt-2">
        <!-- Row 1: Keyword Search, Bank, Beneficiary Bank -->
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-5">
            <label class="form-label small fw-semibold text-dark mb-1">
              <i class="bi bi-search text-muted me-1"></i> Search Keyword
            </label>
            <div class="input-group input-group-sm">
              <input
                v-model="filters.search"
                type="text"
                class="form-control"
                placeholder="Search LC ID, Bank, Beneficiary, Exporter, PI..."
                @input="onFilterChange" />
              <button v-if="filters.search" class="btn btn-outline-secondary" @click="filters.search = ''; onFilterChange();">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label small fw-semibold text-dark mb-1">
              <i class="bi bi-bank text-muted me-1"></i> Issuing Bank
            </label>
            <select v-model="filters.bank" class="form-select form-select-sm" @change="onFilterChange">
              <option value="">All Issuing Banks</option>
              <option v-for="(_, b) in summary?.bankBreakdown" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <div class="col-12 col-sm-6 col-md-4">
            <label class="form-label small fw-semibold text-dark mb-1">
              <i class="bi bi-building text-muted me-1"></i> Beneficiary Bank
            </label>
            <select v-model="filters.beneficiaryBank" class="form-select form-select-sm" @change="onFilterChange">
              <option value="">All Beneficiary Banks</option>
              <option v-for="bBank in uniqueBeneficiaryBanks" :key="bBank" :value="bBank">{{ bBank }}</option>
            </select>
          </div>
        </div>

        <!-- Row 2: Smart Multi-Date Range Filters (LC Date, PI Date, Entry Date) -->
        <div class="row g-2 p-3 bg-slate-50 rounded-3 border">
          <!-- 1. LC Date Range -->
          <div class="col-12 col-lg-4">
            <div class="date-group-box p-2 bg-white rounded border h-100">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small fw-bold text-primary d-flex align-items-center gap-1">
                  <i class="bi bi-calendar-check"></i> LC Date Range
                </span>
                <button
                  v-if="filters.lcDateStart || filters.lcDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                  style="font-size: 0.75rem;"
                  @click="filters.lcDateStart = ''; filters.lcDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">Start Date</span>
                  <input
                    v-model="filters.lcDateStart"
                    type="date"
                    class="form-control form-control-sm"
                    @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">End Date</span>
                  <input
                    v-model="filters.lcDateEnd"
                    type="date"
                    class="form-control form-control-sm"
                    :min="filters.lcDateStart || undefined"
                    @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>

          <!-- 2. PI Date Range -->
          <div class="col-12 col-lg-4">
            <div class="date-group-box p-2 bg-white rounded border h-100">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small fw-bold text-success d-flex align-items-center gap-1">
                  <i class="bi bi-file-earmark-text"></i> PI Date Range
                </span>
                <button
                  v-if="filters.piDateStart || filters.piDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                  style="font-size: 0.75rem;"
                  @click="filters.piDateStart = ''; filters.piDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">Start Date</span>
                  <input
                    v-model="filters.piDateStart"
                    type="date"
                    class="form-control form-control-sm"
                    @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">End Date</span>
                  <input
                    v-model="filters.piDateEnd"
                    type="date"
                    class="form-control form-control-sm"
                    :min="filters.piDateStart || undefined"
                    @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Entry Date Range -->
          <div class="col-12 col-lg-4">
            <div class="date-group-box p-2 bg-white rounded border h-100">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <span class="small fw-bold text-info d-flex align-items-center gap-1">
                  <i class="bi bi-clock-history"></i> Entry Date Range
                </span>
                <button
                  v-if="filters.entryDateStart || filters.entryDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none"
                  style="font-size: 0.75rem;"
                  @click="filters.entryDateStart = ''; filters.entryDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">Start Date</span>
                  <input
                    v-model="filters.entryDateStart"
                    type="date"
                    class="form-control form-control-sm"
                    @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <span class="text-muted" style="font-size: 0.72rem;">End Date</span>
                  <input
                    v-model="filters.entryDateEnd"
                    type="date"
                    class="form-control form-control-sm"
                    :min="filters.entryDateStart || undefined"
                    @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Filter Badges -->
        <div v-if="hasActiveFilters" class="d-flex flex-wrap align-items-center gap-2 mt-3 pt-2 border-top">
          <span class="text-muted small fw-semibold">Active Criteria:</span>
          
          <span v-if="filters.search" class="badge bg-white text-dark border px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-search text-muted"></i> "{{ filters.search }}"
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.search = ''; onFilterChange();"></i>
          </span>

          <span v-if="filters.bank" class="badge bg-white text-dark border px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-bank text-primary"></i> {{ filters.bank }}
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.bank = ''; onFilterChange();"></i>
          </span>

          <span v-if="filters.beneficiaryBank" class="badge bg-white text-dark border px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-building text-info"></i> {{ filters.beneficiaryBank }}
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.beneficiaryBank = ''; onFilterChange();"></i>
          </span>

          <span v-if="filters.lcDateStart || filters.lcDateEnd" class="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-calendar"></i> LC: {{ filters.lcDateStart || '...' }} to {{ filters.lcDateEnd || '...' }}
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.lcDateStart = ''; filters.lcDateEnd = ''; onFilterChange();"></i>
          </span>

          <span v-if="filters.piDateStart || filters.piDateEnd" class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-calendar-check"></i> PI: {{ filters.piDateStart || '...' }} to {{ filters.piDateEnd || '...' }}
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.piDateStart = ''; filters.piDateEnd = ''; onFilterChange();"></i>
          </span>

          <span v-if="filters.entryDateStart || filters.entryDateEnd" class="badge bg-info-subtle text-info border border-info-subtle px-2 py-1 small d-flex align-items-center gap-1">
            <i class="bi bi-clock"></i> Entry: {{ filters.entryDateStart || '...' }} to {{ filters.entryDateEnd || '...' }}
            <i class="bi bi-x-circle text-danger cursor-pointer ms-1" @click="filters.entryDateStart = ''; filters.entryDateEnd = ''; onFilterChange();"></i>
          </span>
        </div>
      </div>
    </div>

    <!-- ============================================================== -->
    <!-- 3. REPORT DATA TABLE (10 Rows / Page Pagination)               -->
    <!-- ============================================================== -->
    <div class="card border-0 shadow-sm rounded-3 mb-4 report-table-card overflow-hidden">
      <!-- Toolbar Header -->
      <div class="card-header bg-white border-0 p-3 pb-2 d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h6 class="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
            <i class="bi bi-table text-primary"></i>
            <span>LC & Bond Report Grid (11 Columns)</span>
          </h6>
          <div class="text-muted small mt-1">
            Showing <strong>{{ pagination.total === 0 ? 0 : ((pagination.page - 1) * pagination.limit) + 1 }}</strong> to <strong>{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</strong> of <strong>{{ pagination.total.toLocaleString() }}</strong> matching records (10 rows/page)
          </div>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            v-if="records.length > 0"
            class="btn btn-outline-success btn-sm px-3 fw-semibold d-flex align-items-center gap-2 rounded-3"
            @click="handleExport">
            <i class="bi bi-download"></i>
            <span>Export Filtered Excel</span>
          </button>
        </div>
      </div>

      <!-- The 11 Specified Columns Grid -->
      <div class="card-body p-0 mt-2">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 text-nowrap report-table" style="font-size: 0.85rem;">
            <thead class="table-dark-custom small text-uppercase">
              <tr>
                <th class="ps-3 text-center" style="width: 50px;">#</th>
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
                  Loading portfolio report records...
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="records.length === 0">
                <td colspan="12" class="text-center py-5">
                  <div class="py-4">
                    <i class="bi bi-inbox text-muted fs-1 d-block mb-2"></i>
                    <h6 class="fw-bold text-dark">No Matching Records Found</h6>
                    <p class="text-muted small mb-3">No records matched the selected date range or filter criteria.</p>
                    <button v-if="hasActiveFilters" class="btn btn-outline-secondary btn-sm px-3 rounded-2" @click="resetFilters">
                      <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                    </button>
                  </div>
                </td>
              </tr>

              <!-- The 11 Data Columns Rows -->
              <tr v-for="(r, idx) in records" :key="r.id">
                <td class="ps-3 text-center text-muted small fw-semibold">
                  {{ (pagination.page - 1) * pagination.limit + idx + 1 }}
                </td>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <span class="bank-avatar">
                      <i class="bi bi-bank2 text-primary"></i>
                    </span>
                    <div>
                      <div class="fw-bold text-dark">{{ r.bankName }}</div>
                    </div>
                  </div>
                </td>
                <td class="text-muted">{{ r.branchName || '-' }}</td>
                <td>
                  <span class="lc-id-badge">{{ r.lcId }}</span>
                </td>
                <td class="text-end">
                  <span class="fw-bolder text-emerald">{{ formatNumber(r.lcValue) }}</span>
                  <span class="currency-tag ms-1">{{ r.currency || 'USD' }}</span>
                </td>
                <td>
                  <span class="date-chip">{{ formatDate(r.lcDate) }}</span>
                </td>
                <td>
                  <span class="date-chip">{{ formatDate(r.lcExpiryDate) }}</span>
                </td>
                <td style="max-width: 220px;" class="text-truncate text-secondary" :title="r.exporterInfo || ''">
                  {{ r.exporterInfo || '-' }}
                </td>
                <td class="text-muted">{{ r.beneficiaryBank || '-' }}</td>
                <td style="max-width: 200px;" class="fw-semibold text-truncate text-dark" :title="r.beneficiaryName || ''">
                  {{ r.beneficiaryName || '-' }}
                </td>
                <td style="max-width: 240px;" class="text-truncate text-muted" :title="r.beneficiaryAddress || ''">
                  {{ r.beneficiaryAddress || '-' }}
                </td>
                <td class="pe-3 text-muted">
                  <span class="date-chip bg-slate-100">{{ formatDate(r.entryDate) }}</span>
                </td>
              </tr>
            </tbody>

            <!-- Table Footer with Summary Stats -->
            <tfoot v-if="records.length > 0" class="table-light border-top">
              <tr class="fw-bold text-dark">
                <td colspan="4" class="ps-3 text-uppercase small text-muted">
                  Page Subtotal ({{ records.length }} records)
                </td>
                <td class="text-end text-emerald fw-bolder">
                  {{ formatNumber(currentPageSubtotal) }}
                </td>
                <td colspan="7" class="pe-3 text-muted small text-end">
                  Total Filtered Portfolio: <strong>{{ formatCurrency(summary?.totalLcValue || 0) }}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- 10-Row Pagination Footer -->
      <div v-if="totalPages > 1" class="card-footer bg-white border-top p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="text-muted small">
          Showing <strong>{{ ((pagination.page - 1) * pagination.limit) + 1 }}</strong> to <strong>{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</strong> of <strong>{{ pagination.total.toLocaleString() }}</strong> records
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            class="btn btn-outline-secondary btn-sm rounded-2"
            :disabled="pagination.page <= 1 || loading"
            @click="goToPage(pagination.page - 1)">
            <i class="bi bi-chevron-left"></i> Previous
          </button>
          
          <span class="btn btn-light btn-sm disabled border text-dark fw-semibold rounded-2 px-3">
            Page {{ pagination.page }} of {{ totalPages }}
          </span>

          <button
            class="btn btn-outline-secondary btn-sm rounded-2"
            :disabled="pagination.page >= totalPages || loading"
            @click="goToPage(pagination.page + 1)">
            Next <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHead } from "@vueuse/head";
import { computed, onMounted, reactive, ref } from "vue";
import { useBond, type BondFilterParams } from "@/composables/useBond";

useHead({ title: "Portfolio Report - Bond Analytics" });

const {
  loading,
  records,
  summary,
  pagination,
  error,
  fetchRecords,
  exportReport
} = useBond();

// 10 rows per page limit
pagination.value.limit = 10;

// Reactive Filters state
const filters = reactive<BondFilterParams>({
  search: "",
  bank: "",
  beneficiaryBank: "",
  lcDateStart: "",
  lcDateEnd: "",
  piDateStart: "",
  piDateEnd: "",
  entryDateStart: "",
  entryDateEnd: ""
});

const totalPages = computed(() => {
  return Math.ceil((pagination.value.total || 0) / pagination.value.limit) || 1;
});

// Check if any filter is active
const hasActiveFilters = computed(() => {
  return Boolean(
    filters.search ||
    filters.bank ||
    filters.beneficiaryBank ||
    filters.lcDateStart ||
    filters.lcDateEnd ||
    filters.piDateStart ||
    filters.piDateEnd ||
    filters.entryDateStart ||
    filters.entryDateEnd
  );
});

// Calculate current page subtotal
const currentPageSubtotal = computed(() => {
  return records.value.reduce((sum, r) => sum + (Number(r.lcValue) || 0), 0);
});

// Average LC Value
const averageLcValue = computed(() => {
  if (!summary.value || !summary.value.totalRecords || summary.value.totalRecords === 0) return 0;
  return summary.value.totalLcValue / summary.value.totalRecords;
});

// Unique Beneficiary Banks
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
  pagination.value.limit = 10;
  await executeSearch(1);
});

let debounceTimer: any = null;
function onFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pagination.value.page = 1;
    executeSearch(1);
  }, 250);
}

async function executeSearch(pageNumber = 1) {
  await fetchRecords({
    ...filters,
    page: pageNumber,
    limit: 10
  });
}

function resetFilters() {
  filters.search = "";
  filters.bank = "";
  filters.beneficiaryBank = "";
  filters.lcDateStart = "";
  filters.lcDateEnd = "";
  filters.piDateStart = "";
  filters.piDateEnd = "";
  filters.entryDateStart = "";
  filters.entryDateEnd = "";
  pagination.value.page = 1;
  executeSearch(1);
}

function applyPreset(preset: "thisMonth" | "last30" | "thisYear") {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  if (preset === "thisMonth") {
    filters.lcDateStart = `${y}-${m}-01`;
    filters.lcDateEnd = todayStr;
  } else if (preset === "last30") {
    const prior30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const pY = prior30.getFullYear();
    const pM = String(prior30.getMonth() + 1).padStart(2, "0");
    const pD = String(prior30.getDate()).padStart(2, "0");
    filters.lcDateStart = `${pY}-${pM}-${pD}`;
    filters.lcDateEnd = todayStr;
  } else if (preset === "thisYear") {
    filters.lcDateStart = `${y}-01-01`;
    filters.lcDateEnd = todayStr;
  }
  onFilterChange();
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  executeSearch(page);
}

function handleExport() {
  exportReport(filters);
}

function windowPrint() {
  window.print();
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
  if (!totals || Object.keys(totals).length === 0) return "USD";
  return Object.entries(totals)
    .map(([curr, amt]) => `${curr}: $${amt.toLocaleString("en-US", { maximumFractionDigits: 0 })}`)
    .join(" | ");
}
</script>

<style scoped>
.reports-page-container {
  min-height: 80vh;
}

.report-icon-badge {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tracking-tight {
  letter-spacing: -0.025em;
}

.letter-spacing-1 {
  letter-spacing: 0.05em;
}

/* KPI Hero Gradient Card */
.kpi-hero-card {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-radius: 12px;
  position: relative;
  box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.25) !important;
}

.kpi-hero-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Standard Metric Cards */
.kpi-metric-card {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.kpi-metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.06) !important;
}

.kpi-icon-pill {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Smart Filter Console */
.smart-filter-card {
  border: 1px solid #e2e8f0;
}

.filter-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-group-box {
  border-color: #e2e8f0 !important;
  transition: border-color 0.2s ease;
}

.date-group-box:focus-within {
  border-color: #93c5fd !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

/* Table Card Styling */
.report-table-card {
  border: 1px solid #e2e8f0;
}

.table-dark-custom {
  background: #0f172a;
  color: #f8fafc;
}

.table-dark-custom th {
  padding: 12px 14px;
  font-weight: 600;
  letter-spacing: 0.03em;
  border: none;
  background: #0f172a;
  color: #e2e8f0;
}

.report-table tbody tr {
  transition: background-color 0.15s ease;
}

.report-table tbody tr:hover {
  background-color: #f8fafc !important;
}

.bank-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #eff6ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
}

.lc-id-badge {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #dbeafe;
  font-size: 0.82rem;
}

.text-emerald {
  color: #059669;
}

.currency-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 5px;
  border-radius: 4px;
}

.date-chip {
  font-size: 0.8rem;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 2px 7px;
  border-radius: 4px;
}

.bg-slate-50 {
  background-color: #f8fafc;
}

.bg-slate-100 {
  background-color: #f1f5f9;
}

.cursor-pointer {
  cursor: pointer;
}

.bg-emerald-subtle {
  background-color: #ecfdf5 !important;
}

.text-emerald {
  color: #059669 !important;
}

.export-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  border: none;
}

.export-btn:hover {
  background: linear-gradient(135deg, #059669, #047857);
}
</style>
