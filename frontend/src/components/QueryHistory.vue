<template>
  <div class="query-history">
    <div class="history-header">
      <h4>查询历史</h4>
      <a-button
        size="small"
        danger
        @click="clearHistory"
        :disabled="queryStore.queryHistory.length === 0"
      >
        清空历史
      </a-button>
    </div>

    <a-list
      v-if="queryStore.queryHistory.length > 0"
      class="history-list"
      item-layout="horizontal"
      :data-source="queryStore.queryHistory"
    >
      <template #renderItem="{ item }">
        <a-list-item @click="$emit('select-query', item.sql)" class="history-item">
          <a-list-item-meta>
            <template #title>
              <div class="sql-preview">{{ item.sql }}</div>
            </template>
            <template #description>
              <div class="history-meta">
                <span>{{ item.timestamp }}</span>
                <a-tag :color="item.success ? 'success' : 'error'">
                  {{ item.success ? '成功' : '失败' }}
                </a-tag>
                <span v-if="item.executeTime">耗时: {{ item.executeTime }}</span>
              </div>
              <div v-if="item.error" class="error-message">
                {{ item.error }}
              </div>
            </template>
          </a-list-item-meta>
        </a-list-item>
      </template>
    </a-list>

    <div v-else class="empty-history">
      <a-empty description="暂无查询历史" />
    </div>
  </div>
</template>

<script setup>
import { Modal, message } from 'ant-design-vue'
import { useQueryStore } from '@/stores/query'

defineEmits(['select-query'])

const queryStore = useQueryStore()

const clearHistory = () => {
  Modal.confirm({
    title: '确认操作',
    content: '确定要清空所有查询历史吗？',
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    onOk: () => {
      queryStore.clearHistory()
      message.success('查询历史已清空')
    }
  })
}
</script>

<style scoped>
.query-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.history-header h4 {
  margin: 0;
  font-size: 16px;
}

.history-list {
  flex: 1;
  overflow-y: auto;
}

.history-item {
  cursor: pointer;
  padding: 12px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #f5f5f5;
}

.sql-preview {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-top: 8px;
}

.error-message {
  margin-top: 8px;
  padding: 8px;
  background: #fff1f0;
  border: 1px solid #ffa39e;
  border-radius: 3px;
  font-size: 12px;
  color: #cf1322;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.empty-history {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex: 1;
}
</style>