<template>
  <Sidebar :sections="navSections" v-model:collapsed="collapsed">
    <template #header>
      <div class="flex h-12 items-center gap-2 px-2 py-1">
        <div class="flex size-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-600 text-sm text-white font-semibold">
          P
        </div>
        <span v-if="!collapsed" class="text-base font-semibold text-ink-gray-9 transition-all duration-300">
          Prospecting
        </span>
      </div>
    </template>

    <template #sidebar-item="{ item, isCollapsed }">
      <SidebarItem
        :label="item.label"
        :suffix="item.suffix"
        :to="item.to"
        :isActive="item.isActive"
        :isCollapsed="isCollapsed"
        :onClick="item.onClick">
        <template #icon>
          <!-- colored dot for list items -->
          <span v-if="item._dotColor"
            class="size-2 rounded-full flex-shrink-0"
            :style="{ background: item._dotColor }" />
          <!-- lucide icon component -->
          <component v-else-if="item._icon" :is="item._icon" class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
    </template>

    <template #footer-items="{ isCollapsed }">
      <SidebarItem
        label="New List"
        :isCollapsed="isCollapsed"
        :onClick="() => emit('create-list')">
        <template #icon>
          <LucidePlus class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
      <SidebarItem label="Home" :isCollapsed="isCollapsed" :onClick="goHome">
        <template #icon>
          <LucideHome class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
      <SidebarItem label="Desk" :isCollapsed="isCollapsed" :onClick="goDesk">
        <template #icon>
          <LucideLayoutDashboard class="size-4 text-ink-gray-6" />
        </template>
      </SidebarItem>
    </template>
  </Sidebar>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Sidebar, SidebarItem } from 'frappe-ui'
import LucideSearch from '~icons/lucide/search'
import LucideUsers from '~icons/lucide/users'
import LucidePlus from '~icons/lucide/plus'
import LucideHome from '~icons/lucide/home'
import LucideLayoutDashboard from '~icons/lucide/layout-dashboard'

const props = defineProps({
  lists:      { type: Array,  default: () => [] },
  totalCount: { type: Number, default: 0 },
})
const emit = defineEmits(['create-list'])

const route    = useRoute()
const collapsed = ref(false)

function goHome() { location.href = '/apps' }
function goDesk() { location.href = '/desk' }

const navSections = computed(() => [
  {
    label: '',
    items: [
      {
        label: 'Find Prospects',
        _icon: LucideSearch,
        to: '/search',
        isActive: route.path === '/search',
      },
      {
        label: 'All Prospects',
        _icon: LucideUsers,
        to: '/all',
        isActive: route.path === '/all',
        suffix: String(props.totalCount || 0),
      },
    ],
  },
  {
    label: 'Lists',
    items: props.lists.map(l => ({
      label:     l.list_name,
      to:        `/list/${encodeURIComponent(l.name)}`,
      isActive:  route.params.name === l.name,
      suffix:    String(l._count || 0),
      _dotColor: l.color || '#6366f1',
    })),
  },
])
</script>
