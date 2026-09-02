<template>
  <div :class="['pm-detail-panel', { open: !!result }]">
    <div v-if="result" class="pm-detail-inner">

      <!-- Header -->
      <div class="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
        <span class="truncate text-sm font-semibold text-ink-gray-9">{{ result.businessName }}</span>
        <Button variant="ghost" icon="x" @click="emit('close')" />
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <!-- Rating -->
        <div v-if="result.rating != null">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">{{ __('Rating') }}</p>
          <span class="text-amber-500 font-medium">★ {{ Number(result.rating).toFixed(1) }}</span>
          <span v-if="result.reviewCount" class="ml-1 text-xs text-ink-gray-5">
            ({{ __('{0} reviews', [Number(result.reviewCount).toLocaleString()]) }})
          </span>
        </div>

        <!-- Category -->
        <div v-if="result.category">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">{{ __('Category') }}</p>
          <Badge :label="result.category" theme="gray" />
        </div>

        <!-- Address -->
        <div v-if="result.address">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">{{ __('Address') }}</p>
          <p class="text-sm text-ink-gray-7">{{ result.address }}</p>
        </div>

        <!-- Phone -->
        <div v-if="result.phone">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">{{ __('Phone') }}</p>
          <a :href="`tel:${result.phone}`" class="text-sm text-ink-blue-2">{{ result.phone }}</a>
        </div>

        <!-- Website -->
        <div v-if="result.website">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-gray-5">{{ __('Website') }}</p>
          <a :href="result.website" target="_blank" rel="noreferrer"
            class="text-sm text-ink-blue-2 break-all">{{ result.website }}</a>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { Button, Badge } from 'frappe-ui'
defineProps({ result: { type: Object, default: null } })
const emit = defineEmits(['close'])
</script>
