<template>
  <!-- Content only — CRM ModuleSidebar owns the unified nav (Find / lists / leads…). -->
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
    <router-view v-slot="{ Component }">
      <keep-alive include="SearchPage">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
// Lists / totalCount are provided by ModuleSidebar + page-level reloads.
// Keep a thin provide so ProspectsPage can still call reloadLists if injected.
import { ref, provide, onMounted } from 'vue'
import { prospectingApi } from '@/api/prospecting'
import { call } from '@/composables/api.js'

const lists = ref([])
const totalCount = ref(0)

async function loadLists() {
  try {
    const r = await call(prospectingApi.getListsWithCounts)
    lists.value = r?.lists || []
    totalCount.value = r?.total || 0
  } catch {
    lists.value = []
    totalCount.value = 0
  }
}

provide('lists', lists)
provide('totalCount', totalCount)
provide('reloadLists', loadLists)

onMounted(loadLists)
</script>
