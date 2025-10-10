<template>
  <div class="table-data-view">
    <div class="data-toolbar">
      <div class="toolbar-left">
        <a-button type="primary" size="small" @click="handleAdd">
          <template #icon><PlusOutlined /></template>
          新增行
        </a-button>
        <a-button
          type="primary"
          danger
          size="small"
          :disabled="!hasSelected"
          :loading="isBatchDeleting"
          @click="handleBatchDelete"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除
        </a-button>
        <a-button size="small" @click="loadData">
          <template #icon><SyncOutlined /></template>
          刷新
        </a-button>
        <a-divider type="vertical" />
        <a-input-search
          v-model:value="searchText"
          placeholder="在当前页搜索..."
          size="small"
          style="width: 200px"
        />
      </div>
      <div class="toolbar-right">
        <span class="execute-time" v-if="queryStore.queryResults?.executeTime">
          查询耗时: {{ queryStore.queryResults.executeTime }}
        </span>
        <a-pagination
          v-if="total > pageSize"
          v-model:current="currentPage"
          v-model:pageSize="pageSize"
          :total="total"
          :page-size-options="['50', '100', '200', '500']"
          size="small"
          show-size-changer
          show-quick-jumper
          :show-total="(t) => `共 ${t} 条`"
          @change="handlePageChange"
        />
      </div>
    </div>

    <div class="table-container">
      <a-table
        :loading="loading"
        :columns="columns"
        :data-source="filteredData"
        :row-selection="rowSelection"
        size="small"
        bordered
        :scroll="{ y: '100%', x: 'max-content' }"
        :pagination="false"
        :row-key="primaryKey"
        @resizeColumn="handleResizeColumn"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="editRow(record)">
              编辑
            </a-button>
            <a-popconfirm
              title="确定要删除这条数据吗？"
              ok-text="确定"
              cancel-text="取消"
              @confirm="deleteRow(record)"
            >
              <a-button type="link" danger size="small">删除</a-button>
            </a-popconfirm>
          </template>
          <template v-else>
            <div class="cell-content">
              <span v-if="text === null" class="null-value"> NULL </span>
              <span v-else>{{ formatCellValue(text) }}</span>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:open="showEditDialog"
      :title="editMode === 'add' ? '新增数据' : '编辑数据'"
      width="600px"
      @ok="saveData"
      @cancel="showEditDialog = false"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-form-item
          v-for="field in fields"
          :key="field.name"
          :label="field.name"
          :name="field.name"
        >
          <a-textarea
            v-if="isTextField(field)"
            v-model:value="editForm[field.name]"
            :rows="3"
            placeholder="输入值或留空表示NULL"
          />
          <a-input
            v-else
            v-model:value="editForm[field.name]"
            placeholder="输入值或留空表示NULL"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { useQueryStore } from '@/stores/query'

const props = defineProps({
  connectionId: String,
  database: String,
  table: String
})

const queryStore = useQueryStore()

const loading = ref(false)
const tableData = ref([])
const fields = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(100)

const showEditDialog = ref(false)
const editMode = ref('edit')
const editForm = reactive({})
const editFormRef = ref()
const originalRecord = ref(null)

const columnWidths = ref({})
const searchText = ref('')
const selectedRowKeys = ref([])
const isBatchDeleting = ref(false)

const primaryKey = computed(() => {
  const pkField = fields.value.find(f => 
    f && f.flags && typeof f.flags.includes === 'function' && f.flags.includes('primary_key')
  )
  return pkField ? pkField.name : fields.value?.[0]?.name
})

const hasSelected = computed(() => selectedRowKeys.value.length > 0)

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    selectedRowKeys.value = keys
  }
}))

const filteredData = computed(() => {
  if (!searchText.value) {
    return tableData.value
  }
  return tableData.value.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchText.value.toLowerCase())
    )
  )
})

const handleResizeColumn = (w, col) => {
  columnWidths.value[col.key] = w
}

const columns = computed(() => {
  const fieldColumns = fields.value.map(field => ({
    title: field.name,
    dataIndex: field.name,
    key: field.name,
    ellipsis: true,
    width: columnWidths.value[field.name] || 200,
    resizable: true,
    sorter: (a, b) => {
      const valA = a[field.name]
      const valB = b[field.name]
      if (valA === null || valA === undefined) return -1
      if (valB === null || valB === undefined) return 1
      if (typeof valA === 'number' && typeof valB === 'number') {
        return valA - valB
      }
      return String(valA).localeCompare(String(valB))
    }
  }))

  return [
    ...fieldColumns,
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right'
    }
  ]
})

const loadData = async () => {
  if (!props.connectionId || !props.database || !props.table) return
  loading.value = true
  selectedRowKeys.value = []
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const result = await queryStore.getTableData(
      props.connectionId,
      props.database,
      props.table,
      pageSize.value,
      offset
    )
    if (result.success) {
      tableData.value = result.data
      fields.value = result.fields || []
      total.value = result.total || 0
    }
  } catch (error) {
    message.error(`加载数据失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const handlePageChange = (page, size) => {
  currentPage.value = page
  pageSize.value = size
  loadData()
}

const formatCellValue = (value) => {
  if (typeof value === 'string' && value.length > 100) {
    return value.substring(0, 100) + '...'
  }
  return String(value)
}

const isTextField = (field) => {
  const type = (typeof field.type === 'string') ? field.type.toLowerCase() : ''
  return type.includes('text') || type.includes('blob') || type.includes('json')
}

const handleAdd = () => {
  editMode.value = 'add'
  originalRecord.value = null
  Object.keys(editForm).forEach(key => delete editForm[key])
  fields.value.forEach(field => { editForm[field.name] = null })
  showEditDialog.value = true
}

const editRow = (record) => {
  editMode.value = 'edit'
  originalRecord.value = record
  Object.keys(editForm).forEach(key => delete editForm[key])
  Object.assign(editForm, record)
  showEditDialog.value = true
}

const deleteRow = async (record) => {
  try {
    const whereClause = buildWhereClause(record)
    await queryStore.deleteData(props.connectionId, props.database, props.table, whereClause)
    message.success('删除成功')
    loadData()
  } catch (error) { message.error(`删除失败: ${error.message}`) }
}

const handleBatchDelete = async () => {
  if (!primaryKey.value) {
    message.error('无法进行批量删除：当前表没有检测到主键。'); return;
  }
  Modal.confirm({
    title: `确认删除选中的 ${selectedRowKeys.value.length} 条记录吗？`,
    content: '此操作不可恢复。',
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      isBatchDeleting.value = true
      try {
        const pkValues = selectedRowKeys.value.map(key => typeof key === 'string' ? `'${key}'` : key).join(',')
        const whereClause = `\`${primaryKey.value}\` IN (${pkValues})`
        await queryStore.deleteData(props.connectionId, props.database, props.table, whereClause)
        message.success('批量删除成功')
        loadData()
      } catch (error) { message.error(`批量删除失败: ${error.message}`) } finally { isBatchDeleting.value = false }
    }
  })
}

const saveData = async () => {
  try {
    if (editMode.value === 'add') {
      await queryStore.insertData(props.connectionId, props.database, props.table, editForm)
      message.success('新增成功')
    } else {
      const whereClause = buildWhereClause(originalRecord.value)
      await queryStore.updateData(props.connectionId, props.database, props.table, editForm, whereClause)
      message.success('更新成功')
    }
    showEditDialog.value = false
    loadData()
  } catch (error) { message.error(`保存失败: ${error.message}`) }
}

const buildWhereClause = (record) => {
  if (primaryKey.value && record[primaryKey.value]) {
    const pkValue = record[primaryKey.value]
    return `\`${primaryKey.value}\` = ${typeof pkValue === 'string' ? `'${pkValue}'` : pkValue}`
  }
  // Fallback for tables without a clear primary key (less reliable)
  return Object.entries(record)
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, value]) => {
      if (value === null) return `\`${key}\` IS NULL`
      return `\`${key}\` = '${String(value).replace(/'/g, "''")}'`
    })
    .join(' AND ')
}

onMounted(loadData)

watch(() => [props.connectionId, props.database, props.table], () => {
  currentPage.value = 1
  loadData()
})
</script>

<style scoped>
.table-data-view { height: 100%; display: flex; flex-direction: column; }
.data-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; flex-shrink: 0; }
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; }
.execute-time { font-size: 12px; color: #888; margin-right: 16px; }
.table-container { flex: 1; overflow: hidden; }
.cell-content { min-height: 20px; }
.null-value { color: #c0c4cc; font-style: italic; }
</style>