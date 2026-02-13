<template>
  <div class="groups-page">
    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div class="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <h3 class="font-semibold text-neutral-800">群聊列表</h3>
        <!-- 自动发现群聊，无需手动添加 -->
      </div>
      <div class="overflow-x-auto">
        <el-table :data="groups" stripe style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="ID" min-width="60" />
          <el-table-column prop="name" label="群聊名称" min-width="160" />
          <el-table-column prop="memberCount" label="成员数量" min-width="90" />
          <el-table-column prop="status" label="状态" min-width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '监控中' : '已暂停' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="任务统计" min-width="200">
            <template #default="{ row }">
              <div class="flex items-center gap-2 flex-wrap">
                <el-tag v-if="row.taskStats.overdue > 0" type="danger" size="small">
                  ⚠️ {{ row.taskStats.overdue }}
                </el-tag>
                <el-tag v-if="row.taskStats.inProgress > 0" type="primary" size="small">
                  🔄 {{ row.taskStats.inProgress }}
                </el-tag>
                <el-tag v-if="row.taskStats.done > 0" type="success" size="small">
                  ✅ {{ row.taskStats.done }}
                </el-tag>
                <span v-if="row.taskStats.inProgress === 0 && row.taskStats.overdue === 0 && row.taskStats.done === 0" class="text-xs text-neutral-400">暂无任务</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="自动提醒" min-width="90">
            <template #default="{ row }">
              <el-tag :type="row.autoRemind ? 'success' : 'info'" size="small">
                {{ row.autoRemind ? '已开启' : '已关闭' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="160" />
          <el-table-column label="操作" min-width="180" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="handleSync(row)" :loading="row.syncing">同步</el-button>
              <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="px-6 py-4 border-t border-neutral-200 flex items-center justify-between">
        <span class="text-sm text-neutral-500">共 {{ groups.length }} 个群聊</span>
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="groups.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      @close="handleDialogClose"
    >
      <el-form :model="form" :rules="rules" ref="formRef" label-width="120px">
        <el-form-item label="群聊名称">
          <el-input v-model="form.name" placeholder="请输入群聊名称" />
          <div class="text-xs text-neutral-400 mt-1">可手动修改群名称，或点击“同步”按钮从企微获取最新名称</div>
        </el-form-item>
        <el-form-item label="成员数量">
          <el-input-number v-model="form.memberCount" disabled />
          <div class="text-xs text-neutral-400 mt-1">成员数由企微自动同步</div>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="监控中" value="active" />
            <el-option label="已暂停" value="paused" />
          </el-select>
        </el-form-item>
        <el-form-item label="群机器人" prop="webhookUrl">
          <el-input v-model="form.webhookUrl" placeholder="请输入群机器人 Webhook URL (可选)" />
          <div class="text-xs text-neutral-400 mt-1">配置后，系统回复将直接通过 Webhook 发送到群内。</div>
        </el-form-item>
        <el-form-item label="超时自动提醒" prop="autoRemind">
          <el-switch v-model="form.autoRemind" />
          <span class="ml-2 text-xs text-neutral-400">开启后，超时任务将自动推送预警到群内，并纳入每日播报。</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useGroupStore } from '@/stores/group'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const groupStore = useGroupStore()

const groups = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('编辑群聊')
const currentId = ref(null)
const submitting = ref(false)
const formRef = ref(null)

const form = ref({
  name: '',
  memberCount: 0,
  status: 'active',
  webhookUrl: '',
  autoRemind: true
})

const rules = {
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
}

const currentPage = ref(1)
const pageSize = ref(10)

async function fetchGroups() {
  loading.value = true
  try {
    await groupStore.fetchGroups()
    groups.value = [...(groupStore.groups || [])].map(g => ({ ...g, syncing: false }))
  } catch (error) {
    ElMessage.error('获取群聊列表失败')
  } finally {
    loading.value = false
  }
}

async function handleSync(row) {
  row.syncing = true
  try {
    const res = await axios.get(`/api/groups/${row.id}/sync`)
    if (res.data && res.data.data) {
      row.name = res.data.data.name
      row.memberCount = res.data.data.memberCount
      ElMessage.success('同步成功')
    } else {
      ElMessage.warning(res.data?.error || '同步失败')
    }
  } catch (error) {
    ElMessage.error('同步请求失败')
  } finally {
    row.syncing = false
  }
}

function handleEdit(row) {
  currentId.value = row.id
  form.value = {
    name: row.name,
    memberCount: row.memberCount,
    status: row.status,
    webhookUrl: row.webhookUrl || '',
    autoRemind: row.autoRemind !== false
  }
  dialogVisible.value = true
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除群聊"${row.name}"吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await groupStore.removeGroup(row.id)
    await fetchGroups()
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await groupStore.editGroup(currentId.value, form.value)
        ElMessage.success('更新成功')
        await fetchGroups()
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error('更新失败')
      } finally {
        submitting.value = false
      }
    }
  })
}

function handleDialogClose() {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

onMounted(() => {
  fetchGroups()
})
</script>
