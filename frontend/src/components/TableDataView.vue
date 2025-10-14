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
          删除
        </a-button>
        <a-divider type="vertical" />
        <a-button type="primary" size="small" :disabled="!hasPendingChanges" @click="submitChanges">
          <template #icon><SaveOutlined /></template>
          保存
        </a-button>
        
        <a-divider type="vertical" />
        <a-button size="small" @click="loadData">
          <template #icon><SyncOutlined /></template>
          刷新
        </a-button>
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
        size="small"
        bordered
        :scroll="{ y: '100%', x: 'max-content' }"
        :pagination="false"
        :row-key="primaryKey"
        :custom-row="customRow"
        :row-class-name="rowClassName"
        @resizeColumn="handleResizeColumn"
      >
        <template #bodyCell="{ column, text, record }">
          <div class="cell-content" :class="{ 'dirty-cell': isCellDirty(record, column) }" @click.stop="setEditingCell(record, column)">
            <template v-if="isEditing(record, column)">
              <a-input
                ref="editingInputRef"
                v-model:value="editingValue"
                @pressEnter="stageChange"
                @blur="stageChange"
                @keydown.esc="cancelCellEdit"
              />
            </template>
            <template v-else>
              <span v-if="text === null" class="null-value"> NULL </span>
              <span v-else>{{ formatCellValue(text) }}</span>
            </template>
          </div>
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
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, SyncOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons-vue'
import { useQueryStore } from '@/stores/query'

const props = defineProps({
  connectionId: String,
  database: String,
  table: String
})

const queryStore = useQueryStore()

const loading = ref(false)
const tableData = ref([])
const originalTableData = ref([]) // Pristine copy of data
const fields = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(100)

const showEditDialog = ref(false)
const editMode = ref('edit')
const editForm = reactive({})
const editFormRef = ref()
const originalRecordForModal = ref(null) // Renamed to avoid conflict

const columnWidths = ref({})
const searchText = ref('')
const selectedRowKeys = ref([])
const lastSelectedRowKey = ref(null)
const isBatchDeleting = ref(false)

// Inline editing state
const editingCellKey = ref(null); // format: `${recordKey}-${columnKey}`
const editingValue = ref('');
const originalCellValue = ref('');
const editingInputRef = ref(null);
const pendingChanges = reactive({}); // { [recordKey]: { [columnKey]: newValue } }

const hasPendingChanges = computed(() => Object.keys(pendingChanges).length > 0);

const PRIMARY_KEY_FLAG = 2; // From mysql2/lib/constants/field_flags
const primaryKey = computed(() => {
  const pkField = fields.value.find(f => f.flags & PRIMARY_KEY_FLAG);
  return pkField ? pkField.name : fields.value?.[0]?.name;
});

const hasSelected = computed(() => selectedRowKeys.value.length > 0)

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

const rowClassName = (record) => {
  if (!primaryKey.value) return '';
  const key = record[primaryKey.value];
  return selectedRowKeys.value.includes(key) ? 'row-selected' : '';
};

const customRow = (record) => {
  return {
    onClick: (event) => {
      if (!primaryKey.value) return;
      if (event.target.closest('.cell-content')) {
        return;
      }

      const key = record[primaryKey.value];
      const currentKeys = [...selectedRowKeys.value];
      const data = filteredData.value;
      const allKeys = data.map(r => r[primaryKey.value]);

      if (event.shiftKey && lastSelectedRowKey.value) {
        const lastIndex = allKeys.indexOf(lastSelectedRowKey.value);
        const currentIndex = allKeys.indexOf(key);
        if (lastIndex === -1 || currentIndex === -1) {
            selectedRowKeys.value = [key];
        } else {
            const start = Math.min(lastIndex, currentIndex);
            const end = Math.max(lastIndex, currentIndex);
            const keysToSelect = allKeys.slice(start, end + 1);
            selectedRowKeys.value = [...new Set([...currentKeys, ...keysToSelect])];
        }
      } else if (event.ctrlKey || event.metaKey) {
        const index = currentKeys.indexOf(key);
        if (index > -1) {
          currentKeys.splice(index, 1);
        } else {
          currentKeys.push(key);
        }
        selectedRowKeys.value = currentKeys;
        lastSelectedRowKey.value = key;
      } else {
        if (currentKeys.length === 1 && currentKeys[0] === key) {
            selectedRowKeys.value = [];
            lastSelectedRowKey.value = null;
        } else {
            selectedRowKeys.value = [key];
            lastSelectedRowKey.value = key;
        }
      }
    },
  };
};

const columns = computed(() => {
  return fields.value.map(field => ({
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
})

// --- Inline Edit Methods ---
const isEditing = (record, column) => {
  if (!primaryKey.value) return false;
  const recordKey = record[primaryKey.value];
  return editingCellKey.value === `${recordKey}-${column.key}`;
};

const isCellDirty = (record, column) => {
  if (!primaryKey.value) return false;
  const recordKey = record[primaryKey.value];
  return pendingChanges[recordKey]?.[column.key] !== undefined;
}

const setEditingCell = (record, column) => {
  if (editingCellKey.value) {
    stageChange();
  }
  if (!primaryKey.value) {
    message.error('无法编辑：当前表没有检测到主键。');
    return;
  }
  const recordKey = record[primaryKey.value];
  editingCellKey.value = `${recordKey}-${column.key}`;
  editingValue.value = record[column.key];
  originalCellValue.value = record[column.key];
  
  nextTick(() => {
    editingInputRef.value?.focus();
  });
};

const stageChange = () => {
  if (editingCellKey.value === null) return;

  const keyToStage = editingCellKey.value;
  const newValue = editingValue.value;
  const originalValue = originalCellValue.value;
  editingCellKey.value = null;

  if (newValue !== originalValue) {
    const [recordKey, columnKey] = keyToStage.split('-');
    const record = tableData.value.find(r => String(r[primaryKey.value]) === recordKey);

    if (record) {
      if (!pendingChanges[recordKey]) {
        pendingChanges[recordKey] = {};
      }
      pendingChanges[recordKey][columnKey] = newValue;
      record[columnKey] = newValue;
    }
  }
};

const cancelCellEdit = () => {
  editingCellKey.value = null;
};

const submitChanges = async () => {
  stageChange();
  const promises = [];
  for (const recordKey in pendingChanges) {
    const originalRecord = originalTableData.value.find(r => String(r[primaryKey.value]) === recordKey);
    if (originalRecord) {
      const changedData = pendingChanges[recordKey];
      const whereClause = buildWhereClause(originalRecord);
      promises.push(queryStore.updateData(props.connectionId, props.database, props.table, changedData, whereClause));
    }
  }

  try {
    await Promise.all(promises);
    message.success('所有更改已提交');
    Object.keys(pendingChanges).forEach(key => delete pendingChanges[key]);
    originalTableData.value = JSON.parse(JSON.stringify(tableData.value));
  } catch (error) {
    message.error(`提交部分或全部更改失败: ${error.message}`);
  }
};

// --- Data Loading and Manipulation ---
const loadData = async () => {
  if (!props.connectionId || !props.database || !props.table) return
  loading.value = true
  selectedRowKeys.value = []
  Object.keys(pendingChanges).forEach(key => delete pendingChanges[key]);
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
      tableData.value = result.data;
      originalTableData.value = JSON.parse(JSON.stringify(result.data)); // Deep copy
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
  originalRecordForModal.value = null
  Object.keys(editForm).forEach(key => delete editForm[key])
  fields.value.forEach(field => { editForm[field.name] = null })
  showEditDialog.value = true
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
        const whereClause = `"${primaryKey.value}" IN (${pkValues})`
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
      const whereClause = buildWhereClause(originalRecordForModal.value)
      await queryStore.updateData(props.connectionId, props.database, props.table, editForm, whereClause)
      message.success('更新成功')
    }
    showEditDialog.value = false
    loadData()
  } catch (error) { message.error(`保存失败: ${error.message}`) }
}

const buildWhereClause = (record) => {
  if (primaryKey.value && record[primaryKey.value] !== undefined && record[primaryKey.value] !== null) {
    const pkValue = record[primaryKey.value];
    const pkColumn = '`' + primaryKey.value + '`';
    const valueString = typeof pkValue === 'string' ? "'" + pkValue.replace(/'/g, "''") + "'" : pkValue;
    return pkColumn + ' = ' + valueString;
  }
  // Fallback for tables without a clear primary key (less reliable)
  return Object.entries(record)
    .filter(([key]) => !key.startsWith('__'))
    .map(([key, value]) => {
      if (value === null) return '`' + key + '` IS NULL';
      return '`' + key + '` = "' + String(value).replace(/'/g, "''") + '"';
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
.table-container { flex: 1; overflow: auto; }
.cell-content { min-height: 20px; width: 100%; position: relative; padding: 4px; }
.null-value { color: #c0c4cc; font-style: italic; }

:deep(.ant-table-row) {
  cursor: pointer;
}

:deep(.row-selected > td) {
  background-color: #e6f7ff !important;
}

:deep(.ant-table-bordered .ant-table-tbody > tr > td) {
  border-top: 1px solid #d9d9d9;
  border-left: 1px solid #d9d9d9;
  padding: 0; /* Remove padding for cell content to control it */
}

:deep(.ant-table-bordered .ant-table-thead > tr > th) {
  border-left: 1px solid #d9d9d9;
  border-top: 1px solid #d9d9d9;
}

.dirty-cell::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  border-style: solid;
  border-width: 6px;
  border-color: #1890ff transparent transparent #1890ff; /* Blue corner */
}
</style>