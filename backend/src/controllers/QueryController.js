// API控制器 - 查询管理
const connectionManager = require('../services/ConnectionManager');
const MySQLDialect = require('../services/MySQLDialect');

class QueryController {
    // 执行SQL查询
    static async executeQuery(req, res) {
        try {
            const { connectionId } = req.params;
            const { database, sql, params = [] } = req.body;

            if (!sql) {
                return res.status(400).json({
                    success: false,
                    error: 'SQL语句不能为空'
                });
            }

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            const result = await connection.query(sql, params, database);

            if (result.success) {
                res.json(result);
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

    // 获取表结构
    static async getTableStructure(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            const result = await connection.getTableStructure(database, table);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 获取表数据
    static async getTableData(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { limit = 100, offset = 0 } = req.query;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            // 同时获取数据和总数
            const [dataResult, countResult] = await Promise.all([
                connection.getTableData(database, table, limit, offset),
                connection.query(MySQLDialect.countData(database, table))
            ]);

            if (dataResult.success && countResult.success) {
                res.json({
                    success: true,
                    data: dataResult.data,
                    fields: dataResult.fields,
                    total: countResult.data[0].total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    executeTime: dataResult.executeTime // Pass executeTime to frontend
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: dataResult.error || countResult.error
                });
            }
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 插入数据
    static async insertData(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { data } = req.body;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            if (!data || typeof data !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: '数据格式不正确'
                });
            }

            const sql = MySQLDialect.insertData(database, table, data);
            const result = await connection.query(sql);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 更新数据
    static async updateData(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { data, where } = req.body;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            if (!data || !where) {
                return res.status(400).json({
                    success: false,
                    error: '数据和条件不能为空'
                });
            }

            const sql = MySQLDialect.updateData(database, table, data, where);
            const result = await connection.query(sql);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }

    // 删除数据
    static async deleteData(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { where } = req.body;
            const connection = connectionManager.getConnection(connectionId);

            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            if (!where) {
                return res.status(400).json({
                    success: false,
                    error: '删除条件不能为空'
                });
            }

            const sql = MySQLDialect.deleteData(database, table, where);
            const result = await connection.query(sql);
            res.json(result);
        } catch (err) {
            res.status(500).json({
                success: false,
                error: '服务器内部错误: ' + err.message
            });
        }
    }
}

module.exports = QueryController;