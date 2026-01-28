-- 创建群聊表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT UNIQUE NOT NULL,
    group_name TEXT NOT NULL,
    status INTEGER DEFAULT 1, -- 1: 监控中, 0: 已暂停
    priority INTEGER DEFAULT 2, -- 1: 高, 2: 中, 3: 低
    response_time_threshold INTEGER DEFAULT 30, -- 默认30分钟
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建消息表
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE NOT NULL,
    group_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text',
    sent_at TIMESTAMP NOT NULL,
    reply_status INTEGER DEFAULT 0, -- 0: 未回复, 1: 已回复
    reply_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

-- 创建告警表
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id TEXT UNIQUE NOT NULL,
    group_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    alert_type TEXT NOT NULL, -- 'unreplied', 'sensitive'
    severity INTEGER DEFAULT 2, -- 1: 紧急, 2: 警告, 3: 信息
    status INTEGER DEFAULT 0, -- 0: 未处理, 1: 已处理
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(group_id),
    FOREIGN KEY (message_id) REFERENCES messages(message_id)
);

-- 创建敏感词表
CREATE TABLE IF NOT EXISTS sensitive_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL,
    severity INTEGER DEFAULT 2, -- 1: 严重, 2: 中等, 3: 轻微
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    department TEXT,
    role TEXT DEFAULT 'member', -- admin, manager, member
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建提醒记录表
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notification_id TEXT UNIQUE NOT NULL,
    alert_id TEXT,
    user_id TEXT,
    notification_type TEXT NOT NULL, -- 'wechat', 'email', 'sms'
    content TEXT NOT NULL,
    status INTEGER DEFAULT 0, -- 0: 未发送, 1: 已发送, 2: 发送失败
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_reply_status ON messages(reply_status);
CREATE INDEX IF NOT EXISTS idx_alerts_group_id ON alerts(group_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at);
