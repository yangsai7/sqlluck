const connectionManager = require('../services/ConnectionManager');
const Joi = require('joi');

// 连接配置验证模式
const connectionSchema = Joi.object({
    name: Joi.string().allow('').optional(),
    id: Joi.string().allow('').optional(),
    host: Joi.string().required().messages({
        'string.empty': '主机地址不能为空',
        'any.required': '主机地址是必填项'
    }),
    port: Joi.number().integer().min(1).max(65535).default(3306),
    user: Joi.string().required().messages({
        'string.empty': '用户名不能为空',
        'any.required': '用户名是必填项'
    }),
    password: Joi.string().allow('').default(''),
    database: Joi.string().allow('').default(''),
    useSSL: Joi.boolean().default(false),
    caPath: Joi.string().allow(''),
    clientCertPath: Joi.string().allow(''),
    clientKeyPath: Joi.string().allow(''),
    connectTimeout: Joi.number().integer().min(1000).default(5000),
    timezone: Joi.string().default('+00:00')
}).options({ allowUnknown: true }); // 允许未知字段，提高兼容性

class ConnectionController {
    // 测试连接
    static async testConnection(req, res) {
        try {
            const { error, value } = connectionSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: error.details[0].message
                });
            }

            const result = await connectionManager.testConnection(value);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 创建连接
    static async createConnection(req, res) {
        try {
            const { error, value } = connectionSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: error.details[0].message
                });
            }

            const result = await connectionManager.createConnection(value);

            if (result.success) {
                res.json({
                    success: true,
                    connectionId: result.connectionId,
                    message: result.message
                });
            } else {
                res.status(400).json(result);
            }
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    static async updateConnection(req, res) {
        try {
            const { connectionId } = req.params;
            const { error, value } = connectionSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: error.details[0].message
                });
            }

            const result = await connectionManager.updateConnection(connectionId, value);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    static async connect(req, res) {
        try {
            const { connectionId } = req.params;
            const result = await connectionManager.connect(connectionId);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 获取所有连接
    static async getConnections(req, res) {
        try {
            const connections = await connectionManager.getAllConnections();
            res.json({
                success: true,
                connections
            });
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 关闭连接
    static async closeConnection(req, res) {
        try {
            const { connectionId } = req.params;
            const result = await connectionManager.closeConnection(connectionId);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 获取数据库列表
    static async getDatabases(req, res) {
        try {
            const { connectionId } = req.params;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            const result = await connection.getDatabases();
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 获取表列表
    static async getTables(req, res) {
        try {
            const { connectionId, database } = req.params;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            const result = await connection.getTables(database);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 获取视图列表
    static async getViews(req, res) {
        try {
            const { connectionId, database } = req.params;
            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }
            const result = await connection.getViews(database);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, error: '服务器内部错误: ' + err.message });
        }
    }

    // 获取函数列表
    static async getFunctions(req, res) {
        try {
            const { connectionId, database } = req.params;
            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }
            const result = await connection.getFunctions(database);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, error: '服务器内部错误: ' + err.message });
        }
    }

    // 获取存储过程列表
    static async getProcedures(req, res) {
        try {
            const { connectionId, database } = req.params;
            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }
            const result = await connection.getProcedures(database);
            res.json(result);
        } catch (err) {
            res.status(500).json({ success: false, error: '服务器内部错误: ' + err.message });
        }
    }
}

module.exports = ConnectionController;