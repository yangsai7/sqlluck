// Electron预加载脚本
const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getAppInfo: () => ipcRenderer.invoke('app-info'),

  // 文件对话框
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // 文件操作
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // 菜单事件监听
  onMenuNewConnection: (callback) => {
    ipcRenderer.on('menu-new-connection', callback)
  },

  onMenuImportSQL: (callback) => {
    ipcRenderer.on('menu-import-sql', (event, sqlContent) => {
      callback(sqlContent)
    })
  },

  // 移除监听器
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // 平台信息
  platform: process.platform,
  isElectron: true
})

// 防止在渲染进程中直接访问Node.js API
delete window.module
delete window.exports
delete window.require

console.log('Preload script loaded')