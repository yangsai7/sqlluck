# sqlluck 应用安装指南

## 环境要求

- Node.js 16.x 或更高版本
- npm 或 yarn
- MySQL 服务器 (用于测试)

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd mysql-client-app
```

### 2. 一键构建和启动

```bash
# 构建并启动开发环境
./build.sh dev

# 或者手动步骤：
npm install
npm run dev
```

### 3. 生产环境打包

```bash
# 构建生产版本
./build.sh

# 手动构建
npm run build
```

## 项目结构

```
mysql-client-app/
├── backend/              # Node.js后端服务
│   ├── src/
│   │   ├── controllers/  # API控制器
│   │   ├── services/     # 业务逻辑服务
│   │   ├── routes/       # 路由配置
│   │   └── app.js        # 应用入口
│   └── package.json
├── frontend/             # Vue.js前端
│   ├── src/
│   │   ├── components/   # Vue组件
│   │   ├── views/        # 页面视图
│   │   ├── stores/       # 状态管理
│   │   ├── api/          # API调用
│   │   └── utils/        # 工具函数
│   └── package.json
├── electron/             # Electron主进程
│   ├── src/
│   │   ├── main.js       # 主进程
│   │   └── preload.js    # 预加载脚本
│   └── package.json
└── package.json          # 根配置文件
```

## 功能特性

### ✅ 已完成功能

- 🔗 **MySQL 数据库连接管理**

  - 支持 SSL 连接
  - 连接池管理
  - 连接状态监控

- 🗂️ **数据库浏览**

  - 数据库列表
  - 表结构查看
  - 数据浏览和编辑

- 📝 **SQL 查询编辑器**

  - 语法高亮
  - 自动补全
  - 查询历史
  - 结果展示

- 📊 **数据管理**

  - 表数据增删改查
  - 分页浏览
  - 数据导出

- 📁 **导入导出**

  - CSV 数据导入导出
  - SQL 结构导出
  - SQL 文件执行

- 🖥️ **桌面应用**
  - 跨平台支持
  - 独立运行
  - 系统集成

## 开发模式

### 启动开发服务器

```bash
# 方式1：使用构建脚本
./build.sh dev

# 方式2：分别启动各个服务
npm run dev:backend   # 启动后端 (端口3001)
npm run dev:frontend  # 启动前端 (端口3000)
npm run dev:electron  # 启动Electron
```

### 开发工具

- **后端调试**: http://localhost:3001/health
- **前端开发**: http://localhost:3000
- **API 文档**: http://localhost:3001/api

## 生产环境部署

### 构建应用

```bash
npm run build
```

### 发布打包

```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux
```

## 配置说明

### 环境变量

后端支持以下环境变量配置：

```bash
# backend/.env
NODE_ENV=development
PORT=3001
LOG_LEVEL=info
```

### 连接配置

在应用中可以配置多个 MySQL 连接：

- 主机地址和端口
- 用户名和密码
- SSL 证书配置
- 连接超时设置
- 时区配置

## 故障排除

### 常见问题

1. **端口占用**

   ```bash
   # 检查端口占用
   lsof -i :3000
   lsof -i :3001
   ```

2. **MySQL 连接失败**

   - 检查 MySQL 服务状态
   - 验证用户名密码
   - 确认网络连通性

3. **依赖安装失败**
   ```bash
   # 清理缓存重新安装
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

### 日志查看

- 后端日志：控制台输出
- 前端日志：浏览器开发者工具
- Electron 日志：应用控制台

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 提交 Pull Request

## 许可证

MIT License

## 联系方式

如有问题请提交 Issue 或联系开发团队。
