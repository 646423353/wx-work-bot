const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 确保数据目录存在
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'wxwork.db');

// 创建数据库连接
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到 SQLite 数据库:', dbPath);
        initTables();
    }
});

// 初始化数据库表
function initTables() {
    const createTablesSQL = `
        -- 群聊表
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT UNIQUE NOT NULL,
            group_name TEXT NOT NULL,
            status INTEGER DEFAULT 1,
            priority INTEGER DEFAULT 2,
            response_time_threshold INTEGER DEFAULT 30,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 消息表
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id TEXT UNIQUE NOT NULL,
            group_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            sender_name TEXT,
            content TEXT NOT NULL,
            message_type TEXT DEFAULT 'text',
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            reply_status INTEGER DEFAULT 0,
            reply_time DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(group_id)
        );

        -- 告警表
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id TEXT UNIQUE NOT NULL,
            group_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            severity INTEGER DEFAULT 1,
            status INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME,
            FOREIGN KEY (group_id) REFERENCES groups(group_id),
            FOREIGN KEY (message_id) REFERENCES messages(message_id)
        );

        -- 敏感词表
        CREATE TABLE IF NOT EXISTS sensitive_words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT UNIQUE NOT NULL,
            severity INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 用户表
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            status INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- 通知记录表
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_id TEXT UNIQUE NOT NULL,
            alert_id TEXT NOT NULL,
            notification_type TEXT NOT NULL,
            recipient TEXT NOT NULL,
            status INTEGER DEFAULT 0,
            sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (alert_id) REFERENCES alerts(alert_id)
        );

        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
        CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
        CREATE INDEX IF NOT EXISTS idx_messages_reply_status ON messages(reply_status);
        CREATE INDEX IF NOT EXISTS idx_alerts_group_id ON alerts(group_id);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
    `;

    db.exec(createTablesSQL, (err) => {
        if (err) {
            console.error('创建表失败:', err.message);
        } else {
            console.log('数据库表初始化完成');
            // 检查是否需要插入默认数据
            checkAndInsertDefaultData();
        }
    });
}

// 检查并插入默认数据
function checkAndInsertDefaultData() {
    // 检查是否需要创建默认管理员账号
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
            console.error('检查用户数据失败:', err.message);
            return;
        }

        if (row.count === 0) {
            console.log('创建默认管理员账号...');
            db.run(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                ['admin', 'admin123', 'admin'],
                (err) => {
                    if (err) {
                        console.error('创建管理员账号失败:', err.message);
                    } else {
                        console.log('默认管理员账号创建完成 (admin/admin123)');
                    }
                }
            );
        }
    });
}

// 导出数据库连接
module.exports = db;
