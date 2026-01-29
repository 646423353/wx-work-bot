<template>
  <header class="bg-white border-b border-neutral-200 px-6 py-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-neutral-800">{{ title }}</h1>
        <p class="text-sm text-neutral-500 mt-1">{{ description }}</p>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 px-3 py-1.5 bg-success-50 rounded-full">
          <span class="w-2 h-2 bg-success-500 rounded-full live-indicator"></span>
          <span class="text-xs font-medium text-success-600">实时监控中</span>
        </div>

        <span class="text-sm text-neutral-400">最后更新: {{ lastUpdated }}</span>

        <button
          class="p-2 text-neutral-400 hover:text-primary-500 transition-colors"
          @click="handleRefresh"
          title="刷新数据"
        >
          <el-icon :size="18">
            <Refresh />
          </el-icon>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'

const props = defineProps({
  title: {
    type: String,
    default: '监控仪表盘'
  },
  description: {
    type: String,
    default: '实时监控群聊消息状态，快速响应未回复消息'
  }
})

const emit = defineEmits(['refresh'])

const lastUpdated = ref('')
let timer = null

function updateTime() {
  const now = new Date()
  lastUpdated.value = now.toLocaleTimeString('zh-CN', { hour12: false })
}

function handleRefresh() {
  emit('refresh')
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style scoped>
@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.live-indicator {
  animation: pulse-dot 2s ease-in-out infinite;
}
</style>
