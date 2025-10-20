// 数据导入导出API控制器
const connectionManager = require('../services/ConnectionManager');
const fs = require('fs').promises;
const path = require('path');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const mysqldump = require('mysqldump');

class ImportExportController {
    // 导出数据为CSV
    static async exportToCSV(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { limit = 10000, includeData } = req.query;

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }

            // Get headers by fetching one row
            const headerSql = `SELECT * FROM \`${database}\`.\`${table}\` LIMIT 1`;
            const headerResult = await connection.query(headerSql);

            if (!headerResult.success || headerResult.data.length === 0) {
                return res.json({ success: false, error: '无法获取表结构' });
            }

            const headers = Object.keys(headerResult.data[0]).map(key => ({ id: key, title: key }));

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${table}_${timestamp}.csv`;
            const filepath = path.join(__dirname, '../../temp', filename);
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            const csvWriter = createCsvWriter({
                path: filepath,
                header: headers,
                encoding: 'utf8'
            });

            let records = [];
            let recordCount = 0;

            if (includeData !== 'false') {
                const dataSql = `SELECT * FROM \`${database}\`.\`${table}\` LIMIT ${parseInt(limit)}`;
                const dataResult = await connection.query(dataSql);
                if (dataResult.success && dataResult.data.length > 0) {
                    records = dataResult.data;
                    recordCount = dataResult.data.length;
                }
            }

            await csvWriter.writeRecords(records); // writeRecords can handle an empty array

            res.json({
                success: true,
                message: '导出成功',
                filename,
                recordCount
            });

        } catch (error) {
            res.status(500).json({ success: false, error: '导出失败: ' + error.message });
        }
    }

    static async exportToSQL(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { includeData } = req.query;

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }

            let content = '';
            let recordCount = 0;

            // 1. Get CREATE TABLE statement
            const ddlResult = await connection.query(`SHOW CREATE TABLE \`${database}\`.\`${table}\``);
            if (ddlResult.success && ddlResult.data.length > 0) {
                content += ddlResult.data[0]['Create Table'] + ';\n\n';
            }

            // 2. Get data and generate INSERT statements if includeData is not false
            if (includeData !== 'false') {
                const dataResult = await connection.query(`SELECT * FROM \`${database}\`.\`${table}\``);
                if (dataResult.success && dataResult.data.length > 0) {
                    recordCount = dataResult.data.length;
                    const columns = Object.keys(dataResult.data[0]);
                    const insertTpl = `INSERT INTO \`${table}\` (\`${columns.join('\`, \`')}\`) VALUES\n`;
                    content += insertTpl;
                    const values = dataResult.data.map(row =>
                        '(' + columns.map(col =>
                            row[col] === null ? 'NULL' : `'${String(row[col]).replace(/'/g, "''")}'`
                        ).join(', ') + ')'
                    ).join(',\n');
                    content += values + ';\n';
                }
            }

            if (!content.trim()) {
                return res.json({ success: false, error: '没有内容可导出' });
            }

            // 3. Write to temp file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${table}_${timestamp}.sql`;
            const filepath = path.join(__dirname, '../../temp', filename);
            await fs.mkdir(path.dirname(filepath), { recursive: true });
            await fs.writeFile(filepath, content, 'utf8');

            // 4. Return filename
            res.json({
                success: true,
                message: '导出成功',
                filename,
                recordCount
            });

        } catch (error) {
            res.status(500).json({ success: false, error: '导出失败: ' + error.message });
        }
    }


    // 导出数据库结构
    static async exportStructure(req, res) {
        try {
            const { connectionId, database } = req.params;
            const { includeData } = req.query;

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({ success: false, error: '连接不存在' });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `${database}_${timestamp}.sql`;
            const filepath = path.join(__dirname, '../../temp', filename);
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            const config = connection.config;
            const dumpOptions = {
                connection: {
                    host: config.host,
                    user: config.user,
                    password: config.password,
                    database: database,
                    port: config.port || 3306
                },
                dumpToFile: filepath,
                compressFile: false,
                dump: {
                    schema: {
                        table: { ifNotExist: true, dropIfExist: false, charset: true }
                    },
                    data: includeData === 'true' ? {} : false,
                    trigger: { delimiter: ';;', dropIfExist: true, definer: false }
                }
            };

            await mysqldump(dumpOptions);

            res.json({
                success: true,
                message: '导出成功',
                filename
            });

        } catch (error) {
            res.status(500).json({ success: false, error: '导出结构失败: ' + error.message });
        }
    }

    // 导入CSV数据
    static async importFromCSV(req, res) {
        try {
            const { connectionId, database, table } = req.params;
            const { filepath, hasHeader = true } = req.body;

            if (!filepath || !await fs.access(filepath).then(() => true).catch(() => false)) {
                return res.status(400).json({
                    success: false,
                    error: '文件不存在'
                });
            }

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            // 解析CSV文件
            const records = [];
            const stream = fs.createReadStream(filepath)
                .pipe(csvParser({
                    headers: hasHeader,
                    skipEmptyLines: true
                }));

            for await (const record of stream) {
                records.push(record);
            }

            if (records.length === 0) {
                return res.json({
                    success: false,
                    error: '文件中没有数据'
                });
            }

            // 批量插入数据
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            for (let i = 0; i < records.length; i += 100) { // 每批100条
                const batch = records.slice(i, i + 100);

                try {
                    for (const record of batch) {
                        const columns = Object.keys(record).map(col => `\`${col}\``).join(', ');
                        const values = Object.values(record).map(val =>
                            val === null || val === '' ? 'NULL' : `'${val.toString().replace(/'/g, "\\'")}'`
                        ).join(', ');

                        const sql = `INSERT INTO \`${database}\`.\`${table}\` (${columns}) VALUES (${values})`;
                        await connection.query(sql);
                        successCount++;
                    }
                } catch (error) {
                    errorCount += batch.length;
                    errors.push({
                        batch: i / 100 + 1,
                        error: error.message
                    });
                }
            }

            // 清理临时文件
            try {
                await fs.unlink(filepath);
            } catch (e) {
                console.error('清理临时文件失败:', e);
            }

            res.json({
                success: true,
                message: `导入完成，成功${successCount}条，失败${errorCount}条`,
                successCount,
                errorCount,
                errors: errors.slice(0, 10) // 只返回前10个错误
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: '导入失败: ' + error.message
            });
        }
    }

    // 执行SQL文件
    static async executeSQLFile(req, res) {
        try {
            const { connectionId } = req.params;
            const { filepath } = req.body;

            if (!filepath || !await fs.access(filepath).then(() => true).catch(() => false)) {
                return res.status(400).json({
                    success: false,
                    error: '文件不存在'
                });
            }

            const connection = connectionManager.getConnection(connectionId);
            if (!connection) {
                return res.status(404).json({
                    success: false,
                    error: '连接不存在'
                });
            }

            // 读取SQL文件
            const sqlContent = await fs.readFile(filepath, 'utf8');

            // 分割SQL语句（简单分割，按分号分割）
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            // 执行每个语句
            for (let i = 0; i < statements.length; i++) {
                try {
                    await connection.query(statements[i]);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    errors.push({
                        statement: i + 1,
                        sql: statements[i].substring(0, 100) + '...',
                        error: error.message
                    });
                }
            }

            // 清理临时文件
            try {
                await fs.unlink(filepath);
            } catch (e) {
                console.error('清理临时文件失败:', e);
            }

            res.json({
                success: true,
                message: `执行完成，成功${successCount}条语句，失败${errorCount}条语句`,
                successCount,
                errorCount,
                errors: errors.slice(0, 10)
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: '执行SQL文件失败: ' + error.message
            });
        }
    }

    // 上传文件
    static async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: '没有上传文件'
                });
            }

            res.json({
                success: true,
                message: '文件上传成功',
                filename: req.file.filename,
                filepath: req.file.path,
                originalName: req.file.originalname,
                size: req.file.size
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: '文件上传失败: ' + error.message
            });
        }
    }

    // 下载文件
    static async downloadFile(req, res) {
        try {
            const { filename } = req.params;
            const filepath = path.join(__dirname, '../../temp', filename);

            // 检查文件是否存在
            try {
                await fs.access(filepath);
            } catch (error) {
                return res.status(404).json({
                    success: false,
                    error: '文件不存在'
                });
            }

            // 发送文件
            res.download(filepath, filename, (err) => {
                if (err) {
                    console.error('文件下载失败:', err);
                } else {
                    // 下载成功后删除临时文件
                    fs.unlink(filepath).catch(console.error);
                }
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: '文件下载失败: ' + error.message
            });
        }
    }
}

module.exports = ImportExportController;