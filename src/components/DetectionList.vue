<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DetectionItem } from '../core/types'
import DetectionItemComponent from './DetectionItem.vue'
import { AccordionRoot, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from 'reka-ui'

const props = defineProps<{
    detections: DetectionItem[]
}>()

const groupedDetections = computed(() => {
    const groups: Record<string, DetectionItem[]> = {}

    for (const item of props.detections) {
        if (!groups[item.type]) {
            groups[item.type] = []
        }
        groups[item.type].push(item)
    }

    return groups
})

const typeNames: Record<string, string> = {
    ENV_PASSWORD: '环境变量密码',
    API_KEY: 'API Key',
    DB_PASSWORD: '数据库密码',
    JWT: 'JWT Token',
    PRIVATE_KEY: '私钥',
    HIGH_ENTROPY: '高熵字符串'
}

const openTypes = ref<string[]>([])

watch(() => props.detections, () => {
    openTypes.value = Object.keys(groupedDetections.value)
}, { immediate: true })
</script>

<template>
    <div class="space-y-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-gray-700 dark:text-gray-300">
                    识别结果</h2>
                <span class="px-1.5 my-0.5 self-stretch text-xs leading-normal font-medium rounded-sm 
                        bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 ">
                    {{ detections.length }}</span>
            </div>
        </div>
        <div v-if="detections.length === 0" class="text-center py-12">
            <div
                class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            <p class="text-gray-500 dark:text-gray-400 text-sm">
                未检测到敏感信息</p>
            <p class="text-gray-400 dark:text-gray-500 text-xs mt-1">
                请粘贴包含敏感信息的文本</p>
        </div>

        <AccordionRoot v-else v-model="openTypes" type="multiple" :collapsible="true" class="flex flex-col gap-3">
            <AccordionItem v-for="(items, type) in groupedDetections"
                class="overflow-hidden"
                :key="type" :value="type as string">
                <AccordionHeader>
                    <AccordionTrigger
                        class="flex items-center justify-between w-full px-0 pb-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                {{ typeNames[type as string] || type }}
                            </span>
                            <span
                                class="px-1.5 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                {{ items.length }}
                            </span>
                        </div>
                        <svg class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 data-[state=open]:rotate-180"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </AccordionTrigger>
                </AccordionHeader>
                <AccordionContent class="p-0">
                    <div class="grid grid-cols-1 gap-3 
                        min-[1080px]:grid-cols-2 
                        min-[1200px]:grid-cols-3">
                        <DetectionItemComponent v-for="item in items" :key="item.id" :item="item" />
                    </div>
                </AccordionContent>
            </AccordionItem>
        </AccordionRoot>
    </div>
</template>
