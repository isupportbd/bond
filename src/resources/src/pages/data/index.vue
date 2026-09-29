<template>
  <div class="data-page-container py-3">
    <!-- Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h4 class="fw-bold mb-1 d-flex align-items-center gap-2">
          <i class="bi bi-database-fill-check text-primary"></i>
          Master Records (All 31 Columns)
        </h4>
        <p class="text-muted small mb-0">
          Complete master repository displaying all 31 fields from Bangladesh Bank exports with smart filters.
        </p>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="records.length > 0"
          class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 shadow-sm rounded-2"
          title="Clear all database records"
          @click="clearAllRecords">
          <i class="bi bi-trash"></i>
          <span>Clear All Data</span>
        </button>

        <router-link to="/upload" class="btn btn-primary btn-sm d-flex align-items-center gap-2 shadow-sm rounded-2">
          <i class="bi bi-cloud-arrow-up-fill"></i>
          <span>Upload More Files</span>
        </router-link>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="alert alert-danger alert-dismissible fade show shadow-sm mb-3 rounded-3" role="alert">
      <i class="bi bi-exclamation-triangle-fill me-2"></i>
      {{ error }}
      <button type="button" class="btn-close" @click="error = null"></button>
    </div>

    <!-- Smart Filter Card -->
    <div class="card border-0 shadow-sm rounded-3 mb-4">
      <div class="card-header bg-white border-0 p-3 pb-2 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="d-flex align-items-center gap-2">
          <i class="bi bi-funnel text-primary fs-5"></i>
          <h6 class="fw-bold mb-0 text-dark">Data Filter & Date Selection</h6>
        </div>

        <button
          v-if="hasActiveFilters"
          class="btn btn-light btn-sm text-danger border d-flex align-items-center gap-1 rounded-2"
          @click="resetFilters">
          <i class="bi bi-arrow-counterclockwise"></i>
          <span>Reset All</span>
        </button>
      </div>

      <div class="card-body p-3 pt-1">
        <!-- Row 1: Search, Bank, Beneficiary Bank -->
        <div class="row g-2 mb-3">
          <div class="col-12 col-md-5">
            <label class="form-label small fw-semibold text-muted mb-1">Search Keywords</label>
            <div class="input-group input-group-sm">
              <span class="input-group-text bg-white border-end-0"><i class="bi bi-search text-muted"></i></span>
              <input
                v-model="filters.search"
                type="text"
                class="form-control border-start-0"
                placeholder="Search LC ID, Bank, Beneficiary, Exporter..."
                @input="onFilterChange" />
              <button v-if="filters.search" class="btn btn-white border border-start-0" @click="filters.search = ''; onFilterChange();">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label small fw-semibold text-muted mb-1">Issuing Bank</label>
            <select v-model="filters.bank" class="form-select form-select-sm" @change="onFilterChange">
              <option value="">All Issuing Banks</option>
              <option v-for="(_, b) in summary?.bankBreakdown" :key="b" :value="b">{{ b }}</option>
            </select>
          </div>

          <div class="col-12 col-sm-6 col-md-4">
            <label class="form-label small fw-semibold text-muted mb-1">Beneficiary Bank</label>
            <select v-model="filters.beneficiaryBank" class="form-select form-select-sm" @change="onFilterChange">
              <option value="">All Beneficiary Banks</option>
              <option v-for="bBank in uniqueBeneficiaryBanks" :key="bBank" :value="bBank">{{ bBank }}</option>
            </select>
          </div>
        </div>

        <!-- Row 2: LC Date, PI Date, Entry Date Ranges -->
        <div class="row g-2 p-3 bg-light rounded-3 border">
          <!-- LC Date -->
          <div class="col-12 col-lg-4">
            <div class="p-2 bg-white rounded border">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-primary"><i class="bi bi-calendar-event me-1"></i>LC Date</span>
                <button
                  v-if="filters.lcDateStart || filters.lcDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none small"
                  @click="filters.lcDateStart = ''; filters.lcDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <input v-model="filters.lcDateStart" type="date" class="form-control form-control-sm" @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <input v-model="filters.lcDateEnd" type="date" class="form-control form-control-sm" :min="filters.lcDateStart || undefined" @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>

          <!-- PI Date -->
          <div class="col-12 col-lg-4">
            <div class="p-2 bg-white rounded border">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-success"><i class="bi bi-file-earmark-check me-1"></i>PI Date</span>
                <button
                  v-if="filters.piDateStart || filters.piDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none small"
                  @click="filters.piDateStart = ''; filters.piDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <input v-model="filters.piDateStart" type="date" class="form-control form-control-sm" @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <input v-model="filters.piDateEnd" type="date" class="form-control form-control-sm" :min="filters.piDateStart || undefined" @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>

          <!-- Entry Date -->
          <div class="col-12 col-lg-4">
            <div class="p-2 bg-white rounded border">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-info"><i class="bi bi-clock me-1"></i>Entry Date</span>
                <button
                  v-if="filters.entryDateStart || filters.entryDateEnd"
                  class="btn btn-link btn-sm p-0 text-danger text-decoration-none small"
                  @click="filters.entryDateStart = ''; filters.entryDateEnd = ''; onFilterChange();">
                  Clear
                </button>
              </div>
              <div class="row g-1">
                <div class="col-6">
                  <input v-model="filters.entryDateStart" type="date" class="form-control form-control-sm" @change="onFilterChange" />
                </div>
                <div class="col-6">
                  <input v-model="filters.entryDateEnd" type="date" class="form-control form-control-sm" :min="filters.entryDateStart || undefined" @change="onFilterChange" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Table Card -->
    <div class="card border-0 shadow-sm rounded-3">
      <div class="card-header bg-white border-0 p-3 pb-0">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div>
            <h6 class="fw-bold mb-0 text-dark">
              <i class="bi bi-list-columns-reverse text-primary me-1"></i> Master Records Table (31 Columns)
            </h6>
            <span class="text-muted small">
              Total Matches: <strong>{{ pagination.total.toLocaleString() }}</strong> | Page {{ pagination.page }} of {{ totalPages }} (10 rows/page)
            </span>
          </div>
        </div>
      </div>

      <!-- Data Table with all 31 Columns -->
      <div class="card-body p-0 mt-2">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0 text-nowrap" style="font-size: 0.82rem;">
            <thead class="table-light text-muted small text-uppercase">
              <tr>
                <th class="ps-3">#</th>
                <th>BANK_NAME</th>
                <th>BRANCH_NAME</th>
                <th>ADSCODE</th>
                <th>LC_YEAR</th>
                <th>LC_NATURE</th>
                <th>LC_SERIAL</th>
                <th>LC ID</th>
                <th class="text-end">LC_VALUE</th>
                <th>CURRENCY</th>
                <th>LC_DATE</th>
                <th>LC_EXPIRY_DATE</th>
                <th>BB_USANSE_PERIOD</th>
                <th>LAST_SHIP_DATE</th>
                <th>IRC</th>
                <th>EXPORTER_INFO</th>
                <th>APPLICANT_NAME</th>
                <th>EXPORT_LC_NUMBER</th>
                <th>PROCEEDS_DATE</th>
                <th>BENEFICIARY_BANK</th>
                <th>BENIFICIARY_BRANCH</th>
                <th>BENEFICIARY_NAME</th>
                <th>BENEFICIARY_ADDRESS</th>
                <th>BENEFICIARY_IRC</th>
                <th>BENEFICIARY_ERC</th>
                <th>PI_NUMBER</th>
                <th>PI_DATE</th>
                <th>BOND_LICENSE</th>
                <th>ACCEPTED</th>
                <th>CANCEL_YN</th>
                <th>CANCEL_CAUSE</th>
                <th class="pe-3">ENTRY_DATE</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="32" class="text-center py-5 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                  Loading records from database...
                </td>
              </tr>
              <tr v-else-if="records.length === 0">
                <td colspan="32" class="text-center py-5 text-muted">
                  <div class="py-4">
                    <i class="bi bi-inbox fs-1 text-muted d-block mb-2"></i>
                    <h6 class="fw-bold text-dark">No records found</h6>
                    <p class="small text-muted mb-3">No matching records found for the selected filters.</p>
                    <button v-if="hasActiveFilters" class="btn btn-outline-secondary btn-sm px-3 rounded-2" @click="resetFilters">
                      <i class="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-for="(r, idx) in records" :key="r.id">
                <td class="ps-3 text-muted small">{{ (pagination.page - 1) * pagination.limit + idx + 1 }}</td>
                <td class="fw-semibold text-dark">{{ r.bankName }}</td>
                <td>{{ r.branchName || '-' }}</td>
                <td>{{ r.adsCode || '-' }}</td>
                <td>{{ r.lcYear || '-' }}</td>
                <td>{{ r.lcNature || '-' }}</td>
                <td>{{ r.lcSerial || '-' }}</td>
                <td class="fw-bold text-primary">{{ r.lcId }}</td>
                <td class="text-end fw-bold text-success">{{ formatNumber(r.lcValue) }}</td>
                <td><span class="badge bg-secondary-subtle text-secondary">{{ r.currency || 'USD' }}</span></td>
                <td>{{ formatDate(r.lcDate) }}</td>
                <td>{{ formatDate(r.lcExpiryDate) }}</td>
                <td>{{ r.bbUsansePeriod || '-' }}</td>
                <td>{{ formatDate(r.lastShipDate) }}</td>
                <td>{{ r.irc || '-' }}</td>
                <td style="max-width: 200px;" class="text-truncate" :title="r.exporterInfo || ''">
                  {{ r.exporterInfo || '-' }}
                </td>
                <td style="max-width: 180px;" class="text-truncate" :title="r.applicantName || ''">
                  {{ r.applicantName || '-' }}
                </td>
                <td>{{ r.exportLcNumber || '-' }}</td>
                <td>{{ formatDate(r.proceedsDate) }}</td>
                <td>{{ r.beneficiaryBank || '-' }}</td>
                <td>{{ r.beneficiaryBranch || '-' }}</td>
                <td style="max-width: 180px;" class="fw-semibold text-truncate" :title="r.beneficiaryName || ''">
                  {{ r.beneficiaryName || '-' }}
                </td>
                <td style="max-width: 220px;" class="text-truncate text-muted" :title="r.beneficiaryAddress || ''">
                  {{ r.beneficiaryAddress || '-' }}
                </td>
                <td>{{ r.beneficiaryIrc || '-' }}</td>
                <td>{{ r.beneficiaryErc || '-' }}</td>
                <td>{{ r.piNumber || '-' }}</td>
                <td>{{ formatDate(r.piDate) }}</td>
                <td><span class="badge bg-light text-dark border">{{ r.bondLicense || 'N/A' }}</span></td>
                <td><span class="badge" :class="r.accepted === 'Y' ? 'bg-success-subtle text-success' : 'bg-light text-dark'">{{ r.accepted || 'Y' }}</span></td>
                <td><span class="badge" :class="r.cancelYn === 'Y' ? 'bg-danger text-white' : 'bg-success-subtle text-success'">{{ r.cancelYn || 'N' }}</span></td>
                <td style="max-width: 160px;" class="text-truncate" :title="r.cancelCause || ''">{{ r.cancelCause || '-' }}</td>
                <td class="pe-3 text-muted">{{ formatDate(r.entryDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pagination Footer (10 rows per page) -->
      <div v-if="totalPages > 1" class="card-footer bg-white border-top p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div class="text-muted small">
          Showing <strong>{{ ((pagination.page - 1) * pagination.limit) + 1 }}</strong> to <strong>{{ Math.min(pagination.page * pagination.limit, pagination.total) }}</strong> of <strong>{{ pagination.total.toLocaleString() }}</strong> records
        </div>

        <div class="d-flex gap-2">
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

useHead({ title: "Uploaded Data - Bond Analytics" });

const {
  loading,
  records,
  summary,
  pagination,
  error,
  fetchRecords,
  clearAllRecords
} = useBond();

// 10 rows per page
pagination.value.limit = 10;

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

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return;
  executeSearch(page);
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
.data-page-container {
  min-height: 75vh;
}
</style>
