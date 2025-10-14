// MySQL连接服务类
const mysql = require('mysql2/promise');
const fs = require('fs');

class MySQLConnection {
    constructor(config) {
        this.config = {
            host: config.host,
            port: config.port || 3306,
            user: config.user,
            password: config.password,
            database: config.database,
            timezone: config.timezone || '+00:00',
            multipleStatements: true,
            dateStrings: true,
            supportBigNumbers: true,
            bigNumberStrings: true,
            connectTimeout: config.connectTimeout || 5000,
        };

        if (config.useSSL) {
            this.config.ssl = {
                rejectUnauthorized: false,
                ca: config.caPath ? fs.readFileSync(config.caPath) : null,
                cert: config.clientCertPath ? fs.readFileSync(config.clientCertPath) : null,
                key: config.clientKeyPath ? fs.readFileSync(config.clientKeyPath) : null,
                minVersion: 'TLSv1'
            };
        }

        this.connection = null;
        this.pool = null;
    }

    async connect() {
        try {
            // 创建连接池
            this.pool = mysql.createPool({
                ...this.config,
                connectionLimit: 10,
                queueLimit: 0,
            });

            // 测试连接
            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async query(sql, params = [], database = null) {
        const startTime = performance.now();
        let connection;
        try {
            if (!this.pool) {
                throw new Error('数据库未连接');
            }

            connection = await this.pool.getConnection();

            if (database) {
                await connection.changeUser({ database });
            }

            const [rows, fields] = await connection.execute(sql, params);
            const endTime = performance.now();
            const executeTime = `${(endTime - startTime).toFixed(2)} ms`;

            return {
                success: true,
                data: rows,
                fields: fields,
                affectedRows: rows.affectedRows || 0,
                executeTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                code: error.code
            };
        } finally {
            if (connection) {
                connection.release();
            }
        }
    }

    async testConnection() {
        try {
            if (!this.pool) {
                return { success: false, error: '数据库未连接' };
            }

            const connection = await this.pool.getConnection();
            await connection.ping();
            connection.release();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDatabases() {
        const result = await this.query('SHOW DATABASES');
        if (result.success) {
            return {
                success: true,
                databases: result.data.map(row => row.Database)
            };
        }
        return result;
    }

    async getTables(database) {
        const sql = `SHOW TABLE STATUS FROM \`${database}\``;
        const result = await this.query(sql);
        if (result.success) {
            return {
                success: true,
                tables: result.data.map(row => ({
                    name: row.Name,
                    rows: row.Rows,
                    dataLength: row.Data_length,
                    engine: row.Engine,
                    updateTime: row.Update_time,
                    comment: row.Comment
                }))
            };
        }
        return result;
    }

    async getTableStructure(database, table) {
        const sql = `DESCRIBE ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
        return await this.query(sql);
    }

    async getTableData(database, table, limit = 100, offset = 0) {
        const sql = `SELECT * FROM ${mysql.escapeId(database)}.${mysql.escapeId(table)} LIMIT ${limit} OFFSET ${offset}`;
        return await this.query(sql);
    }

    async getViews(database) {
        const sql = `SHOW FULL TABLES IN ${mysql.escapeId(database)} WHERE TABLE_TYPE LIKE 'VIEW'`;
        const result = await this.query(sql);
        if (result.success) {
            const viewKey = `Tables_in_${database}`;
            return {
                success: true,
                views: result.data.map(row => row[viewKey])
            };
        }
        return result;
    }

    async getFunctions(database) {
        const sql = `SHOW FUNCTION STATUS WHERE Db = ?`;
        const result = await this.query(sql, [database]);
        if (result.success) {
            return {
                success: true,
                functions: result.data.map(row => row.Name)
            };
        }
        return result;
    }

    async getProcedures(database) {
        const sql = `SHOW PROCEDURE STATUS WHERE Db = ?`;
        const result = await this.query(sql, [database]);
        if (result.success) {
            return {
                success: true,
                procedures: result.data.map(row => row.Name)
            };
        }
        return result;
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}

module.exports = MySQLConnection;