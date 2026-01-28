// 内存数据库模拟模块

class MemoryDB {
    constructor() {
        // 初始化数据存储
        this.tables = {
            groups: [],
            messages: [],
            alerts: [],
            sensitive_words: [],
            users: [],
            notifications: []
        };
        
        // 初始化自增ID
        this.ids = {
            groups: 1,
            messages: 1,
            alerts: 1,
            sensitive_words: 1,
            users: 1,
            notifications: 1
        };
        
        // 初始化默认数据
        this.initDefaultData();
    }
    
    // 初始化默认数据
    initDefaultData() {
        // 添加默认敏感词
        const defaultWords = [
            { word: '投诉', severity: 1 },
            { word: '不满', severity: 1 },
            { word: '退款', severity: 1 },
            { word: '退货', severity: 1 },
            { word: '骗子', severity: 1 },
            { word: '垃圾', severity: 2 },
            { word: '差评', severity: 2 },
            { word: '太慢', severity: 2 },
            { word: '不好用', severity: 2 },
            { word: '失望', severity: 2 }
        ];
        
        defaultWords.forEach(word => {
            this.tables.sensitive_words.push({
                id: this.ids.sensitive_words++,
                word: word.word,
                severity: word.severity,
                created_at: new Date().toISOString()
            });
        });
        
        // 添加默认群聊
        const defaultGroups = [
            { group_id: 'chat_001', group_name: '客户服务A群', status: 1, priority: 2, response_time_threshold: 30 },
            { group_id: 'chat_002', group_name: '技术支持B群', status: 1, priority: 1, response_time_threshold: 15 },
            { group_id: 'chat_003', group_name: '产品咨询C群', status: 1, priority: 2, response_time_threshold: 30 },
            { group_id: 'chat_004', group_name: '售后服务D群', status: 1, priority: 3, response_time_threshold: 60 },
            { group_id: 'chat_005', group_name: '商务合作E群', status: 1, priority: 2, response_time_threshold: 30 }
        ];
        
        defaultGroups.forEach(group => {
            this.tables.groups.push({
                id: this.ids.groups++,
                group_id: group.group_id,
                group_name: group.group_name,
                status: group.status,
                priority: group.priority,
                response_time_threshold: group.response_time_threshold,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        });
        
        // 添加默认消息
        const defaultMessages = [
            {
                message_id: 'msg_001',
                group_id: 'chat_001',
                sender_id: 'user_001',
                sender_name: '李客户',
                content: '请问你们的产品什么时候能发货？我上周就已经下单了，现在还没有收到任何通知...',
                message_type: 'text',
                sent_at: new Date(Date.now() - 35 * 60000).toISOString(),
                reply_status: 0
            },
            {
                message_id: 'msg_002',
                group_id: 'chat_002',
                sender_id: 'user_002',
                sender_name: '王技术',
                content: '系统报错：无法连接到数据库，请技术支持人员尽快回复！',
                message_type: 'text',
                sent_at: new Date(Date.now() - 28 * 60000).toISOString(),
                reply_status: 0
            },
            {
                message_id: 'msg_003',
                group_id: 'chat_003',
                sender_id: 'user_003',
                sender_name: '张咨询',
                content: '我想了解一下你们的新产品有哪些功能，能详细介绍一下吗？',
                message_type: 'text',
                sent_at: new Date(Date.now() - 15 * 60000).toISOString(),
                reply_status: 0
            },
            {
                message_id: 'msg_004',
                group_id: 'chat_004',
                sender_id: 'user_004',
                sender_name: '赵售后',
                content: '我的产品出现了质量问题，需要申请售后维修',
                message_type: 'text',
                sent_at: new Date(Date.now() - 5 * 60000).toISOString(),
                reply_status: 1,
                reply_time: new Date(Date.now() - 3 * 60000).toISOString()
            },
            {
                message_id: 'msg_005',
                group_id: 'chat_005',
                sender_id: 'user_005',
                sender_name: '钱商务',
                content: '我们想洽谈一下商务合作事宜，请问你们的负责人是谁？',
                message_type: 'text',
                sent_at: new Date(Date.now() - 10 * 60000).toISOString(),
                reply_status: 1,
                reply_time: new Date(Date.now() - 5 * 60000).toISOString()
            }
        ];
        
        defaultMessages.forEach(message => {
            this.tables.messages.push({
                id: this.ids.messages++,
                message_id: message.message_id,
                group_id: message.group_id,
                sender_id: message.sender_id,
                sender_name: message.sender_name,
                content: message.content,
                message_type: message.message_type,
                sent_at: message.sent_at,
                reply_status: message.reply_status,
                reply_time: message.reply_time,
                created_at: new Date().toISOString()
            });
        });
        
        // 添加默认告警
        const defaultAlerts = [
            {
                alert_id: 'alert_001',
                group_id: 'chat_001',
                message_id: 'msg_001',
                alert_type: 'unreplied',
                severity: 1,
                status: 0
            },
            {
                alert_id: 'alert_002',
                group_id: 'chat_002',
                message_id: 'msg_002',
                alert_type: 'unreplied',
                severity: 1,
                status: 0
            },
            {
                alert_id: 'alert_003',
                group_id: 'chat_003',
                message_id: 'msg_003',
                alert_type: 'unreplied',
                severity: 2,
                status: 0
            }
        ];
        
        defaultAlerts.forEach(alert => {
            this.tables.alerts.push({
                id: this.ids.alerts++,
                alert_id: alert.alert_id,
                group_id: alert.group_id,
                message_id: alert.message_id,
                alert_type: alert.alert_type,
                severity: alert.severity,
                status: alert.status,
                created_at: new Date().toISOString()
            });
        });
    }
    
    // 执行SQL查询（模拟）
    all(sql, params, callback) {
        // 处理参数，支持可选的params
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        
        // 简单的SQL解析和执行
        // 这里只处理基本的SELECT语句
        if (sql.startsWith('SELECT')) {
            // 提取表名
            const tableMatch = sql.match(/FROM\s+(\w+)/i);
            if (!tableMatch) {
                callback(new Error('Invalid SQL: missing table name'), []);
                return;
            }
            
            const tableName = tableMatch[1];
            const table = this.tables[tableName];
            
            if (!table) {
                callback(new Error(`Table not found: ${tableName}`), []);
                return;
            }
            
            // 简单的WHERE条件处理
            let results = [...table];
            
            const whereMatch = sql.match(/WHERE\s+(.*)/i);
            if (whereMatch) {
                const whereClause = whereMatch[1];
                // 这里只处理简单的等于条件
                const conditionMatch = whereClause.match(/(\w+)\s*=\s*(['"]?)([^'"\s]+)\2/i);
                if (conditionMatch) {
                    const column = conditionMatch[1];
                    const value = conditionMatch[3];
                    
                    results = results.filter(row => {
                        return row[column] == value;
                    });
                }
            }
            
            // 简单的ORDER BY处理
            const orderMatch = sql.match(/ORDER\s+BY\s+(\w+)(\s+DESC)?/i);
            if (orderMatch) {
                const column = orderMatch[1];
                const desc = orderMatch[2] ? true : false;
                
                results.sort((a, b) => {
                    if (a[column] < b[column]) return desc ? 1 : -1;
                    if (a[column] > b[column]) return desc ? -1 : 1;
                    return 0;
                });
            }
            
            callback(null, results);
        } else {
            callback(new Error('Only SELECT statements are supported'), []);
        }
    }
    
    // 执行SQL查询（单个结果）
    get(sql, params, callback) {
        this.all(sql, params, (err, results) => {
            if (err) {
                callback(err, null);
            } else {
                callback(null, results[0] || null);
            }
        });
    }
    
    // 执行SQL语句
    run(sql, params, callback) {
        // 简单的SQL解析和执行
        if (sql.startsWith('INSERT')) {
            // 提取表名
            const tableMatch = sql.match(/INTO\s+(\w+)/i);
            if (!tableMatch) {
                callback(new Error('Invalid SQL: missing table name'));
                return;
            }
            
            const tableName = tableMatch[1];
            const table = this.tables[tableName];
            
            if (!table) {
                callback(new Error(`Table not found: ${tableName}`));
                return;
            }
            
            // 提取列名和值
            const columnsMatch = sql.match(/\(([^\)]+)\)\s+VALUES/i);
            const valuesMatch = sql.match(/VALUES\s+\(([^\)]+)\)/i);
            
            if (!columnsMatch || !valuesMatch) {
                callback(new Error('Invalid SQL: missing columns or values'));
                return;
            }
            
            const columns = columnsMatch[1].split(',').map(col => col.trim());
            const values = valuesMatch[1].split(',').map(val => {
                val = val.trim();
                // 移除引号
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    return val.substring(1, val.length - 1);
                }
                // 转换数字
                if (!isNaN(val)) {
                    return parseInt(val);
                }
                return val;
            });
            
            // 创建新行
            const newRow = {
                id: this.ids[tableName]++,
                created_at: new Date().toISOString()
            };
            
            columns.forEach((col, index) => {
                newRow[col] = values[index];
            });
            
            // 添加到表中
            table.push(newRow);
            callback(null);
        } else if (sql.startsWith('UPDATE')) {
            // 提取表名
            const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
            if (!tableMatch) {
                callback(new Error('Invalid SQL: missing table name'));
                return;
            }
            
            const tableName = tableMatch[1];
            const table = this.tables[tableName];
            
            if (!table) {
                callback(new Error(`Table not found: ${tableName}`));
                return;
            }
            
            // 提取SET子句
            const setMatch = sql.match(/SET\s+(.*?)\s+WHERE/i);
            if (!setMatch) {
                callback(new Error('Invalid SQL: missing SET clause'));
                return;
            }
            
            const setClause = setMatch[1];
            const setPairs = setClause.split(',').map(pair => pair.trim());
            
            // 提取WHERE子句
            const whereMatch = sql.match(/WHERE\s+(.*)/i);
            if (!whereMatch) {
                callback(new Error('Invalid SQL: missing WHERE clause'));
                return;
            }
            
            const whereClause = whereMatch[1];
            const conditionMatch = whereClause.match(/(\w+)\s*=\s*(['"]?)([^'"\s]+)\2/i);
            if (!conditionMatch) {
                callback(new Error('Invalid SQL: invalid WHERE clause'));
                return;
            }
            
            const column = conditionMatch[1];
            const value = conditionMatch[3];
            
            // 更新匹配的行
            table.forEach(row => {
                if (row[column] == value) {
                    setPairs.forEach(pair => {
                        const [col, val] = pair.split('=').map(item => item.trim());
                        // 移除引号
                        let cleanedVal = val;
                        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                            cleanedVal = val.substring(1, val.length - 1);
                        }
                        // 转换数字
                        if (!isNaN(cleanedVal)) {
                            cleanedVal = parseInt(cleanedVal);
                        }
                        row[col] = cleanedVal;
                    });
                    row.updated_at = new Date().toISOString();
                }
            });
            
            callback(null);
        } else if (sql.startsWith('DELETE')) {
            // 提取表名
            const tableMatch = sql.match(/FROM\s+(\w+)/i);
            if (!tableMatch) {
                callback(new Error('Invalid SQL: missing table name'));
                return;
            }
            
            const tableName = tableMatch[1];
            const table = this.tables[tableName];
            
            if (!table) {
                callback(new Error(`Table not found: ${tableName}`));
                return;
            }
            
            // 提取WHERE子句
            const whereMatch = sql.match(/WHERE\s+(.*)/i);
            if (!whereMatch) {
                callback(new Error('Invalid SQL: missing WHERE clause'));
                return;
            }
            
            const whereClause = whereMatch[1];
            const conditionMatch = whereClause.match(/(\w+)\s*=\s*(['"]?)([^'"\s]+)\2/i);
            if (!conditionMatch) {
                callback(new Error('Invalid SQL: invalid WHERE clause'));
                return;
            }
            
            const column = conditionMatch[1];
            const value = conditionMatch[3];
            
            // 删除匹配的行
            for (let i = table.length - 1; i >= 0; i--) {
                if (table[i][column] == value) {
                    table.splice(i, 1);
                }
            }
            
            callback(null);
        } else {
            callback(new Error('Unsupported SQL statement'));
        }
    }
    
    // 执行SQL脚本
    exec(sql, callback) {
        // 分割SQL语句并执行
        const statements = sql.split(';').filter(stmt => stmt.trim());
        
        statements.forEach(statement => {
            // 忽略注释
            if (!statement.trim().startsWith('--')) {
                // 这里只处理CREATE TABLE语句
                if (statement.startsWith('CREATE TABLE')) {
                    // 提取表名
                    const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
                    if (tableMatch) {
                        const tableName = tableMatch[1];
                        // 初始化表
                        if (!this.tables[tableName]) {
                            this.tables[tableName] = [];
                            this.ids[tableName] = 1;
                        }
                    }
                }
            }
        });
        
        callback(null);
    }
    
    // 关闭数据库连接
    close(callback) {
        console.log('数据库连接已关闭');
        if (callback) {
            callback(null);
        }
    }
}

// 导出数据库实例
const db = new MemoryDB();
module.exports = db;