<template>
  <div class="reports-page">
    <div class="bg-white rounded-xl border border-neutral-200 shadow-sm">
      <div class="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
        <h3 class="font-semibold text-neutral-800">数据报表</h3>
        <div class="flex items-center gap-3">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="handleDateChange"
          />
          <el-button type="primary" :icon="Download" @click="handleExport">导出报表</el-button>
        </div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-3 gap-6 mb-6">
          <div class="bg-primary-50 rounded-lg p-4">
            <p class="text-sm text-neutral-600 mb-2">消息总数</p>
            <p class="text-2xl font-bold text-primary-600">{{ reportData.totalMessages || 0 }}</p>
          </div>
          <div class="bg-success-50 rounded-lg p-4">
            <p class="text-sm text-neutral-600 mb-2">已回复消息</p>
            <p class="text-2xl font-bold text-success-600">{{ reportData.repliedMessages || 0 }}</p>
          </div>
          <div class="bg-danger-50 rounded-lg p-4">
            <p class="text-sm text-neutral-600 mb-2">未回复消息</p>
            <p class="text-2xl font-bold text-danger-600">{{ reportData.unrepliedMessages || 0 }}</p>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="font-medium text-neutral-800 mb-4">群聊消息统计</h4>
          <el-table :data="reportData.groupStats || []" stripe style="width: 100%">
            <el-table-column prop="groupName" label="群聊名称" min-width="200" />
            <el-table-column prop="totalMessages" label="消息总数" min-width="120" />
            <el-table-column prop="repliedMessages" label="已回复" min-width="120" />
            <el-table-column prop="unrepliedMessages" label="未回复" min-width="120" />
            <el-table-column prop="responseRate" label="回复率" min-width="120">
              <template #default="{ row }">
                {{ (row.responseRate * 100).toFixed(1) }}%
              </template>
            </el-table-column>
            <el-table-column prop="avgResponseTime" label="平均响应时间" min-width="150" />
          </el-table>
        </div>

        <div>
          <h4 class="font-medium text-neutral-800 mb-4">每日任务统计</h4>
          <div ref="chartRef" style="width: 100%; height: 400px;"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { getReports, exportReport } from '@/api'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'

const dateRange = ref([])
const reportData = ref({
  totalMessages: 0,
  repliedMessages: 0,
  unrepliedMessages: 0,
  groupStats: [],
  dailyTaskStats: []
})

const chartRef = ref(null)
let chartInstance = null

async function fetchReportData() {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0].toISOString().split('T')[0]
      params.endDate = dateRange.value[1].toISOString().split('T')[0]
    }
    const res = await getReports(params)
    reportData.value = res.data
    
    // 更新图表
    nextTick(() => {
      initChart()
    })
  } catch (error) {
    ElMessage.error('获取报表数据失败')
    console.error(error)
  }
}

function initChart() {
  if (!chartRef.value) return
  
  // 如果实例已存在，先销毁
  if (chartInstance) {
    chartInstance.dispose()
  }
  
  chartInstance = echarts.init(chartRef.value)
  
  const stats = reportData.value.dailyTaskStats || []
  if (stats.length === 0) {
    chartInstance.clear()
    return
  }
  
  // 处理数据
  // 1. 获取所有日期（排序并去重）
  const dates = [...new Set(stats.map(item => item.date))].sort()
  
  // 2. 获取所有群聊名称（去重）
  const groupNames = [...new Set(stats.map(item => item.groupName))]
  
  // 3. 构建 series 数据
  const series = groupNames.map(name => {
    return {
      name: name,
      type: 'bar',
      emphasis: { focus: 'series' },
      data: dates.map(date => {
        const item = stats.find(s => s.date === date && s.groupName === name)
        return item ? item.count : 0
      })
    }
  })
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: groupNames,
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: 45 }
    },
    yAxis: {
      type: 'value'
    },
    series: series
  }
  
  chartInstance.setOption(option)
}

function handleDateChange() {
  fetchReportData()
}

async function handleExport() {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0].toISOString().split('T')[0]
      params.endDate = dateRange.value[1].toISOString().split('T')[0]
    }
    const blob = await exportReport(params)
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `report_${new Date().getTime()}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

const handleResize = () => {
  chartInstance && chartInstance.resize()
}

onMounted(() => {
  fetchReportData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
  }
})
</script>
