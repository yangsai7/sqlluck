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
        :row-key="getRowKey"
        :custom-row="customRow"
        :row-class-name="rowClassName"
        @resizeColumn="handleResizeColumn"
      >
        <template #bodyCell="{ column, text, record }">
          <div class="cell-content" :class="{ 'dirty-cell': isCellDirty(record, column) }" @dblclick.stop="setEditingCell(record, column)">
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
let newRowCounter = 0;

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

const hasPendingChanges = computed(() => Object.keys(pendingChanges).length > 0 || tableData.value.some(r => r.__isNew));

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

const getRowKey = (record) => {
  if (record.__isNew) {
    return record.__tempId;
  }
  return primaryKey.value ? record[primaryKey.value] : undefined;
};

const handleResizeColumn = (w, col) => {
  columnWidths.value[col.key] = w
}

const rowClassName = (record) => {
  const key = getRowKey(record);
  let className = key && selectedRowKeys.value.includes(key) ? 'row-selected' : '';
  if (record.__isNew) {
    className += ' new-row';
  }
  return className;
};

const customRow = (record) => {
  return {
    onClick: (event) => {
      const key = getRowKey(record);
      if (!key) return;

      const currentKeys = [...selectedRowKeys.value];
      const data = filteredData.value;
      const allKeys = data.map(r => getRowKey(r));

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
  const recordKey = getRowKey(record);
  if (!recordKey) return false;
  return editingCellKey.value === `${recordKey}-${column.key}`;
};

const isCellDirty = (record, column) => {
  const recordKey = getRowKey(record);
  if (!recordKey) return false;
  if (record.__isNew) {
    return record[column.key] !== null; // For new rows, any value is a change
  }
  return pendingChanges[recordKey]?.[column.key] !== undefined;
}

const setEditingCell = (record, column) => {
  if (editingCellKey.value) {
    stageChange();
  }
  const recordKey = getRowKey(record);
  if (!recordKey) {
     message.error('无法编辑：无法确定行标识。');
    return;
  }
  editingCellKey.value = `${recordKey}-${column.key}`;
  editingValue.value = record[column.key];
  originalCellValue.value = record[column.key];
  
  nextTick(() => {
    editingInputRef.value?.focus();
  });
};

const validateCellValue = (value, field) => {
  if (value === null || value === '') return { isValid: true }; // Allow null/empty

  const fieldType = fields.value.find(f => f.name === field.name)?.type.toLowerCase() || '';

  if (fieldType.includes('int') || fieldType.includes('decimal') || fieldType.includes('float') || fieldType.includes('double') || fieldType.includes('bit')) {
    if (isNaN(Number(value))) {
      return { isValid: false, message: `字段 ${field.name} 需要一个有效的数值。` };
    }
  }
  // Can add more validators for DATE, DATETIME etc. here

  return { isValid: true };
};

const stageChange = () => {
  if (editingCellKey.value === null) return;

  const keyToStage = editingCellKey.value;
  const newValue = editingValue.value;
  const originalValue = originalCellValue.value;
  const [recordKey, columnKey] = keyToStage.split('-');

  const column = columns.value.find(c => c.key === columnKey);
  if (column) {
    const validation = validateCellValue(newValue, column);
    if (!validation.isValid) {
      message.error(validation.message);
      editingInputRef.value?.focus(); // Keep focus for user to correct
      return;
    }
  }

  editingCellKey.value = null;

  if (newValue !== originalValue) {
    const record = tableData.value.find(r => String(getRowKey(r)) === recordKey);

    if (record) {
      if (record.__isNew) {
        record[columnKey] = newValue;
      } else {
        if (!pendingChanges[recordKey]) {
          pendingChanges[recordKey] = {};
        }
        pendingChanges[recordKey][columnKey] = newValue;
        record[columnKey] = newValue;
      }
    }
  }
};

const cancelCellEdit = () => {
  editingCellKey.value = null;
};

const submitChanges = async () => {
  stageChange(); // Stage any pending cell edit

  const newRows = tableData.value.filter(r => r.__isNew);
  const updatePromises = [];

  // Handle updates for existing rows
  for (const recordKey in pendingChanges) {
    if (newRows.some(nr => getRowKey(nr) === recordKey)) {
      continue; // Skip new rows, they will be handled by INSERT
    }
    const originalRecord = originalTableData.value.find(r => String(r[primaryKey.value]) === recordKey);
    if (originalRecord) {
      const changedData = pendingChanges[recordKey];
      const whereClause = buildWhereClause(originalRecord);
      updatePromises.push(queryStore.updateData(props.connectionId, props.database, props.table, changedData, whereClause));
    }
  }

  // Handle inserts for new rows
  const insertPromises = newRows.map(newRow => {
    const rowData = { ...newRow };
    delete rowData.__isNew;
    delete rowData.__tempId;
    return queryStore.insertData(props.connectionId, props.database, props.table, rowData);
  });

  try {
    await Promise.all([...insertPromises, ...updatePromises]);
    message.success('所有更改已提交');
    loadData(); // Reload data to get a clean state
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

const handleAdd = () => {
  const newRow = { __isNew: true, __tempId: `new_${newRowCounter++}` };
  fields.value.forEach(field => {
    newRow[field.name] = null;
  });
  tableData.value.push(newRow);
};

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

:deep(.new-row > td) {
  background-color: #f6ffed !important;
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