<template>
  <div class="settings-page">
    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div class="px-6 py-4 border-b border-neutral-200">
        <h3 class="font-semibold text-neutral-800">系统设置</h3>
      </div>
      <div class="p-6">
        <el-form :model="settingsForm" label-width="120px">
          <el-form-item label="系统名称">
            <el-input v-model="settingsForm.systemName" placeholder="请输入系统名称" />
          </el-form-item>
          <el-form-item label="刷新间隔(秒)">
            <el-input-number v-model="settingsForm.refreshInterval" :min="5" :max="300" />
          </el-form-item>
          <el-form-item label="启用通知">
            <el-switch v-model="settingsForm.enableNotification" />
          </el-form-item>
          <el-form-item label="主题颜色">
            <el-radio-group v-model="settingsForm.theme">
              <el-radio value="light">浅色</el-radio>
              <el-radio value="dark">深色</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="语言">
            <el-select v-model="settingsForm.language" placeholder="请选择语言">
              <el-option label="简体中文" value="zh-CN" />
              <el-option label="English" value="en-US" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSave" :loading="saving">保存设置</el-button>
            <el-button @click="handleReset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, updateSettings } from '@/api'
import { ElMessage } from 'element-plus'

const settingsForm = ref({
  systemName: '企业微信消息监控助手',
  refreshInterval: 30,
  enableNotification: true,
  theme: 'light',
  language: 'zh-CN'
})

const saving = ref(false)

async function fetchSettings() {
  try {
    const res = await getSettings()
    settingsForm.value = res.data
  } catch (error) {
    ElMessage.error('获取设置失败')
  }
}

async function handleSave() {
  saving.value = true
  try {
    await updateSettings(settingsForm.value)
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

function handleReset() {
  settingsForm.value = {
    systemName: '企业微信消息监控助手',
    refreshInterval: 30,
    enableNotification: true,
    theme: 'light',
    language: 'zh-CN'
  }
}

onMounted(() => {
  fetchSettings()
})
</script>
