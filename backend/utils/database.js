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

        -- 系统配置表
        CREATE TABLE IF NOT EXISTS system_settings (
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            description TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

        -- 任务表 (Smart Task)
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id TEXT NOT NULL,
            creator_id TEXT NOT NULL,
            assignee_id TEXT,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- pending, done
            deadline DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (group_id) REFERENCES groups(group_id)
        );

        -- 任务提醒表 (Smart Task Reminders)
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            group_id TEXT NOT NULL,
            target_user_id TEXT,
            remind_at DATETIME NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'pending', -- pending, sent
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
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

    // 检查并自动添加 webhook_url 字段
    db.all("PRAGMA table_info(groups)", (err, columns) => {
        if (err) {
            console.error('检查groups表结构失败:', err.message);
            return;
        }
        
        const hasWebhookUrl = columns.some(col => col.name === 'webhook_url');
        if (!hasWebhookUrl) {
            console.log('正在添加 webhook_url 字段到 groups 表...');
            db.run("ALTER TABLE groups ADD COLUMN webhook_url TEXT", (err) => {
                if (err) console.error('添加 webhook_url 字段失败:', err.message);
                else console.log('webhook_url 字段添加成功');
            });
        }

        const hasAutoRemind = columns.some(col => col.name === 'auto_remind');
        if (!hasAutoRemind) {
            console.log('正在添加 auto_remind 字段到 groups 表...');
            // 默认值为 1 (开启)
            db.run("ALTER TABLE groups ADD COLUMN auto_remind INTEGER DEFAULT 1", (err) => {
                if (err) console.error('添加 auto_remind 字段失败:', err.message);
                else console.log('auto_remind 字段添加成功');
            });
        }

        const hasMemberCount = columns.some(col => col.name === 'member_count');
        if (!hasMemberCount) {
            console.log('正在添加 member_count 字段到 groups 表...');
            db.run("ALTER TABLE groups ADD COLUMN member_count INTEGER DEFAULT 0", (err) => {
                if (err) console.error('添加 member_count 字段失败:', err.message);
                else console.log('member_count 字段添加成功');
            });
        }
    });

    // 检查并自动添加 priority 字段到 tasks 表
    db.all("PRAGMA table_info(tasks)", (err, columns) => {
        if (err) {
            console.error('检查tasks表结构失败:', err.message);
            return;
        }
        
        const hasPriority = columns.some(col => col.name === 'priority');
        if (!hasPriority) {
            console.log('正在添加 priority 字段到 tasks 表...');
            db.run("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'", (err) => {
                if (err) console.error('添加 priority 字段失败:', err.message);
                else console.log('priority 字段添加成功');
            });
        }
    });

    // V1.1 迁移：将存量 pending 状态迁移为 in_progress
    db.run("UPDATE tasks SET status = 'in_progress' WHERE status = 'pending'", (err) => {
        if (err) console.error('任务状态迁移失败:', err.message);
        else console.log('V1.1 状态迁移完成: pending → in_progress');
    });

    // 检查并插入默认系统配置
    const defaultSettings = [
        { key: 'alert_enabled', value: 'true', description: '是否启用告警' },
        { key: 'alert_timeout', value: '30', description: '告警超时时间(分钟)' },
        { key: 'notification_types', value: '["email","wechat"]', description: '通知方式' }
    ];

    defaultSettings.forEach(setting => {
        db.run(
            'INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)',
            [setting.key, setting.value, setting.description],
            (err) => {
                if (err) console.error(`插入默认配置 ${setting.key} 失败:`, err.message);
            }
        );
    });
}

// 导出数据库连接
module.exports = db;
