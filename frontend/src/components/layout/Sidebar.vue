<template>
  <aside class="w-64 bg-white border-r border-neutral-200 flex flex-col h-full">
    <div class="px-6 py-5 border-b border-neutral-200">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <el-icon :size="24" color="white">
            <DataLine />
          </el-icon>
        </div>
        <div class="min-w-0">
          <h1 class="font-semibold text-neutral-800 text-base truncate">消息监控助手</h1>
          <p class="text-xs text-neutral-400">企业微信版</p>
        </div>
      </div>
    </div>

    <nav class="flex-1 px-3 py-4 overflow-y-auto">
      <div class="space-y-1">
        <router-link
          v-for="item in menuItems"
          :key="item.path"
          :to="item.path"
          class="sidebar-item flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors"
          :class="isActive(item.path) ? 'active text-primary-600 font-medium' : 'text-neutral-600 hover:bg-neutral-100'"
        >
          <el-icon class="flex-shrink-0" :size="20">
            <component :is="item.icon" />
          </el-icon>
          <span class="text-sm">{{ item.title }}</span>
        </router-link>
      </div>

      <div class="mt-8 pt-4 border-t border-neutral-200">
        <p class="px-4 mb-2 text-xs font-medium text-neutral-400 uppercase tracking-wider">快捷操作</p>
        <div class="space-y-1">


          <button
            class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors text-left"
            @click="handleRefresh"
          >
            <el-icon class="flex-shrink-0" :size="20">
              <Refresh />
            </el-icon>
            <span class="text-sm">刷新数据</span>
          </button>

          <button
            class="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors text-left"
            @click="handleSettings"
          >
            <el-icon class="flex-shrink-0" :size="20">
              <Setting />
            </el-icon>
            <span class="text-sm">系统设置</span>
          </button>
        </div>
      </div>
    </nav>

    <div class="px-4 py-4 border-t border-neutral-200">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
          <el-icon :size="20" color="#0073e6">
            <User />
          </el-icon>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-neutral-700 truncate">{{ userStore.userInfo.name || '用户' }}</p>
          <p class="text-xs text-neutral-400 truncate">{{ userStore.userInfo.department || '团队' }}</p>
        </div>
        <button
          class="p-2 text-neutral-400 hover:text-danger-500 transition-colors"
          @click="handleLogout"
          title="退出登录"
        >
          <el-icon :size="18">
            <SwitchButton />
          </el-icon>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  DataLine,
  Plus,
  Refresh,
  Setting,
  User,
  SwitchButton,
  Monitor,
  ChatLineRound,
  Bell,
  Document,
  List
} from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const menuItems = [
  {
    path: '/dashboard',
    title: '监控仪表盘',
    icon: Monitor
  },
  {
    path: '/groups',
    title: '群聊管理',
    icon: ChatLineRound
  },
  {
    path: '/tasks',
    title: '任务管理',
    icon: List
  },
  {
    path: '/reports',
    title: '数据报表',
    icon: Document
  }
]

function isActive(path) {
  return route.path === path
}



function handleRefresh() {
  window.location.reload()
}

function handleSettings() {
  router.push('/settings')
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '退出登录', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await userStore.logout()
    router.push('/login')
  } catch (error) {
    // 取消退出登录
  }
}
</script>

<style scoped>
.sidebar-item {
  position: relative;
}

.sidebar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: #0073e6;
  border-radius: 0 3px 3px 0;
}

.sidebar-item.active {
  background: linear-gradient(90deg, #e6f3ff 0%, transparent 100%);
}
</style>
