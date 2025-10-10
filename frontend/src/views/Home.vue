<template>
  <a-layout style="height: 100vh">
    <a-layout-sider
      width="320"
      theme="light"
      style="border-right: 1px solid #f0f0f0"
    >
      <DatabaseTree @node-click="handleNodeClick" />
    </a-layout-sider>
    <a-layout>
      <a-layout-header
        style="
          background: #fff;
          padding: 0 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        "
      >
        <a-breadcrumb>
          <a-breadcrumb-item>
            <span v-if="connectionStore.activeConnection">
              {{ connectionStore.activeConnection.name || connectionStore.activeConnection.host }}
            </span>
            <span v-else>未连接</span>
          </a-breadcrumb-item>
          <a-breadcrumb-item v-if="connectionStore.activeDatabaseName">
            {{ connectionStore.activeDatabaseName }}
          </a-breadcrumb-item>
          <a-breadcrumb-item v-if="selectedTable">
            {{ selectedTable }}
          </a-breadcrumb-item>
        </a-breadcrumb>

        <div class="header-actions">
          <a-button @click="showImportExportDialog = true">
            <template #icon><UploadOutlined /></template>
            导入/导出
          </a-button>
          <a-button @click="refreshData">
            <template #icon><SyncOutlined /></template>
            刷新
          </a-button>
        </div>
      </a-layout-header>

      <a-layout-content style="padding: 16px; overflow: hidden; display: flex">
        <a-tabs
          :active-key="uiStore.activeMainTab"
          @update:active-key="uiStore.setActiveMainTab"
          type="editable-card"
          @edit="(key, action) => action === 'remove' && uiStore.closeDataTab(key)"
          hide-add
          style="width: 100%; display: flex; flex-direction: column"
        >
          <a-tab-pane key="objects" tab="对象" :closable="false">
            <ObjectList />
          </a-tab-pane>

          <a-tab-pane key="query" tab="SQL查询" :closable="false">
            <SqlEditor ref="sqlEditorRef" />
          </a-tab-pane>

          <a-tab-pane
            v-for="tab in uiStore.dataTabs"
            :key="tab.name"
            :tab="tab.label"
            :closable="true"
          >
            <TableDataView
              v-if="tab.type === 'data'"
              :connection-id="connectionStore.activeConnectionId"
              :database="tab.database"
              :table="tab.table"
            />

            <TableStructureView
              v-else-if="tab.type === 'structure'"
              :connection-id="connectionStore.activeConnectionId"
              :database="tab.database"
              :table="tab.table"
            />
          </a-tab-pane>
        </a-tabs>
      </a-layout-content>
    </a-layout>

    <a-modal
      v-model:open="showImportExportDialog"
      title="数据导入导出"
      width="800px"
      :footer="null"
      @cancel="handleCloseImportExport"
    >
      <ImportExportDialog
        :visible="showImportExportDialog"
        @imported="handleDataImported"
      />
    </a-modal>
  </a-layout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { UploadOutlined, SyncOutlined } from '@ant-design/icons-vue'

import { useConnectionStore } from '@/stores/connection'
import { useUIStore } from '@/stores/ui'
import DatabaseTree from '@/components/DatabaseTree.vue'
import SqlEditor from '@/components/SqlEditor.vue'
import TableDataView from '@/components/TableDataView.vue'
import TableStructureView from '@/components/TableStructureView.vue'
import ImportExportDialog from '@/components/ImportExportDialog.vue'
import ObjectList from '@/components/ObjectList.vue'

const connectionStore = useConnectionStore()
const uiStore = useUIStore()

const selectedTable = ref('')
const sqlEditorRef = ref()
const showImportExportDialog = ref(false)

// 处理树节点点击
const handleNodeClick = (data) => {
  if (data.type === 'table') {
    selectedTable.value = data.table
    const type = data.action === 'viewStructure' ? 'structure' : 'data';
    uiStore.openDataTab({ table: data.table, database: data.database, type });
  }
}

// 刷新数据
const refreshData = async () => {
  if (connectionStore.activeConnectionId) {
    await connectionStore.loadDatabases()
    if (connectionStore.activeDatabaseName) {
      await connectionStore.setActiveDatabase(connectionStore.activeDatabaseName)
    }
  }
}

// 关闭导入导出对话框
const handleCloseImportExport = () => {
  showImportExportDialog.value = false
}

// 数据导入完成处理
const handleDataImported = () => {
  // 刷新当前表数据
  refreshData()
}

// 组件挂载
onMounted(() => {
  // 初始化加载连接列表
  connectionStore.loadConnections()
})
</script>

<style scoped>
:deep(.ant-tabs-content) {
  height: 100%;
}
:deep(.ant-tabs-tabpane) {
  height: 100%;
}
</style>