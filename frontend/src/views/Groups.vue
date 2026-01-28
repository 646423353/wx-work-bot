<template>
  <div class="groups-page">
    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div class="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <h3 class="font-semibold text-neutral-800">群聊列表</h3>
        <el-button type="primary" :icon="Plus" @click="handleAdd">添加群聊</el-button>
      </div>
      <div class="overflow-x-auto">
        <el-table :data="groups" stripe style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="ID" min-width="80" />
          <el-table-column prop="name" label="群聊名称" min-width="200" />
          <el-table-column prop="memberCount" label="成员数量" min-width="120" />
          <el-table-column prop="status" label="状态" min-width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '监控中' : '已暂停' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" min-width="180" />
          <el-table-column label="操作" min-width="150" fixed="right">
            <template #default="{ row }">
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
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-form-item label="群聊名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入群聊名称" />
        </el-form-item>
        <el-form-item label="成员数量" prop="memberCount">
          <el-input-number v-model="form.memberCount" :min="1" :max="500" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" placeholder="请选择状态">
            <el-option label="监控中" value="active" />
            <el-option label="已暂停" value="paused" />
          </el-select>
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
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from '@/stores/group'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const groupStore = useGroupStore()

const groups = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = computed(() => isEdit.value ? '编辑群聊' : '添加群聊')
const isEdit = ref(false)
const currentId = ref(null)
const submitting = ref(false)
const formRef = ref(null)

const form = ref({
  name: '',
  memberCount: 10,
  status: 'active'
})

const rules = {
  name: [
    { required: true, message: '请输入群聊名称', trigger: 'blur' }
  ],
  memberCount: [
    { required: true, message: '请输入成员数量', trigger: 'blur' }
  ],
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
    groups.value = groupStore.groups
  } catch (error) {
    ElMessage.error('获取群聊列表失败')
  } finally {
    loading.value = false
  }
}

function handleAdd() {
  isEdit.value = false
  currentId.value = null
  form.value = {
    name: '',
    memberCount: 10,
    status: 'active'
  }
  dialogVisible.value = true
}

function handleEdit(row) {
  isEdit.value = true
  currentId.value = row.id
  form.value = {
    name: row.name,
    memberCount: row.memberCount,
    status: row.status
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
        if (isEdit.value) {
          await groupStore.editGroup(currentId.value, form.value)
          ElMessage.success('更新成功')
        } else {
          await groupStore.createGroup(form.value)
          ElMessage.success('添加成功')
        }
        dialogVisible.value = false
      } catch (error) {
        ElMessage.error(isEdit.value ? '更新失败' : '添加失败')
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
