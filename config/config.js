require('dotenv').config();

module.exports = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost'
    },
    
    // 企业微信配置
    wechat: {
        corpId: process.env.WECHAT_CORP_ID || '',
        appSecret: process.env.WECHAT_APP_SECRET || '',
        agentId: process.env.WECHAT_AGENT_ID || '',
        token: process.env.WECHAT_TOKEN || '',
        encodingAESKey: process.env.WECHAT_ENCODING_AES_KEY || ''
    },
    
    // 邮件配置
    email: {
        host: process.env.EMAIL_HOST || '',
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE || false,
        auth: {
            user: process.env.EMAIL_USER || '',
            pass: process.env.EMAIL_PASS || ''
        },
        from: process.env.EMAIL_FROM || ''
    },
    
    // 监控配置
    monitor: {
        checkInterval: process.env.MONITOR_CHECK_INTERVAL || 60000, // 默认1分钟检查一次
        alertInterval: process.env.MONITOR_ALERT_INTERVAL || 300000, // 默认5分钟提醒一次
        maxMessageAge: process.env.MONITOR_MAX_MESSAGE_AGE || 86400000 // 默认1天内的消息
    },
    
    // 日志配置
    logger: {
        level: process.env.LOG_LEVEL || 'info'
    }
};