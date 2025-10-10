// Express应用主入口
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

const apiRoutes = require('./routes/api');
const connectionManager = require('./services/ConnectionManager');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize connection manager
connectionManager.initialize();

// 中间件配置
app.use(helmet());
app.use(compression());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API路由
app.use('/api', apiRoutes);

// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: '接口不存在'
    });
});

// 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('收到退出信号，正在关闭服务器...');
    try {
        await connectionManager.closeAllConnections();
        console.log('所有数据库连接已关闭');
        process.exit(0);
    } catch (error) {
        console.error('关闭连接时发生错误:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('收到终止信号，正在关闭服务器...');
    try {
        await connectionManager.closeAllConnections();
        console.log('所有数据库连接已关闭');
        process.exit(0);
    } catch (error) {
        console.error('关闭连接时发生错误:', error);
        process.exit(1);
    }
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`sqlluck后端服务已启动，端口: ${PORT}`);
    console.log(`健康检查: http://localhost:${PORT}/health`);
    console.log(`API文档: http://localhost:${PORT}/api`);
});

module.exports = app;