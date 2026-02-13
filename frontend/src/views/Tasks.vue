<template>
  <div class="h-[calc(100vh-64px)] p-6">
    <div class="bg-white rounded-xl shadow-sm border border-neutral-200 h-full flex flex-col">
      <!-- 顶部操作栏 -->
      <div class="px-6 py-5 border-b border-neutral-200">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl font-bold text-neutral-800">任务管理</h1>
            <p class="text-sm text-neutral-500 mt-1">查看和管理群聊中识别到的任务</p>
          </div>
          <div class="flex gap-3">
            <el-button @click="fetchTasks" :loading="loading">
              <el-icon class="mr-1"><Refresh /></el-icon> 刷新
            </el-button>
          </div>
        </div>

        <!-- 统计卡片 -->
        <div class="grid grid-cols-4 gap-4 mb-4">
          <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition" @click="setStatusFilter('in_progress')">
            <span class="text-2xl">🔄</span>
            <div>
              <p class="text-xs text-blue-500 font-medium">进行中</p>
              <p class="text-xl font-bold text-blue-700">{{ stats.inProgress }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-100 cursor-pointer hover:bg-red-100 transition" @click="setStatusFilter('overdue')">
            <span class="text-2xl">⚠️</span>
            <div>
              <p class="text-xs text-red-500 font-medium">超时预警</p>
              <p class="text-xl font-bold text-red-700">{{ stats.overdue }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-100 cursor-pointer hover:bg-green-100 transition" @click="setStatusFilter('done')">
            <span class="text-2xl">✅</span>
            <div>
              <p class="text-xs text-green-500 font-medium">已完成</p>
              <p class="text-xl font-bold text-green-700">{{ stats.done }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-3 rounded-lg bg-neutral-50 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition" @click="setStatusFilter('')">
            <span class="text-2xl">📋</span>
            <div>
              <p class="text-xs text-neutral-500 font-medium">全部任务</p>
              <p class="text-xl font-bold text-neutral-700">{{ stats.total }}</p>
            </div>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="flex items-center gap-4">
          <el-select v-model="filters.status" placeholder="任务状态" clearable class="w-40" @change="fetchTasks">
            <el-option label="进行中" value="in_progress" />
            <el-option label="超时预警" value="overdue" />
            <el-option label="已完成" value="done" />
          </el-select>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="flex-1 overflow-hidden flex flex-col">
        <el-table
          v-loading="loading"
          :data="tasks"
          style="width: 100%; flex: 1"
          :header-cell-style="{ background: '#f8fafc', color: '#64748b' }"
          :row-class-name="tableRowClassName"
        >
          <el-table-column prop="id" label="ID" width="80" />

          <el-table-column label="任务内容" min-width="300">
            <template #default="{ row }">
              <div class="py-2">
                <p class="text-neutral-800 font-medium whitespace-pre-wrap">{{ row.content }}</p>
                <div class="flex items-center gap-2 mt-1.5">
                  <span class="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-500">
                    <el-icon class="mr-1 align-text-bottom"><ChatLineRound /></el-icon> {{ row.group_name || '未知群聊' }}
                  </span>
                  <span class="text-xs text-neutral-400">
                    创建于 {{ formatDate(row.created_at) }}
                  </span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="创建人 / 负责人" width="200">
            <template #default="{ row }">
              <div class="flex flex-col gap-1">
                <div class="flex items-center text-sm">
                  <span class="text-neutral-500 w-12 mr-2">创建人</span>
                  <el-tag size="small" type="info">{{ row.creator_name || row.creator_id }}</el-tag>
                </div>
                <div class="flex items-center text-sm">
                  <span class="text-neutral-500 w-12 mr-2">负责人</span>
                  <el-tag size="small" :type="row.assignee_id ? 'primary' : 'warning'">
                    {{ row.assignee_id || '待认领' }}
                  </el-tag>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="截止时间" width="180">
            <template #default="{ row }">
              <span v-if="row.deadline && row.deadline !== '无'" class="text-sm font-medium" :class="isOverdue(row.deadline) ? 'text-red-500' : 'text-neutral-700'">
                {{ row.deadline }}
              </span>
              <span v-else class="text-sm text-neutral-400">-</span>
            </template>
          </el-table-column>

          <el-table-column label="优先级" width="100">
            <template #default="{ row }">
              <el-tag
                :type="row.priority === 'high' ? 'danger' : row.priority === 'low' ? 'info' : ''"
                size="small"
              >
                {{ row.priority === 'high' ? '🔥 高' : row.priority === 'low' ? '低' : '中' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag :type="statusTagType(row.status)" size="small">
                {{ statusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" min-width="120" fixed="right">
            <template #default="{ row }">
              <el-tooltip content="发送催办提醒" placement="top">
                <el-button 
                  type="warning" 
                  link 
                  size="small" 
                  :icon="Bell" 
                  @click="handlePush(row)"
                  v-if="row.status !== 'done'"
                >催办</el-button>
              </el-tooltip>
              <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="px-6 py-4 border-t border-neutral-200 flex justify-end">
            <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="total"
                @size-change="fetchTasks"
                @current-change="fetchTasks"
            />
      </div>
    </div>

    <!-- 催办弹窗 -->
    <el-dialog
      v-model="pushDialogVisible"
      title="快速回复"
      width="500px"
      :close-on-click-modal="false"
    >
      <div v-if="currentPushTask">
        <p class="text-gray-500 mb-2">回复给：{{ currentPushTask.group_name || '未知群聊' }}</p>
        <div class="bg-gray-50 p-2 rounded mb-4 text-gray-600 text-sm">
          原消息：{{ currentPushTask.content }}
        </div>
        <el-input
          v-model="pushContent"
          type="textarea"
          :rows="4"
          placeholder="请输入催办内容..."
        />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="pushDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="confirmPush" :loading="pushLoading">
            发送回复
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Refresh, ChatLineRound, Bell } from '@element-plus/icons-vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const tasks = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const stats = reactive({
  inProgress: 0,
  overdue: 0,
  done: 0,
  total: 0
})

const filters = reactive({
  status: ''
})

// 催办弹窗状态
const pushDialogVisible = ref(false)
const pushContent = ref('')
const currentPushTask = ref(null)
const pushLoading = ref(false)

const setStatusFilter = (status) => {
  filters.status = status
  currentPage.value = 1
  fetchTasks()
}

const fetchTasks = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/tasks', {
      params: {
        ...filters,
        page: currentPage.value,
        pageSize: pageSize.value
      }
    })
    if (res.data.list) {
        tasks.value = res.data.list
        total.value = res.data.total
    } else if (Array.isArray(res.data)) {
        tasks.value = res.data
        total.value = res.data.length
    }
  } catch (error) {
    ElMessage.error('获取任务列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const res = await axios.get('/api/tasks/stats')
    if (res.data) {
      stats.inProgress = res.data.in_progress || 0
      stats.overdue = res.data.overdue || 0
      stats.done = res.data.done || 0
      stats.total = res.data.total || 0
    }
  } catch (error) {
    console.error('获取任务统计失败:', error)
  }
}

const statusTagType = (status) => {
  const map = {
    in_progress: 'primary',
    overdue: 'danger',
    done: 'success'
  }
  return map[status] || 'info'
}

const statusLabel = (status) => {
  const map = {
    in_progress: '🔄 进行中',
    overdue: '⚠️ 超时预警',
    done: '✅ 已完成'
  }
  return map[status] || status
}

const tableRowClassName = ({ row }) => {
  if (row.status === 'overdue') return 'overdue-row'
  return ''
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

const isOverdue = (deadline) => {
  if (!deadline) return false
  const d = new Date(deadline)
  if (isNaN(d.getTime())) return false
  return d < new Date()
}

const handlePush = (row) => {
  currentPushTask.value = row
  // 默认文案
  pushContent.value = '管理员发起了任务催办：'
  pushDialogVisible.value = true
}

const confirmPush = async () => {
  if (!currentPushTask.value) return
  
  pushLoading.value = true
  try {
    const res = await axios.post(`/api/tasks/${currentPushTask.value.id}/push`, {
      customContent: pushContent.value
    })
    
    if (res.data.code === 200) {
      ElMessage.success('已发送提醒')
      pushDialogVisible.value = false
    } else {
      ElMessage.warning(res.data.error || '发送提醒失败')
    }
  } catch (error) {
    ElMessage.error('发送请求失败')
  } finally {
    pushLoading.value = false
  }
}

onMounted(() => {
  fetchTasks()
  fetchStats()
})
</script>

<style scoped>
:deep(.overdue-row) {
  background-color: #fef2f2 !important;
}
:deep(.overdue-row:hover > td) {
  background-color: #fee2e2 !important;
}
</style>
