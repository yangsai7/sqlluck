// Pinia状态管理 - 全局UI状态
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', {
  state: () => ({
    clipboard: null, // { type: 'table', data: { ... } }
    activeMainTab: 'objects', // The key of the active tab in Home.vue
    objectsViewTarget: null, // { connectionId, dbName }
    dataTabs: [], // { name, label, type, database, table }
  }),

  actions: {
    // 复制到剪贴板
    copy(type, data) {
      this.clipboard = { type, data }
    },

    // 清空剪贴板
    clearClipboard() {
      this.clipboard = null
    },

    setActiveMainTab(key) {
      this.activeMainTab = key;
    },

    showObjectsView(target) { // target: { connectionId, dbName }
      this.objectsViewTarget = target;
      this.activeMainTab = 'objects';
    },

    openDataTab(tabInfo) { // { table, database, type: 'data' | 'structure' }
      const tabType = tabInfo.type || 'data';
      const tabName = `${tabInfo.table}-${tabType}`;
      const existingTab = this.dataTabs.find(tab => tab.name === tabName);

      if (!existingTab) {
        const tabLabel = tabType === 'structure'
          ? `${tabInfo.table} (结构)`
          : `${tabInfo.table} (数据)`;
        
        this.dataTabs.push({
          name: tabName,
          label: tabLabel,
          type: tabType,
          database: tabInfo.database,
          table: tabInfo.table
        });
      }
      this.activeMainTab = tabName;
    },

    openNewTableTab(tabInfo) { // { database }
      const tabName = `new-table-${tabInfo.database}`;
      const existingTab = this.dataTabs.find(tab => tab.name === tabName);

      if (!existingTab) {
        const tabLabel = `新建表`;
        this.dataTabs.push({
          name: tabName,
          label: tabLabel,
          type: 'new_table',
          database: tabInfo.database,
          table: null
        });
      }
      this.activeMainTab = tabName;
    },

    closeDataTab(tabKey) {
      const index = this.dataTabs.findIndex(tab => tab.name === tabKey);
      if (index > -1) {
        this.dataTabs.splice(index, 1);
      }
      if (this.activeMainTab === tabKey) {
        this.activeMainTab = 'objects';
      }
    }
  }
})
