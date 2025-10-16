// Electron主进程
const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// 开发环境检测
const isDevelopment = process.env.NODE_ENV === 'development'


// 全局引用主窗口
let mainWindow
let backendProcess

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: !isDevelopment,
      devTools: true,
    },
    icon: path.join(__dirname, '../assets/logo.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // 初始隐藏，加载完成后显示
    backgroundColor: '#f0f2f5'
  })

  // 窗口准备显示时再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()

    if (isDevelopment) {
      mainWindow.webContents.openDevTools()
    }
  })

  // 加载应用
  if (isDevelopment) {
    // 开发环境：等待前端服务器启动
    const startURL = 'http://localhost:3000'

    const loadApp = () => {
      mainWindow.loadURL(startURL).catch(() => {
        // 如果加载失败，1秒后重试
        setTimeout(loadApp, 1000)
      })
    }

    // 延迟加载，等待前端服务器启动
    setTimeout(loadApp, 2000)
  } else {
    // 生产环境：加载打包后的静态文件
    const indexPath = path.join(__dirname, '../../frontend/index.html')
    console.log("index path:",__dirname, indexPath)
    mainWindow.loadFile(indexPath)
  }

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 外部链接用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // 阻止导航到外部URL
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost:3000') && !url.startsWith('file://')) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })
}

// 启动后端服务
function startBackendService() {
  if (isDevelopment) {
    console.log('开发环境：后端服务由npm脚本启动')
    return
  }

  const userDataPath = app.getPath('userData');
  const backendPath = path.join(__dirname, '../../server.exe')

  if (fs.existsSync(backendPath)) {
    const args = [`--appdata=${userDataPath}`];
    backendProcess = spawn(backendPath, args, {
      //stdio: ['inherit'], // pipe stdout and stderr
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        PORT: '3001',
      }
    })

    backendProcess.stdout.on('data', (data) => {
      console.log(`后端输出: ${data}`)
    })

    backendProcess.stderr.on('data', (data) => {
      console.error(`后端错误: ${data}`)
    })

    backendProcess.on('close', (code) => {
      console.log(`后端进程退出，代码: ${code}`)
    })

    console.log('后端服务已启动')
  } else {
    console.error('未找到后端服务文件')
  }
}

// 停止后端服务
function stopBackendService() {
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
    backendProcess = null
    console.log('后端服务已停止')
  }
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建连接',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-connection')
          }
        },
        { type: 'separator' },
        {
          label: '导入SQL文件',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'SQL文件', extensions: ['sql'] },
                { name: '所有文件', extensions: ['*'] }
              ]
            })

            if (!result.canceled && result.filePaths.length > 0) {
              try {
                const sqlContent = fs.readFileSync(result.filePaths[0], 'utf-8')
                mainWindow.webContents.send('menu-import-sql', sqlContent)
              } catch (error) {
                dialog.showErrorBox('导入失败', error.message)
              }
            }
          }
        },
        { type: 'separator' },
        {
          role: 'quit',
          label: '退出'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectall', label: '全选' }
      ]
    },
    {
      label: '查看',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于sqlluck',
              message: 'sqlluck v1.0.0',
              detail: '基于Electron + Vue.js + Node.js构建的MySQL数据库管理工具'
            })
          }
        },
        {
          label: '检查更新',
          click: () => {
            // 这里可以添加更新检查逻辑
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '检查更新',
              message: '当前版本已是最新版本'
            })
          }
        }
      ]
    }
  ]

  // macOS菜单调整
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: '关于' },
        { type: 'separator' },
        { role: 'services', label: '服务', submenu: [] },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    })

    // 窗口菜单
    template[4].submenu = [
      { role: 'close', label: '关闭' },
      { role: 'minimize', label: '最小化' },
      { role: 'zoom', label: '缩放' },
      { type: 'separator' },
      { role: 'front', label: '前置所有窗口' }
    ]
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// 应用事件处理
app.whenReady().then(() => {
  // 启动后端服务
  startBackendService()

  // 创建窗口和菜单
  createWindow()
  createMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // macOS下通常保持应用运行
  if (process.platform !== 'darwin') {
    stopBackendService()
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackendService()
})

// IPC事件处理
ipcMain.handle('app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform
  }
})

// 文件对话框
ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

// 文件操作
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 窗口控制
ipcMain.handle('minimize-window', () => {
  mainWindow.minimize()
})

ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.handle('close-window', () => {
  mainWindow.close()
})

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
  dialog.showErrorBox('应用错误', error.message)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason)
})