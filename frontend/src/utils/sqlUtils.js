// SQL语法高亮和自动补全工具
export const SQL_KEYWORDS = [
  // 基础关键字
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TRUNCATE',
  'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'DISTINCT', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',

  // 数据类型
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
  'DECIMAL', 'FLOAT', 'DOUBLE', 'REAL',
  'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'YEAR',
  'BOOLEAN', 'BOOL', 'BINARY', 'VARBINARY', 'BLOB',
  'JSON', 'ENUM', 'SET',

  // 约束和属性
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'INDEX',
  'NOT', 'NULL', 'DEFAULT', 'AUTO_INCREMENT', 'UNSIGNED',
  'COMMENT', 'COLLATE', 'CHARACTER', 'CHARSET',

  // 函数
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'SUBSTRING',
  'UPPER', 'LOWER', 'TRIM', 'LENGTH', 'NOW', 'CURDATE', 'CURTIME',
  'DATE_FORMAT', 'COALESCE', 'IFNULL', 'IF', 'FLOOR', 'CEIL', 'ROUND',

  // 其他
  'DATABASE', 'TABLE', 'COLUMN', 'VIEW', 'PROCEDURE', 'FUNCTION',
  'TRIGGER', 'ENGINE', 'CHARSET', 'COLLATION', 'TEMPORARY',
  'IF', 'NOT', 'EXISTS', 'REPLACE', 'VALUES', 'SET'
]

export const SQL_OPERATORS = [
  '!=', '<>', '<=', '>=',
  '=', '<', '>', '+', '-', '*', '/', '%',
  '(', ')', ',', ';', '.'
]

// SQL语法高亮器
export class SQLHighlighter {
  static highlight(sql) {
    if (!sql) return '';

    const placeholders = [];
    let placeholderId = 0;

    // Use a temporary, safe placeholder that won't be in the SQL
    const placeholderPrefix = '___SQL_HL_PLACEHOLDER_';
    const placeholderSuffix = '___';

    // 1. Replace strings and comments with placeholders
    let processedSql = sql
      .replace(/'[^']*'/g, (match) => {
        const placeholder = `${placeholderPrefix}${placeholderId++}${placeholderSuffix}`;
        placeholders.push(`<span class='sql-string'>${match}</span>`);
        return placeholder;
      })
      .replace(/"[^"]*"/g, (match) => {
        const placeholder = `${placeholderPrefix}${placeholderId++}${placeholderSuffix}`;
        placeholders.push(`<span class='sql-string'>${match}</span>`);
        return placeholder;
      })
      .replace(/--.*$/gm, (match) => {
        const placeholder = `${placeholderPrefix}${placeholderId++}${placeholderSuffix}`;
        placeholders.push(`<span class='sql-comment'>${match}</span>`);
        return placeholder;
      })
      .replace(/\/\*[\s\S]*?\*\//g, (match) => {
        const placeholder = `${placeholderPrefix}${placeholderId++}${placeholderSuffix}`;
        placeholders.push(`<span class='sql-comment'>${match}</span>`);
        return placeholder;
      });

    // 2. Highlight keywords, numbers, operators on the rest
    const allKeywordsRegex = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi');
    processedSql = processedSql.replace(allKeywordsRegex, (match) => 
        `<span class='sql-keyword'>${match.toUpperCase()}</span>`
    );

    processedSql = processedSql.replace(/\b\d+\.?\d*\b/g, `<span class='sql-number'>$&</span>`);

    const allOperatorsRegex = new RegExp(`(${SQL_OPERATORS.map(op => op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    processedSql = processedSql.replace(allOperatorsRegex, `<span class='sql-operator'>$1</span>`);

    // 3. Restore strings and comments
    for (let i = 0; i < placeholders.length; i++) {
      processedSql = processedSql.replace(`${placeholderPrefix}${i}${placeholderSuffix}`, placeholders[i]);
    }

    return processedSql;
  }
}

// SQL自动补全
export class SQLAutoComplete {
  constructor(connectionStore) {
    this.connectionStore = connectionStore
  }

  getSuggestions(text, cursorPosition) {
    const beforeCursor = text.substring(0, cursorPosition).toLowerCase()
    const words = beforeCursor.split(/\s+/)
    const lastWord = words[words.length - 1] || ''

    const suggestions = []

    // 关键字补全
    SQL_KEYWORDS.forEach(keyword => {
      if (keyword.toLowerCase().startsWith(lastWord.toLowerCase())) {
        suggestions.push({
          type: 'keyword',
          value: keyword,
          display: keyword,
          description: 'SQL关键字'
        })
      }
    })

    // 数据库名补全
    if (this.connectionStore.databases) {
      this.connectionStore.databases.forEach(db => {
        if (db.toLowerCase().startsWith(lastWord.toLowerCase())) {
          suggestions.push({
            type: 'database',
            value: db,
            display: db,
            description: '数据库'
          })
        }
      })
    }

    // 表名补全
    if (this.connectionStore.tables) {
      this.connectionStore.tables.forEach(table => {
        if (table.toLowerCase().startsWith(lastWord.toLowerCase())) {
          suggestions.push({
            type: 'table',
            value: table,
            display: table,
            description: '表名'
          })
        }
      })
    }

    // 常用SQL模板
    const templates = this.getTemplates()
    templates.forEach(template => {
      if (template.name.toLowerCase().includes(lastWord.toLowerCase())) {
        suggestions.push({
          type: 'template',
          value: template.sql,
          display: template.name,
          description: template.description
        })
      }
    })

    // 按类型和匹配度排序
    return suggestions
      .sort((a, b) => {
        if (a.type !== b.type) {
          const typeOrder = { keyword: 0, table: 1, database: 2, template: 3 }
          return typeOrder[a.type] - typeOrder[b.type]
        }
        return a.display.localeCompare(b.display)
      })
      .slice(0, 20) // 限制显示数量
  }

  getTemplates() {
    const currentDB = this.connectionStore.activeDatabaseName
    const dbPrefix = currentDB ? `\`${currentDB}\`.` : ''

    return [
      {
        name: 'SELECT查询',
        description: '基础查询语句',
        sql: `SELECT * FROM ${dbPrefix}\`table_name\` WHERE condition LIMIT 10;`
      },
      {
        name: 'INSERT插入',
        description: '插入数据语句',
        sql: `INSERT INTO ${dbPrefix}\`table_name\` (column1, column2) VALUES (value1, value2);`
      },
      {
        name: 'UPDATE更新',
        description: '更新数据语句',
        sql: `UPDATE ${dbPrefix}\`table_name\` SET column1 = value1 WHERE condition;`
      },
      {
        name: 'DELETE删除',
        description: '删除数据语句',
        sql: `DELETE FROM ${dbPrefix}\`table_name\` WHERE condition;`
      },
      {
        name: 'CREATE TABLE',
        description: '创建表语句',
        sql: `CREATE TABLE ${dbPrefix}\`table_name\` (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`
      },
      {
        name: 'ALTER TABLE',
        description: '修改表结构',
        sql: `ALTER TABLE ${dbPrefix}\`table_name\` ADD COLUMN column_name data_type;`
      },
      {
        name: 'CREATE INDEX',
        description: '创建索引',
        sql: `CREATE INDEX idx_name ON ${dbPrefix}\`table_name\` (column_name);`
      },
      {
        name: 'JOIN查询',
        description: '联表查询',
        sql: `SELECT a.*, b.*
FROM ${dbPrefix}\`table_a\` a
LEFT JOIN ${dbPrefix}\`table_b\` b ON a.id = b.a_id
WHERE condition;`
      },
      {
        name: '统计查询',
        description: '聚合统计',
        sql: `SELECT
  COUNT(*) as total,
  AVG(column_name) as average,
  MAX(column_name) as maximum
FROM ${dbPrefix}\`table_name\`
GROUP BY group_column;`
      },
      {
        name: '分页查询',
        description: '带分页的查询',
        sql: `SELECT * FROM ${dbPrefix}\`table_name\`
WHERE condition
ORDER BY id DESC
LIMIT 10 OFFSET 0;`
      }
    ]
  }
}

// SQL格式化器
export class SQLFormatter {
  static format(sql) {
    if (!sql) return ''

    let formatted = sql
      // 统一换行符
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 移除多余空白
      .replace(/\s+/g, ' ')
      .trim()

    // 在主要关键字前后添加换行
    const majorKeywords = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING',
      'ORDER BY', 'LIMIT', 'UNION', 'INSERT', 'UPDATE',
      'DELETE', 'CREATE', 'ALTER', 'DROP'
    ]

    majorKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      formatted = formatted.replace(regex, `\n${keyword.toUpperCase()}`)
    })

    // JOIN关键字处理
    const joinKeywords = ['JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN']
    joinKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      formatted = formatted.replace(regex, `\n${keyword.toUpperCase()}`)
    })

    // 逗号后换行（在SELECT和字段列表中）
    formatted = formatted.replace(/,(\s*)/g, ',\n  ')

    // 清理多余的换行和空格
    formatted = formatted
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')

    // 添加适当的缩进
    const lines = formatted.split('\n')
    const indentedLines = []
    let indentLevel = 0

    lines.forEach(line => {
      const trimmedLine = line.trim()

      if (trimmedLine.match(/^(SELECT|FROM|WHERE|GROUP BY|HAVING|ORDER BY|LIMIT|UNION)/i)) {
        indentLevel = 0
        indentedLines.push(trimmedLine)
      } else if (trimmedLine.match(/^(JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN)/i)) {
        indentLevel = 0
        indentedLines.push(trimmedLine)
      } else if (trimmedLine.startsWith(',') || trimmedLine.match(/^[a-zA-Z_][a-zA-Z0-9_]*\./)) {
        indentedLines.push('  ' + trimmedLine)
      } else {
        indentedLines.push('  ' + trimmedLine)
      }
    })

    return indentedLines.join('\n')
  }
}

// 导出工具函数
export const sqlUtils = {
  highlight: SQLHighlighter.highlight,
  format: SQLFormatter.format,
  createAutoComplete: (connectionStore) => new SQLAutoComplete(connectionStore),
  keywords: SQL_KEYWORDS,
  operators: SQL_OPERATORS
}