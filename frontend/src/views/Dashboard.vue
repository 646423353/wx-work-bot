<template>
  <div class="dashboard-page">
    <h1>测试标题</h1>
    <p>测试内容</p>
    <section class="mb-6">
      <div class="grid grid-cols-4 gap-6">
        <div class="stat-card bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-neutral-500">监控群聊数</p>
              <p class="text-3xl font-bold text-neutral-800 mt-2">{{ overview.monitoredGroupsCount || 0 }}</p>
              <div class="flex items-center gap-1 mt-2">
                <span class="text-xs text-success-600 font-medium">+2</span>
                <span class="text-xs text-neutral-400">本周新增</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <el-icon :size="24" color="#0073e6">
                <ChatLineRound />
              </el-icon>
            </div>
          </div>
        </div>

        <div class="stat-card bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-neutral-500">今日消息总数</p>
              <p class="text-3xl font-bold text-neutral-800 mt-2">{{ overview.todayMessagesCount || 0 }}</p>
              <div class="flex items-center gap-1 mt-2">
                <span class="text-xs text-success-600 font-medium">+12.5%</span>
                <span class="text-xs text-neutral-400">较昨日</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <el-icon :size="24" color="#0073e6">
                <ChatDotRound />
              </el-icon>
            </div>
          </div>
        </div>

        <div class="stat-card bg-white rounded-xl p-6 border border-neutral-200 shadow-sm relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-danger-50 rounded-full -mr-12 -mt-12"></div>
          <div class="flex items-start justify-between relative">
            <div>
              <p class="text-sm font-medium text-neutral-500">未回复消息</p>
              <p class="text-3xl font-bold text-danger-500 mt-2">{{ overview.unrepliedMessagesCount || 0 }}</p>
              <div class="flex items-center gap-1 mt-2">
                <span class="text-xs text-danger-600 font-medium">需立即处理</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-danger-100 rounded-xl flex items-center justify-center">
              <el-icon :size="24" color="#ff4d4f">
                <Warning />
              </el-icon>
            </div>
          </div>
        </div>

        <div class="stat-card bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-neutral-500">平均响应时间</p>
              <p class="text-3xl font-bold text-neutral-800 mt-2">{{ overview.averageResponseTime || '0m' }}</p>
              <div class="flex items-center gap-1 mt-2">
                <span class="text-xs text-success-600 font-medium">-8.3%</span>
                <span class="text-xs text-neutral-400">较上周</span>
              </div>
            </div>
            <div class="w-12 h-12 bg-success-100 rounded-xl flex items-center justify-center">
              <el-icon :size="24" color="#52c41a">
                <Clock />
              </el-icon>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-3 gap-6">
      <section class="col-span-2">
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div class="flex items-center gap-4">
              <h2 class="text-lg font-semibold text-neutral-800">群聊状态概览</h2>
              <div class="flex items-center gap-2">
                <span class="flex items-center gap-1 px-2 py-0.5 bg-success-50 rounded-full">
                  <span class="w-1.5 h-1.5 bg-success-500 rounded-full"></span>
                  <span class="text-xs text-success-600">正常 8</span>
                </span>
                <span class="flex items-center gap-1 px-2 py-0.5 bg-warning-50 rounded-full">
                  <span class="w-1.5 h-1.5 bg-warning-500 rounded-full"></span>
                  <span class="text-xs text-warning-600">警告 1</span>
                </span>
                <span class="flex items-center gap-1 px-2 py-0.5 bg-danger-50 rounded-full">
                  <span class="w-1.5 h-1.5 bg-danger-500 rounded-full"></span>
                  <span class="text-xs text-danger-600">异常 3</span>
                </span>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <div class="relative">
                <svg class="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <el-input
                  v-model="searchText"
                  placeholder="搜索群聊..."
                  clearable
                  style="width: 220px"
                />
              </div>
              <el-select v-model="filterStatus" placeholder="全部状态" style="width: 120px">
                <el-option label="全部状态" value="all" />
                <el-option label="正常" value="normal" />
                <el-option label="警告" value="warning" />
                <el-option label="异常" value="abnormal" />
              </el-select>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">群聊名称</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">今日消息</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">未回复</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">平均响应</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">最后活跃</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">状态</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-for="group in filteredGroups" :key="group.id" :class="{
                  'bg-danger-50/30': group.status === 'abnormal',
                  'bg-warning-50/30': group.status === 'warning',
                  'hover:bg-neutral-50': true
                }">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <el-icon :size="20" color="#0073e6">
                          <ChatLineRound />
                        </el-icon>
                      </div>
                      <div>
                        <p class="text-sm font-medium text-neutral-800">{{ group.name }}</p>
                        <p class="text-xs text-neutral-400">ID: {{ group.id }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm text-neutral-600">{{ group.todayMessages }}</td>
                  <td class="px-6 py-4">
                    <span :class="{
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-600': group.status === 'abnormal',
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-600': group.status === 'warning',
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-600': group.status === 'normal'
                    }">
                      {{ group.unreplied }}条{{ group.status === 'abnormal' ? '超时' : group.status === 'warning' ? '待处理' : '超时' }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm" :class="{
                    'text-danger-600 font-medium': group.status === 'abnormal',
                    'text-warning-600 font-medium': group.status === 'warning',
                    'text-neutral-600': group.status === 'normal'
                  }">
                    {{ group.averageResponseTime }}分钟
                  </td>
                  <td class="px-6 py-4 text-sm text-neutral-500">{{ group.lastActive }}</td>
                  <td class="px-6 py-4">
                    <span :class="{
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger-50 text-danger-600': group.status === 'abnormal',
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-600': group.status === 'warning',
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-600': group.status === 'normal'
                    }">
                      <span :class="{
                        'w-1.5 h-1.5 bg-danger-500 rounded-full mr-1': group.status === 'abnormal',
                        'w-1.5 h-1.5 bg-warning-500 rounded-full mr-1': group.status === 'warning',
                        'w-1.5 h-1.5 bg-success-500 rounded-full mr-1': group.status === 'normal'
                      }"></span>
                      {{ group.status === 'abnormal' ? '异常' : group.status === 'warning' ? '警告' : '正常' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <button class="text-primary-500 text-sm hover:text-primary-600 font-medium" @click="handleViewGroupDetail(group)">
                      查看详情
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
            <span class="text-sm text-neutral-500">共 {{ filteredGroups.length }} 个群聊</span>
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="filteredGroups.length"
              layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </div>
      </section>

      <section class="col-span-1">
        <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
          <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div class="flex items-center gap-2">
              <el-icon :size="20" color="#ff4d4f">
                <Warning />
              </el-icon>
              <h2 class="text-lg font-semibold text-neutral-800">未回复告警</h2>
            </div>
            <span class="flex items-center justify-center w-6 h-6 bg-danger-500 text-white text-xs font-bold rounded-full">{{ overview.unrepliedMessagesCount || 0 }}</span>
          </div>
          <div class="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            <div v-for="alert in alerts" :key="alert.id" :class="['p-4 border rounded-xl', alert.priority === 'emergency' ? 'bg-danger-50 border-danger-200' : 'bg-warning-50 border-warning-200']">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span :class="['px-2 py-0.5 rounded text-xs font-medium', alert.priority === 'emergency' ? 'bg-danger-500 text-white' : 'bg-warning-500 text-white']">
                    {{ alert.priority === 'emergency' ? '紧急' : '警告' }}
                  </span>
                  <span :class="['text-xs', alert.priority === 'emergency' ? 'text-danger-600' : 'text-warning-600']">
                    超时 {{ alert.timeout }}分钟
                  </span>
                </div>
                <span class="text-xs text-neutral-400">{{ alert.time }}</span>
              </div>
              <p class="text-sm font-medium text-neutral-800 mb-2">{{ alert.groupName }}</p>
              <p class="text-sm text-neutral-600 mb-3 line-clamp-2">{{ alert.content }}</p>
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center">
                    <span class="text-xs font-medium text-primary-600">{{ alert.responsiblePerson.charAt(0) }}</span>
                  </div>
                  <span class="text-xs text-neutral-500">责任人: {{ alert.responsiblePerson }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <button class="p-1.5 text-primary-500 hover:bg-primary-50 rounded transition-colors" title="立即提醒">
                    <el-icon :size="16" color="#0073e6">
                      <Bell />
                    </el-icon>
                  </button>
                  <button class="p-1.5 text-neutral-400 hover:text-primary-500 hover:bg-primary-50 rounded transition-colors" title="查看详情">
                    <el-icon :size="16">
                      <View />
                    </el-icon>
                  </button>
                </div>
              </div>
            </div>
            <div v-if="alerts.length === 0" class="py-8 text-center">
              <el-icon :size="48" color="#d9d9d9">
                <CircleCheck />
              </el-icon>
              <p class="text-sm text-neutral-500 mt-2">暂无未回复告警</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMonitoringStore } from '@/stores/monitoring'
import { ElMessage } from 'element-plus'
import {
  ChatLineRound,
  Message,
  Warning,
  Bell,
  View,
  CircleCheck,
  ChatDotRound,
  Clock
} from '@element-plus/icons-vue'

const monitoringStore = useMonitoringStore()

const overview = ref({})
const groups = ref([])
const messages = ref([])
const alerts = ref([])
const searchText = ref('')
const filterStatus = ref('all')
const currentPage = ref(1)
const pageSize = ref(10)

const filteredGroups = computed(() => {
  let result = groups.value

  if (searchText.value) {
    result = result.filter(group =>
      group.name.toLowerCase().includes(searchText.value.toLowerCase())
    )
  }

  if (filterStatus.value !== 'all') {
    result = result.filter(group => group.status === filterStatus.value)
  }

  return result
})

async function fetchData() {
  try {
    await monitoringStore.fetchOverview()
    if (monitoringStore.overview && Object.keys(monitoringStore.overview).length > 0) {
      overview.value = monitoringStore.overview
    }
    await monitoringStore.fetchMessages()
    if (monitoringStore.messages && monitoringStore.messages.length > 0) {
      messages.value = monitoringStore.messages
    }
  } catch (error) {
    console.error('获取数据失败:', error)
    ElMessage.error('获取数据失败，使用模拟数据')
  }
  
  // 确保群聊数据存在
  if (!groups.value || groups.value.length === 0) {
    groups.value = [
      { id: 'chat_001', name: '客户服务A群', todayMessages: 286, unreplied: 3, averageResponseTime: 15.2, lastActive: '10:28', status: 'abnormal' },
      { id: 'chat_002', name: '技术支持B群', todayMessages: 152, unreplied: 2, averageResponseTime: 22.5, lastActive: '10:15', status: 'abnormal' },
      { id: 'chat_003', name: '产品咨询C群', todayMessages: 98, unreplied: 1, averageResponseTime: 12.3, lastActive: '10:22', status: 'warning' },
      { id: 'chat_004', name: '售后服务D群', todayMessages: 76, unreplied: 0, averageResponseTime: 3.1, lastActive: '10:31', status: 'normal' },
      { id: 'chat_005', name: '商务合作E群', todayMessages: 45, unreplied: 0, averageResponseTime: 2.8, lastActive: '09:45', status: 'normal' },
      { id: 'chat_006', name: '运营管理F群', todayMessages: 67, unreplied: 0, averageResponseTime: 4.5, lastActive: '10:18', status: 'normal' },
      { id: 'chat_007', name: '市场推广G群', todayMessages: 34, unreplied: 0, averageResponseTime: 3.8, lastActive: '10:05', status: 'normal' },
      { id: 'chat_008', name: '人力资源H群', todayMessages: 23, unreplied: 0, averageResponseTime: 2.5, lastActive: '09:30', status: 'normal' },
      { id: 'chat_009', name: '财务审批I群', todayMessages: 18, unreplied: 0, averageResponseTime: 3.2, lastActive: '09:15', status: 'normal' },
      { id: 'chat_010', name: '研发团队J群', todayMessages: 124, unreplied: 0, averageResponseTime: 5.8, lastActive: '10:25', status: 'normal' },
      { id: 'chat_011', name: '测试团队K群', todayMessages: 89, unreplied: 0, averageResponseTime: 4.2, lastActive: '10:10', status: 'normal' },
      { id: 'chat_012', name: '设计团队L群', todayMessages: 56, unreplied: 0, averageResponseTime: 3.6, lastActive: '10:00', status: 'normal' }
    ]
  }
  
  // 确保告警数据存在
  if (!alerts.value || alerts.value.length === 0) {
    alerts.value = [
      {
        id: 1,
        priority: 'emergency',
        timeout: 35,
        time: '10:28',
        groupName: '客户服务A群',
        content: '请问你们的产品什么时候能发货？我上周就已经下单了，现在还没有收到任何通知...',
        responsiblePerson: '李客服'
      },
      {
        id: 2,
        priority: 'emergency',
        timeout: 28,
        time: '10:15',
        groupName: '技术支持B群',
        content: '系统报错：无法连接到数据库，请技术支持人员尽快回复！',
        responsiblePerson: '王技术'
      },
      {
        id: 3,
        priority: 'warning',
        timeout: 15,
        time: '10:22',
        groupName: '产品咨询C群',
        content: '我想了解一下你们的新功能什么时候上线？',
        responsiblePerson: '张产品'
      }
    ]
  }
}

function handleViewGroupDetail(group) {
  ElMessage.info(`查看群聊详情: ${group.name}`)
}

function handleSizeChange(val) {
  pageSize.value = val
}

function handleCurrentChange(val) {
  currentPage.value = val
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.stat-card {
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}
</style>