<template>
  <div class="alerts-page">
    <div class="grid grid-cols-2 gap-6 mb-6">
      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div class="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 class="font-semibold text-neutral-800">告警配置</h3>
        </div>
        <div class="p-6">
          <el-form :model="alertForm" label-width="120px">
            <el-form-item label="启用告警">
              <el-switch v-model="alertForm.enabled" />
            </el-form-item>
            <el-form-item label="超时时间(分钟)">
              <el-input-number v-model="alertForm.timeout" :min="1" :max="1440" />
            </el-form-item>
            <el-form-item label="通知方式">
              <el-checkbox-group v-model="alertForm.notificationTypes">
                <el-checkbox value="email">邮件</el-checkbox>
                <el-checkbox value="sms">短信</el-checkbox>
                <el-checkbox value="wechat">微信</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleSaveAlert" :loading="saving">保存配置</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
        <div class="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <h3 class="font-semibold text-neutral-800">敏感词管理</h3>
          <el-button type="primary" :icon="Plus" size="small" @click="handleAddWord">添加敏感词</el-button>
        </div>
        <div class="p-6">
          <div v-if="sensitiveWords.length === 0" class="text-center text-neutral-400 py-8">
            暂无敏感词
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="word in sensitiveWords"
              :key="word.id"
              class="flex items-center justify-between p-3 bg-neutral-50 rounded-lg"
            >
              <span class="text-sm font-medium">{{ word.word }}</span>
              <el-button type="danger" link size="small" @click="handleDeleteWord(word)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="wordDialogVisible"
      title="添加敏感词"
      width="400px"
    >
      <el-form :model="wordForm" :rules="wordRules" ref="wordFormRef" label-width="80px">
        <el-form-item label="敏感词" prop="word">
          <el-input v-model="wordForm.word" placeholder="请输入敏感词" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="wordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleWordSubmit" :loading="wordSubmitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAlertStore } from '@/stores/alert'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const alertStore = useAlertStore()

const alertForm = ref({
  enabled: true,
  timeout: 30,
  notificationTypes: ['email', 'wechat']
})

const sensitiveWords = ref([])
const saving = ref(false)
const wordDialogVisible = ref(false)
const wordFormRef = ref(null)
const wordSubmitting = ref(false)

const wordForm = ref({
  word: ''
})

const wordRules = {
  word: [
    { required: true, message: '请输入敏感词', trigger: 'blur' }
  ]
}

async function fetchAlerts() {
  try {
    await alertStore.fetchAlerts()
    if (alertStore.alerts.length > 0) {
      const alert = alertStore.alerts[0]
      alertForm.value = {
        enabled: alert.enabled,
        timeout: alert.timeout,
        notificationTypes: alert.notificationTypes || []
      }
    }
  } catch (error) {
    ElMessage.error('获取告警配置失败')
  }
}

async function fetchSensitiveWords() {
  try {
    await alertStore.fetchSensitiveWords()
    sensitiveWords.value = alertStore.sensitiveWords
  } catch (error) {
    ElMessage.error('获取敏感词列表失败')
  }
}

async function handleSaveAlert() {
  saving.value = true
  try {
    await alertStore.editAlert(1, alertForm.value)
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function handleAddWord() {
  wordForm.value = {
    word: ''
  }
  wordDialogVisible.value = true
}

async function handleDeleteWord(word) {
  try {
    await ElMessageBox.confirm(`确定要删除敏感词"${word.word}"吗？`, '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await alertStore.removeSensitiveWord(word.id)
    // 删除成功后刷新敏感词列表
    await fetchSensitiveWords()
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

async function handleWordSubmit() {
  if (!wordFormRef.value) return

  await wordFormRef.value.validate(async (valid) => {
    if (valid) {
      wordSubmitting.value = true
      try {
        await alertStore.createSensitiveWord(wordForm.value)
        ElMessage.success('添加成功')
        wordDialogVisible.value = false
      } catch (error) {
        ElMessage.error('添加失败')
      } finally {
        wordSubmitting.value = false
      }
    }
  })
}

onMounted(() => {
  fetchAlerts()
  fetchSensitiveWords()
})
</script>
