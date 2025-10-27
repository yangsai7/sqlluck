<template>
  <div
    ref="rootDivRef"
    class="object-list-view"
    tabindex="0"
    @keydown="handleKeyDown"
  >
    <div v-if="!targetDB" class="no-selection">
      <a-empty description="在左侧双击一个数据库以查看其对象" />
    </div>
    <a-dropdown :trigger="['contextmenu']">
      <div class="list-container" @click.self="clearSelection">
        <div class="list-toolbar">
          <a-input-search
            ref="searchInputRef"
            v-model:value="searchText"
            placeholder="搜索..."
            style="width: 200px"
            allow-clear
          />
        </div>
        <a-table
          :columns="columns"
          :data-source="filteredObjects"
          :loading="connectionStore.loading"
          :pagination="{ pageSize: 20 }"
          size="small"
          row-key="name"
          :custom-row="customRow"
          :row-class-name="
            (record, _index) =>
              selectedRowKeys.includes(record.name) ? 'row-selected' : ''
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <a-dropdown :trigger="['contextmenu']" style="display: block">
                <div>
                  <component :is="objectType.icon" style="margin-right: 8px" />
                  <span>{{ record.name }}</span>
                </div>
                <template #overlay>
                  <a-menu
                    @click="({ key }) => handleContextCommand(key, record)"
                  >
                    <a-menu-item
                      key="viewData"
                      v-if="
                        objectType.type === 'table' ||
                        objectType.type === 'view'
                      "
                    >
                      <template #icon><TableOutlined /></template> 查看数据
                    </a-menu-item>
                    <a-menu-item
                      key="viewStructure"
                      v-if="
                        objectType.type === 'table' ||
                        objectType.type === 'view'
                      "
                    >
                      <template #icon><ApartmentOutlined /></template> 查看结构
                    </a-menu-item>
                    <a-menu-item key="viewDDL">
                      <template #icon><FileTextOutlined /></template> 查看DDL
                    </a-menu-item>
                    <a-menu-item
                      key="renameTable"
                      v-if="
                        objectType.type === 'table' ||
                        objectType.type === 'view'
                      "
                    >
                      <template #icon><EditOutlined /></template> 重命名
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="copyTable">
                      <template #icon><CopyOutlined /></template> 复制
                    </a-menu-item>
                    <a-menu-item
                      key="pasteTable"
                      :disabled="
                        !uiStore.clipboard || uiStore.clipboard.type !== 'table'
                      "
                    >
                      <template #icon><SnippetsOutlined /></template> 粘贴
                    </a-menu-item>
                    <a-menu-item
                      key="export"
                      v-if="objectType.type === 'table'"
                    >
                      <template #icon><ExportOutlined /></template> 导出
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item
                      key="clearTable"
                      danger
                      v-if="objectType.type === 'table'"
                    >
                      <template #icon><ClearOutlined /></template> 清空表
                    </a-menu-item>
                    <a-menu-item
                      key="truncateTable"
                      danger
                      v-if="objectType.type === 'table'"
                    >
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
      <template #overlay>
        <a-menu @click="({ key }) => handleBlankContextCommand(key)">
          <a-menu-item key="newTable">
            <template #icon><PlusOutlined /></template> 新建表
          </a-menu-item>
          <a-menu-item
            key="pasteTable"
            :disabled="!uiStore.clipboard || uiStore.clipboard.type !== 'table'"
          >
            <template #icon><SnippetsOutlined /></template> 粘贴表
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>

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
import { computed, ref, h, onMounted, onUnmounted } from "vue";
import { useUIStore } from "@/stores/ui";
import { useConnectionStore } from "@/stores/connection";
import { useQueryStore } from "@/stores/query";
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
  InputSearch as AInputSearch,
} from "ant-design-vue";
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
  EyeOutlined,
  FunctionOutlined,
  PlusOutlined,
} from "@ant-design/icons-vue";
import ExportDialog from "./ExportDialog.vue";

const uiStore = useUIStore();
const connectionStore = useConnectionStore();
const queryStore = useQueryStore();

const rootDivRef = ref(null);
const searchText = ref("");
const searchInputRef = ref(null);

const targetDB = computed(() => uiStore.objectsViewTarget);
const selectedRowKeys = ref([]);
let lastSelectedRowKey = null;
const isDragging = ref(false);
const dragMode = ref("add");
const hasDragged = ref(false);

const focusSearch = () => {
  searchInputRef.value?.focus();
};

const clearSelection = () => {
  selectedRowKeys.value = [];
  lastSelectedRowKey = null;
};

const handleKeyDown = (event) => {
  const target = event.target;
  const isInputFocused =
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable;

  if ((event.ctrlKey || event.metaKey) && event.key === "f") {
    event.preventDefault();
    focusSearch();
    return;
  }

  if (isInputFocused) {
    return;
  }

  if (event.key === "Delete") {
    event.preventDefault();
    handleDeleteKey();
  } else if ((event.ctrlKey || event.metaKey) && event.key === "c") {
    event.preventDefault();
    handleCopy();
  } else if ((event.ctrlKey || event.metaKey) && event.key === "v") {
    event.preventDefault();
    handlePaste();
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
};

onMounted(() => {
  window.addEventListener("mouseup", handleMouseUp);
});

onUnmounted(() => {
  window.removeEventListener("mouseup", handleMouseUp);
});

const objectType = computed(() => {
  const filter = uiStore.objectListFilter;
  if (filter === "views") {
    return { type: "view", icon: EyeOutlined, name: "视图" };
  }
  if (filter === "procedures") {
    return { type: "procedure", icon: FunctionOutlined, name: "存储过程" };
  }
  return { type: "table", icon: TableOutlined, name: "表" };
});

const allObjects = computed(() => {
  if (!targetDB.value) return [];
  const { connectionId, dbName } = targetDB.value;
  const details = connectionStore.connectionDetails[connectionId];
  if (!details || !details.dbObjects || !details.dbObjects[dbName]) return [];

  const objects = details.dbObjects[dbName][uiStore.objectListFilter] || [];

  // Normalize the data so that it's always an array of objects with a 'name' property
  return objects.map((obj) => {
    if (typeof obj === "string") {
      return { name: obj };
    }
    return obj;
  });
});

const filteredObjects = computed(() => {
  if (!searchText.value) {
    return allObjects.value;
  }
  return allObjects.value.filter((obj) =>
    obj.name.toLowerCase().includes(searchText.value.toLowerCase())
  );
});

const columns = computed(() => {
  const type = objectType.value.type;
  if (type === "table") {
    return [
      {
        title: "名称",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      {
        title: "行数",
        dataIndex: "rows",
        key: "rows",
        sorter: (a, b) => a.rows - b.rows,
      },
      {
        title: "数据长度",
        dataIndex: "dataLength",
        key: "dataLength",
        sorter: (a, b) => a.dataLength - b.dataLength,
      },
      {
        title: "引擎",
        dataIndex: "engine",
        key: "engine",
        sorter: (a, b) => a.engine.localeCompare(b.engine),
      },
      {
        title: "修改日期",
        dataIndex: "updateTime",
        key: "updateTime",
        sorter: (a, b) => new Date(a.updateTime) - new Date(b.updateTime),
      },
      { title: "注释", dataIndex: "comment", key: "comment" },
    ];
  }
  // Generic columns for views and functions
  return [
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
  ];
});

const formatBytes = (bytes) => {
  if (bytes === 0) return "0 B";
  if (!bytes) return "";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const customRow = (record) => {
  return {
    onContextmenu: (e) => {
      e.stopPropagation();
    },
    onDblclick: () => {
      if (
        objectType.value.type === "table" ||
        objectType.value.type === "view"
      ) {
        uiStore.openDataTab({
          connectionId: targetDB.value.connectionId,
          table: record.name,
          database: targetDB.value.dbName,
          type: "data",
        });
      }
    },
    onMousedown: (event) => {
      event.preventDefault();
      isDragging.value = true;
      hasDragged.value = false;
      const key = record.name;

      if (event.shiftKey && lastSelectedRowKey) {
        isDragging.value = false; // No drag with modifiers
        const lastIndex = filteredObjects.value.findIndex(
          (t) => t.name === lastSelectedRowKey
        );
        const currentIndex = filteredObjects.value.findIndex(
          (t) => t.name === key
        );
        if (lastIndex !== -1) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          const rangeKeys = filteredObjects.value
            .slice(start, end + 1)
            .map((t) => t.name);
          const newKeys = new Set(selectedRowKeys.value);
          rangeKeys.forEach((k) => newKeys.add(k));
          selectedRowKeys.value = Array.from(newKeys);
        }
      } else if (event.ctrlKey || event.metaKey) {
        isDragging.value = false; // No drag with modifiers
        if (selectedRowKeys.value.includes(key)) {
          selectedRowKeys.value = selectedRowKeys.value.filter(
            (k) => k !== key
          );
        } else {
          selectedRowKeys.value.push(key);
        }
      } else {
        // No modifiers. Prepare for drag.
        if (selectedRowKeys.value.includes(key)) {
          dragMode.value = "remove";
        } else {
          dragMode.value = "add";
          selectedRowKeys.value = [key];
        }
      }
      lastSelectedRowKey = key;
      rootDivRef.value?.focus();
    },
    onMouseenter: () => {
      if (isDragging.value) {
        hasDragged.value = true;
        const key = record.name;
        if (dragMode.value === "add") {
          if (!selectedRowKeys.value.includes(key)) {
            selectedRowKeys.value.push(key);
          }
        } else {
          // 'remove'
          if (selectedRowKeys.value.includes(key)) {
            selectedRowKeys.value = selectedRowKeys.value.filter(
              (k) => k !== key
            );
          }
        }
      }
    },
    onMouseup: () => {
      if (isDragging.value && !hasDragged.value) {
        const key = record.name;
        if (dragMode.value === "remove") {
          selectedRowKeys.value = [key];
        }
      }
      rootDivRef.value?.focus();
    },
  };
};

const ddlVisible = ref(false);
const ddlContent = ref("");
const exportDialogVisible = ref(false);
const tableToExport = ref(null);

const getSelectedNodes = (clickedRecord) => {
  if (
    selectedRowKeys.value.length <= 1 ||
    !selectedRowKeys.value.includes(clickedRecord.name)
  ) {
    return [
      {
        type: objectType.value.type,
        table: clickedRecord.name, // Use a generic name for the object
        database: targetDB.value.dbName,
        connectionId: targetDB.value.connectionId,
        ...clickedRecord,
      },
    ];
  }
  return selectedRowKeys.value.map((key) => {
    const record = filteredObjects.value.find((t) => t.name === key);
    return {
      type: objectType.value.type,
      table: record.name,
      database: targetDB.value.dbName,
      connectionId: targetDB.value.connectionId,
      ...record,
    };
  });
};

const handleNewTable = () => {
  if (targetDB.value) {
    uiStore.openNewTableTab({
      connectionId: targetDB.value.connectionId,
      database: targetDB.value.dbName,
    });
  }
};

const handleBlankContextCommand = (command) => {
  switch (command) {
    case "newTable":
      handleNewTable();
      break;
    case "pasteTable":
      handlePaste();
      break;
  }
};

const handleContextCommand = async (command, record) => {
  const nodes = getSelectedNodes(record);
  const firstNode = nodes[0];

  if (
    firstNode.connectionId &&
    firstNode.connectionId !== connectionStore.activeConnectionId
  ) {
    await connectionStore.setActiveConnection(firstNode.connectionId);
  }
  if (
    firstNode.database &&
    firstNode.database !== connectionStore.activeDatabaseName
  ) {
    await connectionStore.setActiveDatabase(firstNode.database);
  }

  switch (command) {
    case "viewData":
      uiStore.openDataTab({
        connectionId: firstNode.connectionId,
        table: firstNode.table,
        database: firstNode.database,
        type: "data",
      });
      break;
    case "viewStructure":
      uiStore.openDataTab({
        connectionId: firstNode.connectionId,
        table: firstNode.table,
        database: firstNode.database,
        type: "structure",
      });
      break;
    case "viewDDL":
      await showDDL(firstNode);
      break;
    case "renameTable":
      confirmRenameTable(firstNode);
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
      tableToExport.value = firstNode;
      exportDialogVisible.value = true;
      break;
  }
};

const handleCopy = () => {
  if (selectedRowKeys.value.length > 0) {
    const selectedRecords = filteredObjects.value.filter((t) =>
      selectedRowKeys.value.includes(t.name)
    );
    const itemsToCopy = selectedRecords.map((record) => ({
      database: targetDB.value.dbName,
      table: record.name,
      connectionId: targetDB.value.connectionId,
      type: "table", // Paste will always treat it as a table for now
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
    const firstSelectedKey = selectedRowKeys.value[0];
    const record = filteredObjects.value.find(
      (t) => t.name === firstSelectedKey
    );
    if (record) {
      const nodes = getSelectedNodes(record);
      confirmDeleteTable(nodes);
    }
  }
};

const showDDL = async (node) => {
  try {
    const type = node.type.toUpperCase();
    const sql = `SHOW CREATE ${type} \`${node.database}\`.\`${node.table}\``;
    const result = await queryStore.executeQuery(
      node.connectionId,
      node.database,
      sql
    );
    if (result.success && result.data.length > 0) {
      const createStatementKey = Object.keys(result.data[0]).find((k) =>
        k.toLowerCase().startsWith("create")
      );
      ddlContent.value = result.data[0][createStatementKey];
      ddlVisible.value = true;
    } else {
      throw new Error(result.error || "未能获取DDL");
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
        await queryStore.executeQuery(
          tableNode.connectionId,
          tableNode.database,
          sql
        );
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
    content: h("div", null, [
      h("p", `${content}:`),
      h(
        "ul",
        { style: "margin-top: 1em; max-height: 150px; overflow-y: auto;" },
        nodes.map((n) => h("li", `${n.database}.${n.table}`))
      ),
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
  confirmBulkOperation(
    nodes,
    (n) => `DELETE FROM \`${n.database}\`.\`${n.table}\``,
    {
      title: "确认清空表",
      content: "您确定要清空以下表中的所有数据吗？此操作不可恢复。",
      okText: "确认清空",
    }
  );
};

const confirmTruncateTable = (nodes) => {
  confirmBulkOperation(
    nodes,
    (n) => `TRUNCATE TABLE \`${n.database}\`.\`${n.table}\``,
    {
      title: "确认截断表",
      content: "您确定要截断以下表吗？此操作会重置自增计数器，且不可恢复。",
      okText: "确认截断",
    }
  );
};

const confirmDeleteTable = (nodes) => {
  confirmBulkOperation(
    nodes,
    (n) => `DROP ${n.type.toUpperCase()} \`${n.database}\`.\`${n.table}\``,
    {
      title: `确认删除${objectType.value.name}`,
      content: `您确定要删除以下${objectType.value.name}吗？此操作不可恢复。`,
      okText: "确认删除",
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
.list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.list-toolbar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}
:deep(.ant-table-row) {
  cursor: pointer;
  user-select: none;
}
.ddl-textarea {
  font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
}
:deep(.row-selected > td) {
  background-color: #e6f7ff !important;
}
</style>
