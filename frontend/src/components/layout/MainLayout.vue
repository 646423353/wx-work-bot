<template>
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <main class="flex-1 flex flex-col overflow-hidden">
      <Header
        :title="headerTitle"
        :description="headerDescription"
        :show-add-button="showAddButton"
        @refresh="handleRefresh"
        @add="handleAdd"
      />
      <div class="flex-1 overflow-y-auto p-6 bg-neutral-100">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './Sidebar.vue'
import Header from './Header.vue'

const route = useRoute()

const headerTitle = computed(() => {
  const titles = {
    '/dashboard': '监控仪表盘',
    '/groups': '群聊管理',
    '/alerts': '告警配置',
    '/reports': '数据报表',
    '/settings': '系统设置'
  }
  return titles[route.path] || '监控仪表盘'
})

const headerDescription = computed(() => {
  const descriptions = {
    '/dashboard': '实时监控群聊消息状态，快速响应未回复消息',
    '/groups': '管理监控的群聊列表，配置监控规则和成员信息',
    '/alerts': '配置告警规则，设置敏感词和通知方式',
    '/reports': '查看数据报表，导出监控数据和分析结果',
    '/settings': '系统设置和个性化配置'
  }
  return descriptions[route.path] || '实时监控群聊消息状态，快速响应未回复消息'
})

const showAddButton = computed(() => {
  return route.path === '/dashboard' || route.path === '/groups'
})

function handleRefresh() {
  window.location.reload()
}

function handleAdd() {
  // Add button clicked
}
</script>
