<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDetectionStore } from '../stores/detection'
import InputArea from '../components/InputArea.vue'
import DetectionList from '../components/DetectionList.vue'
import ActionBar from '../components/ActionBar.vue'
import { Button, LoadingOverlay } from '../ui'

const store = useDetectionStore()
const inputText = ref('')
const showOverlay = ref(false)
const hasResults = computed(() => store.detections.length > 0)
const showEngineStatus = ref(false)

// [NER-disabled] 网络环境较差时禁用，启用时取消注释
// onMounted(() => {
//     store.initNER()
// })

const handleDetect = async (text: string) => {
    showOverlay.value = true
    document.body.style.overflow = 'hidden'
    const minDelay = new Promise(resolve => setTimeout(resolve, 1000))
    await Promise.all([store.detect(text), minDelay])
    showOverlay.value = false
    document.body.style.overflow = ''
}

const handleCopy = async () => {
    await store.copySanitizedText()
}

const handleClear = () => {
    store.clearAll()
    inputText.value = ''
}

const toggleEngineStatus = () => {
    showEngineStatus.value = !showEngineStatus.value
}

const engineStatusItems = computed(() => [
    {
        name: '正则规则',
        description: '环境变量、API Key、JWT、私钥、连接串密码',
        enabled: store.engineStatus.regexRules,
        icon: 'regex'
    },
    {
        name: '语义规则',
        description: '敏感变量名关键词、非敏感白名单',
        enabled: store.engineStatus.semanticRules,
        icon: 'semantic'
    },
    {
        name: '连接串解析',
        description: 'postgres、mysql、mongodb、redis、amqp',
        enabled: store.engineStatus.connectionStringParser,
        icon: 'connection'
    },
    {
        name: 'NER模型',
        description: '增强检测自然语言中的敏感实体',
        enabled: store.engineStatus.nerModel,
        icon: 'ner'
    }
])
</script>

<template>
    <div class="min-h-screen bg-linear-to-br relative
        from-gray-50 to-gray-100 
        dark:from-gray-900 dark:to-gray-950">
        <!-- 头部 -->
        <header class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
            <div class="p-3">
                <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-sm bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                    </div>
                    <div class="flex items-baseline gap-2">
                        <h1 class="text-lg font-semibold text-gray-900 dark:text-white">
                            PasteGuard</h1>
                        <p class="text-sm text-gray-500 dark:text-gray-400">
                            AI脱敏助手</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <Button
                    @click="toggleEngineStatus"
                    variant="secondary"
                    btnType="text"
                    size="sm"
                    :class="{ 'text-green-600 dark:text-green-400': store.isNERReady }"
                    >
                    <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    </Button>
                </div>
                </div>
            </div>
        </header>
        <!-- 引擎状态面板 -->
        <div v-if="showEngineStatus"
            class="mx-3 mt-3 p-3 right-0 rounded-sm shadow-sm border absolute z-10
                bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    检测引擎状态</h3>
                <button @click="showEngineStatus = false"
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
                </button>
            </div>

            <div class="flex flex-col gap-3">
                <div v-for="item in engineStatusItems" :key="item.name"
                    class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                    <div class="flex items-center gap-3">
                        <!-- <div
                        :class="[
                            'w-2 h-2 rounded-full',
                            item.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        ]"
                        /> -->
                        <div>
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {{ item.name }}
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                                {{ item.description }}
                            </p>
                        </div>
                    </div>
                    <span :class="[
                        'text-xs font-medium px-2 py-1 rounded-full',
                        item.enabled
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        ]">
                        {{ item.enabled ? '生效' : '未生效' }}</span>
                </div>
            </div>

            <!-- NER 模型操作 -->
            <div
                v-if="store.nerStatus === 'error' || store.nerStatus === 'timeout'"
                class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
            >
                <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    NER模型未加载
                    </p>
                    <p class="text-xs text-yellow-500 dark:text-yellow-400">
                    {{ store.nerError || '基础检测功能仍可正常使用' }}
                    </p>
                </div>
                <Button
                    @click="store.retryLoadNER"
                    variant="secondary"
                    btnType="outline"
                    size="sm"
                >
                    重试
                </Button>
                </div>
            </div>
        </div>
        <!-- NER 模型状态条 -->
        <div
        v-if="store.nerStatus === 'loading'"
        class="mx-4 mt-4 flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"
        >
        <svg
            class="w-5 h-5 text-blue-500 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
            />
            <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
        <div class="flex-1">
            <p class="text-sm font-medium text-blue-700 dark:text-blue-300">
            正在加载NER模型...
            </p>
            <p class="text-xs text-blue-500 dark:text-blue-400">
            首次使用需要下载模型，请稍候
            </p>
        </div>
        </div>

        <div
        v-else-if="store.nerStatus === 'error' || store.nerStatus === 'timeout'"
        class="mx-4 mt-4 flex items-center gap-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800"
        >
        <svg
            class="w-5 h-5 text-yellow-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
        </svg>
        <div class="flex-1">
            <p class="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            {{ store.nerStatus === 'timeout' ? 'NER模型加载超时' : 'NER模型加载失败' }}
            </p>
            <p class="text-xs text-yellow-500 dark:text-yellow-400">
            {{ store.nerError || '基础检测功能仍可正常使用' }}
            </p>
        </div>
        <Button
            @click="store.retryLoadNER"
            variant="secondary"
            btnType="outline"
            size="sm"
        >
            重试
        </Button>
        </div>

        <div
        v-else-if="store.nerStatus === 'success'"
        class="mx-4 mt-4 flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800"
        >
        <svg
            class="w-5 h-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
        <div class="flex-1">
            <p class="text-sm font-medium text-green-700 dark:text-green-300">
            NER模型已就绪
            </p>
            <p class="text-xs text-green-500 dark:text-green-400">
            增强检测已启用
            </p>
        </div>
        </div>

        <!-- 主内容 -->
        <main class="p-3 flex flex-col gap-3 max-w-2xl mx-auto relative">
            <InputArea
                v-model="inputText"
                :is-processing="showOverlay"
                @detect="handleDetect"
                @clear="handleClear"
            />

            <DetectionList v-if="hasResults"
                :detections="store.detections" class="mb-14"
            />
            <LoadingOverlay v-if="showOverlay" />
        </main>
    </div>
    <div class="fixed bottom-0 h-auto w-full">
        <ActionBar
            v-if="hasResults"
            @copy="handleCopy"
            @replace-all="store.replaceAll"
            @keep-all="store.keepAll"
        />
    </div>
</template>
