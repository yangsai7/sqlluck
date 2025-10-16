<template>
  <div class="object-list-view" tabindex="0" @keydown.delete.prevent="handleDeleteKey" @keydown.ctrl.c.prevent="handleCopy" @keydown.meta.c.prevent="handleCopy" @keydown.ctrl.v.prevent="handlePaste" @keydown.meta.v.prevent="handlePaste">
    <div v-if="!targetDB" class="no-selection">
      <a-empty description="在左侧双击一个数据库以查看其对象" />
    </div>
    <div v-else>
      <a-table
        :columns="columns"
        :data-source="tables"
        :loading="connectionStore.loading"
        :pagination="{ pageSize: 20 }"
        size="small"
        row-key="name"
        :custom-row="customRow"
        :row-class-name="(record, _index) => selectedRowKeys.includes(record.name) ? 'row-selected' : ''"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a-dropdown :trigger="['contextmenu']" style="display: block">
              <div>
                <TableOutlined style="margin-right: 8px" />
                <span>{{ record.name }}</span>
              </div>
              <template #overlay>
                <a-menu @click="({ key }) => handleContextCommand(key, record)">
                  <a-menu-item key="viewData" :disabled="selectedRowKeys.length > 1">
                    <template #icon><TableOutlined /></template> 查看数据
                  </a-menu-item>
                  <a-menu-item key="viewStructure" :disabled="selectedRowKeys.length > 1">
                    <template #icon><ApartmentOutlined /></template> 查看结构
                  </a-menu-item>
                  <a-menu-item key="viewDDL" :disabled="selectedRowKeys.length > 1">
                    <template #icon><FileTextOutlined /></template> 查看DDL
                  </a-menu-item>
                  <a-menu-item key="renameTable" :disabled="selectedRowKeys.length > 1">
                    <template #icon><EditOutlined /></template> 重命名
                  </a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="copyTable">
                    <template #icon><CopyOutlined /></template> 复制
                  </a-menu-item>
                  <a-menu-item key="pasteTable" :disabled="!uiStore.clipboard || uiStore.clipboard.type !== 'table'">
                    <template #icon><SnippetsOutlined /></template> 粘贴
                  </a-menu-item>
                  <a-menu-item key="export">
                    <template #icon><ExportOutlined /></template> 导出
                  </a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="clearTable" danger>
                    <template #icon><ClearOutlined /></template> 清空表
                  </a-menu-item>
                  <a-menu-item key="truncateTable" danger>
                    <template #icon><StopOutlined /></template> 截断表
                  </a-menu-item>
                  <a-menu-item key="deleteTable" danger>
                    <template #icon><DeleteOutlined /></template> 删除
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </template>
          <template v-else-if="column.key === 'dataLength'">
            {{ formatBytes(record.dataLength) }}
          </template>
           <template v-else-if="column.key === 'rows'">
            {{ record.rows }}
          </template>
           <template v-else-if="column.key === 'engine'">
            {{ record.engine }}
          </template>
           <template v-else-if="column.key === 'updateTime'">
            {{ record.updateTime }}
          </template>
           <template v-else-if="column.key === 'comment'">
            {{ record.comment }}
          </template>
        </template>
      </a-table>
    </div>

    <a-modal v-model:open="ddlVisible" title="查看DDL" width="70%">
      <a-textarea
        :value="ddlContent"
        :rows="15"
        readonly
        class="ddl-textarea"
      />
      <template #footer>
        <a-button @click="ddlVisible = false">关闭</a-button>
        <a-button type="primary" @click="copyDDL">复制</a-button>
      </template>
    </a-modal>

    <ExportDialog
      v-if="tableToExport"
      v-model:visible="exportDialogVisible"
      :table-info="tableToExport"
    />
  </div>
</template>

<script setup>
import { computed, ref, h } from 'vue';
import { useUIStore } from '@/stores/ui';
import { useConnectionStore } from '@/stores/connection';
import { useQueryStore } from '@/stores/query';
import { 
  Empty as AEmpty, 
  Table as ATable, 
  Dropdown as ADropdown, 
  Menu as AMenu, 
  MenuItem as AMenuItem, 
  MenuDivider as AMenuDivider, 
  Modal, 
  message, 
  Input,
  Textarea as ATextarea,
  Button as AButton,
} from 'ant-design-vue';
import {
  TableOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  EditOutlined,
  CopyOutlined,
  ExportOutlined,
  ClearOutlined,
  StopOutlined,
  DeleteOutlined,
  SnippetsOutlined,
} from '@ant-design/icons-vue';
import ExportDialog from './ExportDialog.vue';

const uiStore = useUIStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const targetDB = computed(() => uiStore.objectsViewTarget);
const selectedRowKeys = ref([]);
let lastSelectedRowKey = null;

const tables = computed(() => {
  if (!targetDB.value) return [];
  const { connectionId, dbName } = targetDB.value;
  const details = connectionStore.connectionDetails[connectionId];
  if (!details || !details.dbObjects || !details.dbObjects[dbName]) return [];
  return details.dbObjects[dbName].tables;
});

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
  { title: '行数', dataIndex: 'rows', key: 'rows', sorter: (a, b) => a.rows - b.rows },
  { title: '数据长度', dataIndex: 'dataLength', key: 'dataLength', sorter: (a, b) => a.dataLength - b.dataLength },
  { title: '引擎', dataIndex: 'engine', key: 'engine', sorter: (a, b) => a.engine.localeCompare(b.engine) },
  { title: '修改日期', dataIndex: 'updateTime', key: 'updateTime', sorter: (a, b) => new Date(a.updateTime) - new Date(b.updateTime) },
  { title: '注释', dataIndex: 'comment', key: 'comment' },
];

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const customRow = (record) => {
  return {
    onClick: (event) => {
      const key = record.name;
      if (event.ctrlKey || event.metaKey) {
        if (selectedRowKeys.value.includes(key)) {
          selectedRowKeys.value = selectedRowKeys.value.filter(k => k !== key);
        } else {
          selectedRowKeys.value.push(key);
        }
      } else if (event.shiftKey) {
        const lastIndex = tables.value.findIndex(t => t.name === lastSelectedRowKey);
        const currentIndex = tables.value.findIndex(t => t.name === key);
        if (lastIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeKeys = tables.value.slice(start, end + 1).map(t => t.name);
          const newKeys = [...new Set([...selectedRowKeys.value, ...rangeKeys])];
          selectedRowKeys.value = newKeys;
        } else {
          selectedRowKeys.value = [key];
        }
      } else {
        selectedRowKeys.value = [key];
      }
      lastSelectedRowKey = key;
    },
    onDblclick: () => {
      uiStore.openDataTab({
        table: record.name, 
        database: targetDB.value.dbName, 
        connectionId: targetDB.value.connectionId,
        type: 'data' 
      });
    },
  };
};

const ddlVisible = ref(false);
const ddlContent = ref("");
const exportDialogVisible = ref(false);
const tableToExport = ref(null);

const getSelectedNodes = (clickedRecord) => {
  if (selectedRowKeys.value.length <= 1 || !selectedRowKeys.value.includes(clickedRecord.name)) {
    return [{
      type: 'table',
      table: clickedRecord.name,
      database: targetDB.value.dbName,
      connectionId: targetDB.value.connectionId,
      ...clickedRecord
    }];
  }
  return selectedRowKeys.value.map(key => {
    const record = tables.value.find(t => t.name === key);
    return {
      type: 'table',
      table: record.name,
      database: targetDB.value.dbName,
      connectionId: targetDB.value.connectionId,
      ...record
    };
  });
};

const handleContextCommand = async (command, record) => {
  const nodes = getSelectedNodes(record);
  const firstNode = nodes[0];

  if (firstNode.connectionId && firstNode.connectionId !== connectionStore.activeConnectionId) {
    await connectionStore.setActiveConnection(firstNode.connectionId);
  }
  if (firstNode.database && firstNode.database !== connectionStore.activeDatabaseName) {
    await connectionStore.setActiveDatabase(firstNode.database);
  }

  switch (command) {
    case "viewData":
    case "viewStructure":
    case "viewDDL":
    case "renameTable":
      if (nodes.length > 1) {
        message.info('This action cannot be performed on multiple items.');
        return;
      }
      // Fallthrough for single item
      if (command === 'viewData') uiStore.openDataTab({ connectionId: firstNode.connectionId, table: firstNode.table, database: firstNode.database, type: 'data' });
      if (command === 'viewStructure') uiStore.openDataTab({ connectionId: firstNode.connectionId, table: firstNode.table, database: firstNode.database, type: 'structure' });
      if (command === 'viewDDL') await showDDL(firstNode);
      if (command === 'renameTable') confirmRenameTable(firstNode);
      break;
    case "deleteTable":
      confirmDeleteTable(nodes);
      break;
    case "clearTable":
      confirmClearTable(nodes);
      break;
    case "truncateTable":
      confirmTruncateTable(nodes);
      break;
    case "copyTable":
      handleCopy();
      break;
    case "pasteTable":
      handlePaste();
      break;
    case "export":
      // For now, export still works on a single table from context menu
      tableToExport.value = firstNode;
      exportDialogVisible.value = true;
      break;
  }
};

const handleCopy = () => {
  if (selectedRowKeys.value.length > 0) {
    const selectedRecords = tables.value.filter(t => selectedRowKeys.value.includes(t.name));
    const itemsToCopy = selectedRecords.map(record => ({
      database: targetDB.value.dbName,
      table: record.name,
      connectionId: targetDB.value.connectionId,
      type: 'table'
    }));
    uiStore.copy("table", itemsToCopy);
    message.success(`已复制 ${itemsToCopy.length} 个对象`);
  }
};

const handlePaste = () => {
  if (targetDB.value) {
    uiStore.paste(targetDB.value);
  }
};

const handleDeleteKey = () => {
  if (selectedRowKeys.value.length > 0) {
    const selectedRecords = tables.value.filter(t => selectedRowKeys.value.includes(t.name));
    const nodes = selectedRecords.map(record => ({
      type: 'table',
      table: record.name,
      database: targetDB.value.dbName,
      connectionId: targetDB.value.connectionId,
      ...record
    }));
    confirmDeleteTable(nodes);
  }
};

const showDDL = async (node) => {

  try {

    const sql = `SHOW CREATE TABLE \`${node.database}\`.\`${node.table}\``;

    const result = await queryStore.executeQuery(node.connectionId, node.database, sql);

    if (result.success && result.data.length > 0) {

      ddlContent.value = result.data[0]["Create Table"];

      ddlVisible.value = true;

    } else {

      throw new Error(result.error || '未能获取DDL');

    }

  } catch (error) {

    message.error(`获取DDL失败: ${error.message}`);

  }

};



const copyDDL = async () => {

  try {

    await navigator.clipboard.writeText(ddlContent.value);

    message.success("复制成功");

  } catch (error) {

    message.error("复制失败");

  }

};



const confirmRenameTable = (tableNode) => {

  let newTableName = tableNode.table;

  Modal.confirm({

    title: `重命名 "${newTableName}"`, 

    content: h("div", { style: "margin-top: 1em;" }, [

      h("p", "请输入新的名称:"),

      h(Input, {

        defaultValue: newTableName,

        onChange: (e) => {

          newTableName = e.target.value;

        },

      }),

    ]),

    onOk: async () => {

      if (!newTableName || newTableName.trim() === "") {

        message.error("名称不能为空");

        return Promise.reject("名称不能为空");

      }

      if (newTableName === tableNode.table) return;

      try {

        const sql = `RENAME TABLE \`${tableNode.database}\`.\`${tableNode.table}\` TO \`${tableNode.database}\`.\`${newTableName}\``;

        await queryStore.executeQuery(tableNode.connectionId, tableNode.database, sql);

        message.success("重命名成功");

        await connectionStore.setActiveDatabase(tableNode.database, true); // Force refresh

      } catch (error) {

        message.error(`重命名失败: ${error.message}`);

        return Promise.reject(error);

      }

    },

  });

};



const confirmBulkOperation = (nodes, operation, { title, content, okText }) => {

  Modal.confirm({

    title: `${title} (${nodes.length} 个对象)`,

    content: h('div', null, [

      h('p', `${content}:`),

      h('ul', { style: 'margin-top: 1em; max-height: 150px; overflow-y: auto;' }, 

        nodes.map(n => h('li', `${n.database}.${n.table}`)))

    ]),

    okText: okText,

    okType: "danger",

    cancelText: "取消",

    onOk: async () => {

      try {

        for (const node of nodes) {

          const sql = operation(node);

          await queryStore.executeQuery(node.connectionId, node.database, sql);

        }

        message.success(`${title}成功`);

        await connectionStore.setActiveDatabase(nodes[0].database, true); // Force refresh

      } catch (error) {

        message.error(`${title}失败: ${error.message}`);

        return Promise.reject(error);

      }

    },

  });

};



const confirmClearTable = (nodes) => {

  confirmBulkOperation(nodes, 

    (n) => `DELETE FROM \`${n.database}\`.\`${n.table}\``,

    {

      title: '确认清空表',

      content: '您确定要清空以下表中的所有数据吗？此操作不可恢复。',

      okText: '确认清空'

    }

  );

};



const confirmTruncateTable = (nodes) => {

  confirmBulkOperation(nodes,

    (n) => `TRUNCATE TABLE \`${n.database}\`.\`${n.table}\``,

    {

      title: '确认截断表',

      content: '您确定要截断以下表吗？此操作会重置自增计数器，且不可恢复。',

      okText: '确认截断'

    }

  );

};



const confirmDeleteTable = (nodes) => {

  confirmBulkOperation(nodes,

    (n) => `DROP TABLE \`${n.database}\`.\`${n.table}\``,

    {

      title: '确认删除表',

      content: '您确定要删除以下表吗？此操作不可恢复。',

      okText: '确认删除'

    }

  );

};

</script>

<style scoped>
.object-list-view {
  height: 100%;
  width: 100%;
  outline: none; /* Remove focus outline */
}
.no-selection {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
:deep(.ant-table-row) {
  cursor: pointer;
}
.ddl-textarea {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}
:deep(.row-selected > td) {
  background-color: #e6f7ff !important;
}
</style>