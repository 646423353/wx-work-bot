const db = require('../utils/database');
const wechatService = require('./wechatService');
const emailService = require('./emailService');
const config = require('../../config/config');

class MonitorService {
    constructor() {
        this.checkInterval = null;
    }
    
    // 启动监控服务
    startMonitor() {
        console.log('启动消息监控服务');
        // 每隔一定时间检查未回复消息
        this.checkInterval = setInterval(() => {
            this.checkUnrepliedMessages();
        }, config.monitor.checkInterval);
    }
    
    // 停止监控服务
    stopMonitor() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            console.log('停止消息监控服务');
        }
    }
    
    // 检查未回复消息
    checkUnrepliedMessages() {
        console.log('检查未回复消息');
        
        // 获取所有监控中的群聊
        db.all('SELECT group_id, group_name, response_time_threshold FROM groups WHERE status = 1', (err, groups) => {
            if (err) {
                console.error('获取群聊列表失败:', err.message);
                return;
            }
            
            groups.forEach(group => {
                // 计算超时时间
                const thresholdTime = new Date();
                thresholdTime.setMinutes(thresholdTime.getMinutes() - group.response_time_threshold);
                
                // 查询该群聊中未回复且超过阈值时间的消息
                db.all(
                    'SELECT message_id, content, sender_name, sent_at FROM messages WHERE group_id = ? AND reply_status = 0 AND sent_at < ?',
                    [group.group_id, thresholdTime.toISOString()],
                    (err, messages) => {
                        if (err) {
                            console.error('查询未回复消息失败:', err.message);
                            return;
                        }
                        
                        messages.forEach(message => {
                            // 检查是否已经创建过告警
                            db.get(
                                'SELECT id FROM alerts WHERE message_id = ? AND alert_type = ?',
                                [message.message_id, 'unreplied'],
                                (err, alert) => {
                                    if (err) {
                                        console.error('查询告警记录失败:', err.message);
                                        return;
                                    }
                                    
                                    if (!alert) {
                                        // 创建未回复消息告警
                                        this.createUnrepliedAlert(group, message);
                                    }
                                }
                            );
                        });
                    }
                );
            });
        });
    }
    
    // 创建未回复消息告警
    createUnrepliedAlert(group, message) {
        const alertId = `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const severity = this.calculateSeverity(group.priority, message.sent_at);
        
        db.run(
            'INSERT INTO alerts (alert_id, group_id, message_id, alert_type, severity) VALUES (?, ?, ?, ?, ?)',
            [alertId, group.group_id, message.message_id, 'unreplied', severity],
            (err) => {
                if (err) {
                    console.error('创建告警失败:', err.message);
                    return;
                }
                
                console.log(`创建未回复消息告警: ${group.group_name} - ${message.content.substring(0, 20)}...`);
                
                // 发送告警通知
                this.sendAlertNotification(group, message, severity);
            }
        );
    }
    
    // 计算告警严重程度
    calculateSeverity(priority, sentAt) {
        const now = new Date();
        const sentTime = new Date(sentAt);
        const hoursDiff = (now - sentTime) / (1000 * 60 * 60);
        
        // 高优先级群聊或超时时间较长的消息，严重程度更高
        if (priority === 1 || hoursDiff >= 2) {
            return 1; // 紧急
        } else if (priority === 2 || hoursDiff >= 1) {
            return 2; // 警告
        } else {
            return 3; // 信息
        }
    }
    
    // 发送告警通知
    async sendAlertNotification(group, message, severity) {
        // 构建通知内容
        const now = new Date();
        const sentAt = new Date(message.sent_at);
        const minutesDiff = Math.floor((now - sentAt) / (1000 * 60));
        
        const notificationContent = `【${severity === 1 ? '紧急' : severity === 2 ? '警告' : '信息'}】未回复消息提醒\n群聊: ${group.group_name}\n发送人: ${message.sender_name}\n内容: ${message.content}\n发送时间: ${sentAt.toLocaleString()}\n超时时长: ${minutesDiff}分钟`;
        
        // 这里可以根据配置发送不同类型的通知
        // 1. 企业微信应用内提醒
        // await wechatService.sendAppMessage('@all', notificationContent);
        
        // 2. 邮件提醒
        // await emailService.sendEmail('admin@example.com', '未回复消息提醒', notificationContent);
        
        console.log('发送告警通知:', notificationContent);
    }
    
    // 检测敏感词
    checkSensitiveWords(message) {
        return new Promise((resolve, reject) => {
            // 获取所有敏感词
            db.all('SELECT word, severity FROM sensitive_words', (err, words) => {
                if (err) {
                    console.error('获取敏感词失败:', err.message);
                    reject(err);
                    return;
                }
                
                const matchedWords = [];
                
                // 检查消息内容是否包含敏感词
                words.forEach(word => {
                    if (message.content.includes(word.word)) {
                        matchedWords.push({ word: word.word, severity: word.severity });
                    }
                });
                
                resolve(matchedWords);
            });
        });
    }
    
    // 处理新消息
    async processNewMessage(message) {
        try {
            // 检查消息是否包含敏感词
            const matchedWords = await this.checkSensitiveWords(message);
            
            // 如果包含敏感词，创建敏感词告警
            if (matchedWords.length > 0) {
                const highestSeverity = Math.min(...matchedWords.map(w => w.severity));
                this.createSensitiveAlert(message, matchedWords, highestSeverity);
            }
            
            // 保存消息到数据库
            await this.saveMessage(message);
            
            console.log('处理新消息成功:', message.content.substring(0, 20) + '...');
        } catch (error) {
            console.error('处理新消息失败:', error.message);
        }
    }
    
    // 创建敏感词告警
    createSensitiveAlert(message, matchedWords, severity) {
        const alertId = `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        db.run(
            'INSERT INTO alerts (alert_id, group_id, message_id, alert_type, severity) VALUES (?, ?, ?, ?, ?)',
            [alertId, message.group_id, message.message_id, 'sensitive', severity],
            (err) => {
                if (err) {
                    console.error('创建敏感词告警失败:', err.message);
                    return;
                }
                
                console.log(`创建敏感词告警: 包含敏感词 ${matchedWords.map(w => w.word).join(', ')}`);
                
                // 发送告警通知
                const notificationContent = `【${severity === 1 ? '紧急' : severity === 2 ? '警告' : '信息'}】敏感词提醒\n群聊: ${message.group_id}\n发送人: ${message.sender_name}\n内容: ${message.content}\n敏感词: ${matchedWords.map(w => w.word).join(', ')}`;
                
                // 这里可以根据配置发送不同类型的通知
                console.log('发送敏感词告警通知:', notificationContent);
            }
        );
    }
    
    // 保存消息到数据库
    saveMessage(message) {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT OR IGNORE INTO messages (message_id, group_id, sender_id, sender_name, content, message_type, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [message.message_id, message.group_id, message.sender_id, message.sender_name, message.content, message.message_type || 'text', message.sent_at],
                (err) => {
                    if (err) {
                        console.error('保存消息失败:', err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }
    
    // 更新消息回复状态
    updateReplyStatus(messageId) {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE messages SET reply_status = 1, reply_time = CURRENT_TIMESTAMP WHERE message_id = ?',
                [messageId],
                (err) => {
                    if (err) {
                        console.error('更新消息回复状态失败:', err.message);
                        reject(err);
                    } else {
                        // 更新相关告警状态
                        db.run(
                            'UPDATE alerts SET status = 1, processed_at = CURRENT_TIMESTAMP WHERE message_id = ?',
                            [messageId],
                            (err) => {
                                if (err) {
                                    console.error('更新告警状态失败:', err.message);
                                }
                                resolve();
                            }
                        );
                    }
                }
            );
        });
    }
}

module.exports = new MonitorService();