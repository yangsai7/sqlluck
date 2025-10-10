// MySQL查询工具类
const mysql = require('mysql2');

class MySQLDialect {
    static createDatabase(name) {
        return `CREATE DATABASE ${mysql.escapeId(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;
    }

    static dropDatabase(name) {
        return `DROP DATABASE ${mysql.escapeId(name)}`;
    }

    static showDatabases() {
        return 'SHOW DATABASES';
    }

    static showTables(database) {
        return `SHOW TABLES FROM ${mysql.escapeId(database)}`;
    }

    static describeTable(database, table) {
        return `DESCRIBE ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
    }

    static showCreateTable(database, table) {
        return `SHOW CREATE TABLE ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
    }

    static showIndexes(database, table) {
        return `SELECT
            column_name,
            index_name,
            non_unique,
            index_type
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema='${database}' AND table_name='${table}'
        ORDER BY index_name, seq_in_index`;
    }

    static createTable(database, tableName, columns) {
        const columnDefs = columns.map(col => {
            let def = `${mysql.escapeId(col.name)} ${col.type}`;
            if (!col.nullable) def += ' NOT NULL';
            if (col.defaultValue !== undefined) def += ` DEFAULT ${mysql.escape(col.defaultValue)}`;
            if (col.comment) def += ` COMMENT ${mysql.escape(col.comment)}`;
            return def;
        }).join(',\n    ');

        return `CREATE TABLE ${mysql.escapeId(database)}.${mysql.escapeId(tableName)} (
    ${columnDefs}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
    }

    static dropTable(database, table) {
        return `DROP TABLE ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
    }

    static addColumn(database, table, columnName, columnType, nullable = true, comment = '') {
        let sql = `ALTER TABLE ${mysql.escapeId(database)}.${mysql.escapeId(table)}
        ADD COLUMN ${mysql.escapeId(columnName)} ${columnType}`;

        if (!nullable) sql += ' NOT NULL';
        if (comment) sql += ` COMMENT ${mysql.escape(comment)}`;

        return sql;
    }

    static updateColumn(database, table, oldName, newName, columnType, nullable = true, comment = '') {
        let sql = `ALTER TABLE ${mysql.escapeId(database)}.${mysql.escapeId(table)}
        CHANGE ${mysql.escapeId(oldName)} ${mysql.escapeId(newName)} ${columnType}`;

        if (!nullable) sql += ' NOT NULL';
        if (comment) sql += ` COMMENT ${mysql.escape(comment)}`;

        return sql;
    }

    static dropColumn(database, table, columnName) {
        return `ALTER TABLE ${mysql.escapeId(database)}.${mysql.escapeId(table)}
        DROP COLUMN ${mysql.escapeId(columnName)}`;
    }

    static createIndex(database, table, indexName, columns, unique = false) {
        const indexType = unique ? 'UNIQUE INDEX' : 'INDEX';
        const columnList = columns.map(col => mysql.escapeId(col)).join(', ');

        return `CREATE ${indexType} ${mysql.escapeId(indexName)}
        ON ${mysql.escapeId(database)}.${mysql.escapeId(table)} (${columnList})`;
    }

    static dropIndex(database, table, indexName) {
        return `DROP INDEX ${mysql.escapeId(indexName)}
        ON ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
    }

    static selectData(database, table, limit = 100, offset = 0) {
        return `SELECT * FROM ${mysql.escapeId(database)}.${mysql.escapeId(table)}
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    }

    static countData(database, table) {
        return `SELECT COUNT(*) as total FROM ${mysql.escapeId(database)}.${mysql.escapeId(table)}`;
    }

    static insertData(database, table, data) {
        const columns = Object.keys(data).map(col => mysql.escapeId(col)).join(', ');
        const values = Object.values(data).map(val => mysql.escape(val)).join(', ');

        return `INSERT INTO ${mysql.escapeId(database)}.${mysql.escapeId(table)} (${columns}) VALUES (${values})`;
    }

    static updateData(database, table, data, where) {
        const sets = Object.keys(data).map(col =>
            `${mysql.escapeId(col)} = ${mysql.escape(data[col])}`
        ).join(', ');

        return `UPDATE ${mysql.escapeId(database)}.${mysql.escapeId(table)} SET ${sets} WHERE ${where}`;
    }

    static deleteData(database, table, where) {
        return `DELETE FROM ${mysql.escapeId(database)}.${mysql.escapeId(table)} WHERE ${where}`;
    }

    static showProcessList() {
        return 'SHOW PROCESSLIST';
    }

    static showStatus() {
        return 'SHOW GLOBAL STATUS';
    }

    static showVariables() {
        return 'SHOW GLOBAL VARIABLES';
    }

    static showEngines() {
        return 'SHOW ENGINES';
    }
}

module.exports = MySQLDialect;