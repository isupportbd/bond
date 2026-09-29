<template>
  <!-- sidebar start -->
  <div class="sidebar">
    <a
      href="#"
      role="button"
      class="sidebar-toggle card card-body rounded-circle position-absolute top-0 end-0 d-xl-none"
      title="sidebar-toggle"
      @click.prevent="props.onToggleSidebar">
      <i class="bi bi-chevron-left fw-bold"></i>
    </a>

    <div class="app-brand px-3 py-3 border-bottom">
      <router-link to="/upload" class="d-flex align-items-center gap-2 text-decoration-none text-dark">
        <i class="bi bi-graph-up-arrow fs-4 text-primary"></i>
        <span class="fw-bold fs-5 tracking-tight">Bond Analytics</span>
      </router-link>
    </div>

    <div id="accordion-sidebar" class="accordion accordion-flush mt-3">
      <ul class="list-group px-3">
        <!-- 1. File Upload Menu -->
        <li class="list-group-item" :class="{ active: isActive('/upload') || isActive('/') }">
          <router-link to="/upload">
            <div class="menu-icon">
              <i class="bi bi-cloud-arrow-up-fill"></i>
            </div>
            <span>File Upload</span>
          </router-link>
        </li>

        <!-- 2. Uploaded Data Menu -->
        <li class="list-group-item" :class="{ active: isActive('/data') }">
          <router-link to="/data">
            <div class="menu-icon">
              <i class="bi bi-database-fill-check"></i>
            </div>
            <span>Uploaded Data</span>
          </router-link>
        </li>

        <!-- 3. Report Menu -->
        <li class="list-group-item" :class="{ active: isActive('/reports') }">
          <router-link to="/reports">
            <div class="menu-icon">
              <i class="bi bi-file-earmark-bar-graph-fill"></i>
            </div>
            <span>Portfolio Report</span>
          </router-link>
        </li>
      </ul>
    </div>
  </div>
  <!-- sidebar end -->
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAdminUiStore } from "@/stores/admin-ui";

const props = defineProps<{ onToggleSidebar: () => void; }>();

const ui = useAdminUiStore();
const route = useRoute();

function isActive(path: string) {
  return route.path === path;
}

onMounted(() => ui.initSidebarCollapsePersistence());
onBeforeUnmount(() => ui.cleanupSidebarCollapsePersistence());
</script>

<style lang="scss" scoped>
.sidebar {
  .list-group-item {
    border-radius: 0.5rem;
    margin-bottom: 0.25rem;
    
    a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      color: #475569;
      font-weight: 500;
      text-decoration: none;
      border-radius: 0.5rem;
      transition: all 0.2s ease;

      .menu-icon {
        font-size: 1.15rem;
        display: flex;
        align-items: center;
      }
    }

    &:hover a {
      background-color: #f1f5f9;
      color: #0f172a;
    }

    &.active a {
      background-color: #e0f2fe;
      color: #0284c7;
      font-weight: 600;

      .menu-icon {
        color: #0284c7;
      }
    }
  }
}
</style>
