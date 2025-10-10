<template>
  <div class="sql-editor">
    <div class="editor-toolbar">
      <div class="toolbar-left">
        <a-button
          type="primary"
          size="small"
          :loading="queryStore.isExecuting"
          :disabled="!currentSql.trim() || !connectionStore.isConnected"
          @click="executeQuery"
        >
          <template #icon><PlayCircleOutlined /></template>
          执行查询 (F9)
        </a-button>
        <a-button size="small" @click="formatSQL">
          <template #icon><RedoOutlined /></template>
          格式化
        </a-button>
        <a-button size="small" @click="clearEditor">
          <template #icon><DeleteOutlined /></template>
          清空
        </a-button>
        <a-divider type="vertical" />
        <a-select
          v-model:value="connectionStore.activeDatabaseName"
          size="small"
          placeholder="选择数据库"
          style="width: 150px"
          @change="connectionStore.setActiveDatabase"
          :options="databaseOptions"
        />
      </div>
      <div class="toolbar-right">
        <span v-if="queryStore.queryResults?.executeTime" class="execute-time">
          执行耗时: {{ queryStore.queryResults.executeTime }}
        </span>
      </div>
    </div>

    <div class="editor-container" ref="editorContainer">
      <div class="editor-wrapper-enhanced">
        <div ref="highlightLayer" class="editor-highlight" v-html="highlightedSQL"></div>
        <textarea
          ref="editorRef"
          v-model="currentSql"
          class="editor-textarea-enhanced"
          placeholder="请输入 SQL 查询语句..."
          @keydown="handleKeydown"
          @input="handleInput"
          @scroll="syncScroll"
        />
        <div
          v-if="showAutoComplete"
          class="autocomplete-dropdown"
          :style="{ left: autoCompletePosition.x + 'px', top: autoCompletePosition.y + 'px' }"
        >
          <div
            v-for="(item, index) in autoCompleteItems"
            :key="index"
            class="autocomplete-item"
            :class="{ active: index === selectedSuggestionIndex }"
            @click="selectAutoCompleteItem(item)"
            @mouseenter="selectedSuggestionIndex = index"
          >
            <span class="autocomplete-type" :class="item.type">{{ item.type }}</span>
            <div class="autocomplete-content">
              <div class="autocomplete-name">{{ item.display }}</div>
              <div class="autocomplete-description">{{ item.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="queryStore.queryResults || queryStore.queryError" class="result-container">
      <a-tabs v-model:activeKey="activeTab" type="card">
        <a-tab-pane key="result" tab="查询结果">
          <QueryResult :data="queryStore.queryResults" :error="queryStore.queryError" />
        </a-tab-pane>
        <a-tab-pane key="info" tab="执行信息">
          <div class="execution-info">
            <a-descriptions v-if="queryStore.queryResults" :column="1" size="small" bordered>
              <a-descriptions-item label="影响行数">
                {{ queryStore.queryResults.affectedRows || queryStore.queryResults.data?.length || 0 }}
              </a-descriptions-item>
              <a-descriptions-item label="执行耗时">
                {{ queryStore.queryResults.executeTime }}
              </a-descriptions-item>
              <a-descriptions-item label="执行时间">
                {{ new Date().toLocaleString() }}
              </a-descriptions-item>
            </a-descriptions>
            <a-alert v-if="queryStore.queryError" :message="queryStore.queryError" type="error" show-icon />
          </div>
        </a-tab-pane>
        <a-tab-pane key="history" tab="查询历史">
          <QueryHistory @select-query="loadHistoryQuery" />
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import { PlayCircleOutlined, RedoOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { useConnectionStore } from '@/stores/connection'
import { useQueryStore } from '@/stores/query'
import { sqlUtils } from '@/utils/sqlUtils'
import QueryResult from './QueryResult.vue'
import QueryHistory from './QueryHistory.vue'
import './sql-editor.css'

const connectionStore = useConnectionStore()
const queryStore = useQueryStore()

const editorRef = ref()
const editorContainer = ref()
const highlightLayer = ref()
const currentSql = ref('')
const activeTab = ref('result')
const showAutoComplete = ref(false)
const autoCompletePosition = ref({ x: 0, y: 0 })
const autoCompleteItems = ref([])
const selectedSuggestionIndex = ref(0)

let autoComplete = null

const databaseOptions = computed(() => 
  connectionStore.databases.map(db => ({ label: db, value: db }))
)

const highlightedSQL = computed(() => sqlUtils.highlight(currentSql.value))

watch(currentSql, (newSql) => {
  queryStore.setCurrentQuery(newSql)
  updateHighlight()
})

const updateHighlight = async () => {
  await nextTick()
  if (highlightLayer.value) {
    highlightLayer.value.innerHTML = highlightedSQL.value
  }
}

const showAutoCompleteDropdown = (event) => {
  if (!autoComplete || !editorRef.value) return

  const textarea = editorRef.value
  const cursorPosition = textarea.selectionStart
  const suggestions = autoComplete.getSuggestions(currentSql.value, cursorPosition)

  if (suggestions.length > 0) {
    autoCompleteItems.value = suggestions
    selectedSuggestionIndex.value = 0

    // Dynamically calculate position
    const styles = window.getComputedStyle(textarea)
    const lineHeight = parseFloat(styles.lineHeight)
    const fontSize = parseFloat(styles.fontSize)
    const paddingLeft = parseFloat(styles.paddingLeft)
    const paddingTop = parseFloat(styles.paddingTop)

    // Estimate character width (more accurate for monospace fonts)
    const charWidth = fontSize * 0.6

    const textBeforeCursor = currentSql.value.substring(0, cursorPosition)
    const lines = textBeforeCursor.split('\n')
    const currentLine = lines.length - 1
    const currentColumn = lines[lines.length - 1].length

    // Position relative to the textarea's top-left, considering scroll and padding
    const x = paddingLeft - textarea.scrollLeft + (currentColumn * charWidth)
    const y = paddingTop - textarea.scrollTop + (currentLine * lineHeight) + lineHeight

    autoCompletePosition.value = { x, y }
    showAutoComplete.value = true
  } else {
    hideAutoComplete()
  }
}

const hideAutoComplete = () => {
  showAutoComplete.value = false
  autoCompleteItems.value = []
  selectedSuggestionIndex.value = 0
}

const selectAutoCompleteItem = (item) => {
  const textarea = editorRef.value
  const cursorPosition = textarea.selectionStart
  const textBefore = currentSql.value.substring(0, cursorPosition)
  const textAfter = currentSql.value.substring(cursorPosition)
  const words = textBefore.split(/\s+/)
  const lastWord = words[words.length - 1] || ''
  const wordStart = textBefore.lastIndexOf(lastWord)
  const newText = textBefore.substring(0, wordStart) + item.value + textAfter
  currentSql.value = newText
  nextTick(() => {
    const newCursorPos = wordStart + item.value.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
  hideAutoComplete()
}

const executeQuery = async () => {
  if (!currentSql.value.trim()) {
    message.warning('请输入SQL语句'); return;
  }
  if (!connectionStore.activeConnectionId) {
    message.warning('请先连接数据库'); return;
  }
  try {
    await queryStore.executeQuery(connectionStore.activeConnectionId, currentSql.value.trim())
    activeTab.value = 'result'
  } catch (error) {
    activeTab.value = 'result'
  }
}

const formatSQL = () => { currentSql.value = sqlUtils.format(currentSql.value) }
const clearEditor = () => { currentSql.value = ''; queryStore.clearResults() }
const loadHistoryQuery = (sql) => { currentSql.value = sql; activeTab.value = 'result' }

const handleKeydown = (event) => {
  if (event.key === 'F9') { event.preventDefault(); executeQuery() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); executeQuery() }
  if ((event.ctrlKey || event.metaKey) && event.key === 'a') { event.preventDefault(); editorRef.value.select() }
  if ((event.ctrlKey || event.metaKey) && event.code === 'Space') { event.preventDefault(); showAutoCompleteDropdown(event) }
  if (showAutoComplete.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, autoCompleteItems.value.length - 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, 0)
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (autoCompleteItems.value[selectedSuggestionIndex.value]) {
        selectAutoCompleteItem(autoCompleteItems.value[selectedSuggestionIndex.value])
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      hideAutoComplete()
    }
  }
}

const handleInput = (event) => {
  setTimeout(() => {
    if (currentSql.value.trim()) {
      showAutoCompleteDropdown(event)
    } else {
      hideAutoComplete()
    }
  }, 200)
}

const syncScroll = () => {
  if (highlightLayer.value && editorRef.value) {
    highlightLayer.value.scrollTop = editorRef.value.scrollTop
    highlightLayer.value.scrollLeft = editorRef.value.scrollLeft
  }
}

const insertSqlTemplate = (template) => {
  const textarea = editorRef.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const currentValue = currentSql.value
  currentSql.value = currentValue.substring(0, start) + template + currentValue.substring(end)
  setTimeout(() => {
    textarea.focus()
    textarea.setSelectionRange(start + template.length, start + template.length)
  }, 0)
}

onMounted(() => {
  queryStore.loadHistoryFromStorage()
  autoComplete = sqlUtils.createAutoComplete(connectionStore)
  setTimeout(() => { editorRef.value?.focus(); updateHighlight() }, 100)
  document.addEventListener('click', (event) => {
    if (!editorContainer.value?.contains(event.target)) {
      hideAutoComplete()
    }
  })
})

onUnmounted(() => { document.removeEventListener('click', hideAutoComplete) })

defineExpose({ insertSqlTemplate, executeQuery, clearEditor })
</script>

<style scoped>
.sql-editor { height: 100%; display: flex; flex-direction: column; }
.editor-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
.toolbar-left { display: flex; align-items: center; gap: 8px; }
.execute-time { font-size: 12px; color: #909399; }
.editor-container { flex: 1; min-height: 150px; position: relative; }
.result-container { height: 400px; border-top: 1px solid #f0f0f0; }
.execution-info { padding: 16px; font-size: 14px; line-height: 1.6; }
:deep(.ant-tabs-content) { height: calc(100% - 40px); overflow: hidden; }
:deep(.ant-tab-pane) { height: 100%; overflow: auto; }
</style>