const MySQLConnection = require('./MySQLConnection');
const storageService = require('./StorageService');

class ConnectionManager {
    constructor() {
        this.connections = new Map(); // 存储活跃连接
        this.connectionConfigs = new Map(); // 存储连接配置
    }

    initialize() {
        const savedConnections = storageService.getConnections();
        savedConnections.forEach(config => {
            this.connectionConfigs.set(config.id, config);
        });
    }

    // 创建新连接
    async createConnection(config) {
        try {
            const newConnection = storageService.addConnection(config);
            const connection = new MySQLConnection(newConnection);
            const result = await connection.connect();

            if (result.success) {
                this.connections.set(newConnection.id, connection);
                this.connectionConfigs.set(newConnection.id, { ...newConnection, password: '***' }); // 不存储密码明文
                return { success: true, message: '连接成功', connectionId: newConnection.id };
            } else {
                storageService.removeConnection(newConnection.id);
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    updateConnection(connectionId, config) {
        try {
            const updatedConnection = storageService.updateConnection(connectionId, config);
            if (updatedConnection) {
                this.connectionConfigs.set(connectionId, { ...updatedConnection, password: '***' });

                // If the connection is active, close it to force a reconnect with new settings
                if (this.connections.has(connectionId)) {
                    const oldConnection = this.connections.get(connectionId);
                    oldConnection.close(); // This can be async, but we don't need to wait
                    this.connections.delete(connectionId);
                }

                return { success: true, connection: updatedConnection };
            } else {
                return { success: false, error: '连接不存在' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async connect(connectionId) {
        if (this.connections.has(connectionId)) {
            return { success: true, message: '连接已存在' };
        }
        const config = this.connectionConfigs.get(connectionId);
        if (!config) {
            return { success: false, error: '连接配置不存在' };
        }

        try {
            const connection = new MySQLConnection(config);
            const result = await connection.connect();

            if (result.success) {
                this.connections.set(connectionId, connection);
                return { success: true, message: '连接成功' };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取连接
    getConnection(id) {
        return this.connections.get(id);
    }

    // 测试连接
    async testConnection(config) {
        try {
            const connection = new MySQLConnection(config);
            const result = await connection.connect();
            await connection.close();
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 关闭连接
    async closeConnection(id) {
        const connection = this.connections.get(id);
        if (connection) {
            await connection.close();
            this.connections.delete(id);
        }
        storageService.removeConnection(id);
        this.connectionConfigs.delete(id);
        return { success: true };
    }

    // 获取所有连接配置
    getAllConnections() {
        const configs = [];
        this.connectionConfigs.forEach((config, id) => {
            configs.push({ id, ...config });
        });
        return configs;
    }

    // 关闭所有连接
    async closeAllConnections() {
        const promises = [];
        this.connections.forEach(async (connection, id) => {
            promises.push(connection.close());
        });

        await Promise.all(promises);
        this.connections.clear();
        this.connectionConfigs.clear();
    }
}

// 单例模式
const connectionManager = new ConnectionManager();

module.exports = connectionManager;