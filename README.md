🧠 MySQL Client App

一个现代化、跨平台的 MySQL 数据库客户端管理工具，基于 Electron + Vue + TypeScript 构建。
集成了 AI 智能 SQL 助手，让数据库操作更加高效、智能。
（项目仍在积极开发中 🚀，持续优化中！）

✨ 主要特性

🔗 连接管理：支持多数据库连接配置与切换

🗂️ 结构浏览：可视化浏览数据库、表结构与字段信息

📝 SQL 编辑器：语法高亮、自动补全、执行结果实时展示

🧠 AI SQL 助手：

智能生成 SQL 查询语句

自然语言转 SQL（输入中文问题即可生成查询）

查询结果自动分析与总结

📊 结果展示：支持分页、排序、筛选与数据编辑

📤 数据导入导出：CSV / SQL 多格式支持

🖥️ 跨平台支持：Windows / macOS / Linux 一键运行

🧩 技术栈
模块 技术
前端 Vue 3 + Element Plus + TypeScript
后端 Node.js + Express + MySQL2
AI 支持 OpenAI API / 自建大模型接口
桌面端 Electron
构建工具 Vite
⚙️ 开发环境启动

# 安装依赖

npm install

# 启动测试环境

```
./build.sh dev
```

# 构建与打包

```
./build.sh
```

📁 项目结构

```
mysql-client-app/
├── backend/ # Node.js 后端服务（AI Query、SQL 执行接口）
├── frontend/ # Vue.js 前端界面
├── electron/ # Electron 主进程
├── docs/ # 文档与截图
└── package.json # 项目配置
```

🧠 AI Query 功能示例
| 功能 | 示例 |
| -------- | ------------------------------- |
| 自然语言查询 | “查询过去 7 天注册用户数量” → 自动生成 SQL 并执行 |
| SQL 优化建议 | 分析慢查询并给出索引优化建议 |
| 查询总结 | 自动生成查询结果的业务摘要（如销售趋势、统计对比） |
