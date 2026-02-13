const db = require('../utils/database');
const wechatService = require('./wechatService');
const emailService = require('./emailService');
const config = require('../../config/config');
const axios = require('axios');
const aiService = require('./aiService');
const schedule = require('node-schedule');

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
            this.checkTaskReminders();
        }, config.monitor.checkInterval);
        // 每日 20:30 定时推送任务播报
        this.scheduleDailyReport();
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
        
        // 1. 获取全局配置
        db.all('SELECT key, value FROM system_settings', (err, rows) => {
            if (err) {
                console.error('获取系统配置失败:', err.message);
                return;
            }
            
            const settings = {};
            rows.forEach(row => settings[row.key] = row.value);
            
            // 如果全局告警未开启，直接跳过
            if (settings.alert_enabled !== 'true') {
                console.log('全局告警已禁用，跳过检查');
                return;
            }
            
            const globalTimeout = parseInt(settings.alert_timeout || '30', 10);

            // 2. 获取所有监控中的群聊
            db.all('SELECT group_id, group_name, response_time_threshold, webhook_url, auto_remind FROM groups WHERE status = 1', (err, groups) => {
                if (err) {
                    console.error('获取群聊列表失败:', err.message);
                    return;
                }
                
                groups.forEach(group => {
                    // 计算超时时间（优先使用全局配置）
                    const thresholdTime = new Date();
                    thresholdTime.setMinutes(thresholdTime.getMinutes() - globalTimeout);
                    
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
        
        // 3. Webhook 自动提醒 (新增)
        // 需检查: 1. 配置了 Webhook URL; 2. 开启了自动提醒 (auto_remind !== 0)
        if (group.webhook_url && group.auto_remind !== 0) {
            console.log(`尝试通过 Webhook 发送超时提醒: ${group.group_name}`);
            try {
                await axios.post(group.webhook_url, {
                    msgtype: 'text',
                    text: {
                        content: `【温馨提醒】\n您有一条来自 ${message.sender_name} 的消息等待回复。\n\n"${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"\n\n请及时处理。`
                         // 或者直接用用户要求的简单文案: "您有消息未回复"
                         // content: "您有消息未回复" 
                    }
                });
                console.log('Webhook 超时提醒发送成功');
            } catch (err) {
                console.error('Webhook 超时提醒发送失败:', err.message);
            }
        }
        
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
            console.log(`处理新消息: [${message.msg_type}] ${message.sender_name}: ${message.content.substring(0, 20)}...`);

            // 1. 自动建群 (Auto-Onboarding)
            // 检查群聊是否存在，不存在则自动创建
            const groupExists = await new Promise((resolve) => {
                db.get('SELECT group_id FROM groups WHERE group_id = ?', [message.group_id], (err, row) => {
                    resolve(!!row);
                });
            });

            if (!groupExists && message.group_id) {
                console.log(`发现新群聊: ${message.group_id}，自动添加到监控列表`);
                await new Promise((resolve) => {
                    const defaultName = `未命名群_${message.group_id.substring(message.group_id.length - 6)}`;
                    db.run(
                        'INSERT INTO groups (group_id, group_name, status) VALUES (?, ?, ?)',
                        [message.group_id, defaultName, 1], // 默认开启监控
                        (err) => {
                            if (err) console.error('自动创建群聊失败:', err.message);
                            resolve();
                        }
                    );
                });
            }

            // 2. 身份识别与回复状态处理 (Reply Logic)
            // 判断发送者是否为内部人员 (客服/机器人)
            const internalUserIds = config.monitor.internalUserIds || [];
            // 将 'system_reply' (系统自动回复/私信回复) 也视为内部人员
            const isInternalUser = internalUserIds.includes(message.sender_id) || message.sender_id === 'system_reply' || message.sender_id.startsWith('system_');
            
            if (isInternalUser) {
                // 如果是内部人员发送的消息，标记为已回复
                message.reply_status = 1;
                console.log(`检测到内部人员消息 (${message.sender_name})，标记为已回复`);
                
                // 核心逻辑：将该群聊中之前的未回复消息标记为已回复
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE messages 
                         SET reply_status = 1, reply_time = ? 
                         WHERE group_id = ? AND reply_status = 0 AND sent_at < ?`,
                        [message.sent_at, message.group_id, message.sent_at],
                        (err) => {
                            if (err) {
                                console.error('批量更新历史消息状态失败:', err.message);
                            } else {
                                console.log(`已自动关闭该群聊之前的未回复消息`);
                            }
                            resolve();
                        }
                    );
                });

                // 连带逻辑：关闭相关未回复告警 (Alerts)
                await new Promise((resolve) => {
                    db.run(
                        `UPDATE alerts 
                         SET status = 1, resolved_at = ? 
                         WHERE group_id = ? AND alert_type = 'unreplied' AND status = 0`,
                        [new Date().toISOString(), message.group_id],
                        (err) => {
                             if (err) console.error('批量关闭相关告警失败:', err.message);
                             resolve();
                        }
                    );
                });

            } else {
                // 如果是外部客户发送的消息，标记为未回复
                message.reply_status = 0;
                console.log(`检测到客户消息 (${message.sender_name})，标记为待回复`);
            }

            // 3. 自动回复与敏感词检测
            if (message.response_url) {
                console.log(`收到机器人@消息，调用AI解析意图...`);
                try {
                    // 0. 获取上下文历史 (最近 5 条)
                    const history = await new Promise((resolve) => {
                        db.all(
                            'SELECT sender_name, content FROM messages WHERE group_id = ? ORDER BY sent_at DESC LIMIT 5',
                            [message.group_id],
                            (err, rows) => {
                                if (err) resolve([]);
                                else resolve(rows.reverse()); // 按时间正序
                            }
                        );
                    });

                    // 1. 调用 AI 分析意图 (带历史上下文)
                    const aiResult = await aiService.analyzeMessage(message.content, history);
                    console.log('AI分析结果:', JSON.stringify(aiResult));

                    let replyContent = '';
                    
                    if (!aiResult) {
                        replyContent = '抱歉，我没有理解您的意思。';
                    } else {
                        const intent = aiResult.intent ? aiResult.intent.toUpperCase() : 'CHAT';
                        const taskInfo = aiResult.task_info || {};

                        switch (intent) {
                            case 'CREATE_TASK': {
                                const description = taskInfo.content || taskInfo.description || message.content;
                                // 处理 SENDER 特殊值：替换为实际发送者
                                let assignee = taskInfo.assignee || null;
                                if (assignee === 'SENDER') {
                                    assignee = message.sender_name || message.sender_id;
                                }
                                const deadline = taskInfo.deadline || null;
                                const priority = taskInfo.priority || 'medium';
                                const clarity = taskInfo.clarity || 'partial';
                                const missingFields = aiResult.missing_fields || [];

                                await new Promise((resolve) => {
                                    db.run(
                                        'INSERT INTO tasks (group_id, creator_id, assignee_id, content, deadline, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                        [message.group_id, message.sender_id, assignee || '待定', description, deadline || '无', priority, 'in_progress'],
                                        function(err) {
                                            if (err) {
                                                replyContent = `❌ 任务创建失败: ${err.message}`;
                                            } else {
                                                const taskId = this.lastID;
                                                if (clarity === 'complete') {
                                                    replyContent = `✅ **任务已记录**\n📌 编号：${taskId}\n📋 内容：${description}\n👤 负责人：@${assignee}\n⏰ 截止：${deadline}\n🔥 优先级：${priority === 'high' ? '高' : '中'}\n📊 状态：进行中\n\n💡 完成后请 @我 "结单 ${taskId}"`;
                                                } else {
                                                    let missingHint = '';
                                                    if (missingFields.includes('deadline')) missingHint += '• 期望什么时间完成？\n';
                                                    if (missingFields.includes('assignee')) missingHint += '• 负责人是哪位同事？\n';
                                                    replyContent = `📝 **任务草稿已保存**（编号：${taskId}）\n📋 内容：${description}\n\n⚠️ 请补充：\n${missingHint}\n💡 回复："补充${taskId}：本周五前完成，负责人@张三"`;
                                                }
                                            }
                                            resolve();
                                        }
                                    );
                                });
                                break;
                            }

                            case 'COMPLETE_TASK': {
                                let targetTaskId = taskInfo.task_id;
                                const isBatch = taskInfo.batch === true || String(targetTaskId).toLowerCase() === 'all';
                                
                                if (!targetTaskId) {
                                    replyContent = '请指定任务编号，如：结单 12';
                                } else if (isBatch) {
                                    // 批量结单：查询该群组所有待办任务
                                    const pendingTasks = await new Promise((resolve) => {
                                        db.all(
                                            'SELECT id, content FROM tasks WHERE group_id = ? AND status IN (?, ?)',
                                            [message.group_id, 'in_progress', 'overdue'],
                                            (err, rows) => resolve(rows || [])
                                        );
                                    });
                                    
                                    if (pendingTasks.length === 0) {
                                        replyContent = '✅ 当前没有待完成的任务，已全部结单！';
                                    } else {
                                        const nowStr = new Date().toISOString();
                                        const allIds = pendingTasks.map(t => t.id);
                                        await new Promise(r => db.run(
                                            `UPDATE tasks SET status = ?, completed_at = ? WHERE group_id = ? AND status IN ('in_progress', 'overdue')`,
                                            ['done', nowStr, message.group_id],
                                            r
                                        ));
                                        const taskList = pendingTasks.map(t => `[${t.id}] ${t.content}`).join('\n');
                                        replyContent = `🎉 **批量结单完成**\n✅ 共完成 ${allIds.length} 条任务\n\n${taskList}\n\n⏰ 完成时间：${new Date().toLocaleString('zh-CN')}\n👤 确认人：@${message.sender_name || '用户'}`;
                                    }
                                } else {
                                    let taskIdRun = String(targetTaskId).replace(/TASK-/i, '');
                                    
                                    // 指代消解：如果是 "last"、"这个"、"那个" 等，查找最近的任务
                                    if (taskIdRun === 'last' || taskIdRun.includes('这个') || taskIdRun.includes('那个') || taskIdRun.includes('刚才') || !/^\d+$/.test(taskIdRun)) {
                                        let foundId = null;
                                        for (const h of [...history].reverse()) {
                                            const match = h.content && h.content.match(/\[(\d+)\]/);
                                            if (match) { foundId = match[1]; break; }
                                        }
                                        if (!foundId) {
                                            const lastTask = await new Promise(r => db.get(
                                                'SELECT id FROM tasks WHERE group_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1',
                                                [message.group_id, 'in_progress', 'overdue'], (e, row) => r(row)
                                            ));
                                            if (lastTask) foundId = String(lastTask.id);
                                        }
                                        if (foundId) { taskIdRun = foundId; }
                                        else { replyContent = '❌ 未能识别您指的是哪个任务，请指定任务编号'; break; }
                                    }
                                    
                                    await new Promise((resolve) => {
                                        db.get('SELECT id, content FROM tasks WHERE id = ?', [taskIdRun], (err, task) => {
                                            if (!task) { replyContent = `❌ 未找到 ID 为 ${taskIdRun} 的任务`; resolve(); return; }
                                            db.run('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', ['done', new Date().toISOString(), taskIdRun], function() {
                                                replyContent = `🎉 **任务已结单**\n📌 编号：${task.id}\n📋 内容：${task.content}\n✅ 完成时间：${new Date().toLocaleString('zh-CN')}\n👤 确认人：@${message.sender_name || '用户'}`;
                                                resolve();
                                            });
                                        });
                                    });
                                }
                                break;
                            }
                            
                            case 'QUERY_TASK': {
                                const singleTaskId = taskInfo.task_id;
                                
                                // 单任务详情查看
                                if (singleTaskId && singleTaskId !== 'all') {
                                    await new Promise((resolve) => {
                                        db.get('SELECT id, content, assignee_id, deadline, priority, status, created_at, completed_at FROM tasks WHERE id = ?', 
                                            [singleTaskId], (err, task) => {
                                            if (err) {
                                                replyContent = `❌ 查询失败: ${err.message}`;
                                            } else if (!task) {
                                                replyContent = `❌ 未找到编号为 ${singleTaskId} 的任务`;
                                            } else {
                                                const priorityMap = { high: '🔥 高', medium: '中', low: '低' };
                                                const statusText = task.status === 'done' ? '✅ 已完成' : '📊 进行中';
                                                replyContent = `📋 **任务详情**\n` +
                                                    `📌 编号：${task.id}\n` +
                                                    `📝 内容：${task.content}\n` +
                                                    `👤 负责人：@${task.assignee_id || '待定'}\n` +
                                                    `⏰ 截止：${task.deadline || '无'}\n` +
                                                    `🔥 优先级：${priorityMap[task.priority] || '中'}\n` +
                                                    `📊 状态：${statusText}\n` +
                                                    `📅 创建于：${new Date(task.created_at).toLocaleString('zh-CN')}` +
                                                    (task.completed_at ? `\n✅ 完成于：${new Date(task.completed_at).toLocaleString('zh-CN')}` : '') +
                                                    (task.status !== 'done' ? `\n\n💡 回复 "结单 ${task.id}" 可标记完成` : '');
                                            }
                                            resolve();
                                        });
                                    });
                                    break;
                                }
                                
                                // 任务列表查询
                                const qLimit = taskInfo.limit ? parseInt(taskInfo.limit) : 10;
                                const qStatus = taskInfo.status || 'undone';
                                const qOrderBy = taskInfo.order_by || 'created_at DESC';
                                const qAssignee = taskInfo.assignee;
                                const allowedOrder = ['created_at DESC', 'created_at ASC', 'deadline ASC', 'deadline DESC'];
                                const finalOrder = allowedOrder.includes(qOrderBy) ? qOrderBy : 'created_at DESC';

                                let sql = 'SELECT id, content, assignee_id, deadline, status FROM tasks WHERE group_id = ?';
                                const params = [message.group_id];
                                if (qStatus === 'undone') {
                                    sql += " AND status IN ('in_progress', 'overdue')";
                                } else if (qStatus !== 'all') {
                                    sql += ' AND status = ?'; params.push(qStatus);
                                }
                                if (qAssignee) { sql += ' AND assignee_id LIKE ?'; params.push(`%${qAssignee}%`); }
                                sql += ` ORDER BY ${finalOrder} LIMIT ?`;
                                params.push(qLimit);

                                await new Promise((resolve) => {
                                    db.all(sql, params, (err, rows) => {
                                        if (err) { replyContent = `❌ 查询失败: ${err.message}`; }
                                        else if (rows.length === 0) { replyContent = '📭 未找到符合条件的任务。'; }
                                        else {
                                            const lines = rows.map(r => {
                                                let icon = '⬜';
                                                if (r.status === 'done') icon = '✅';
                                                else if (r.status === 'overdue') icon = '⚠️';
                                                return `${icon} [${r.id}] ${r.content} (@${r.assignee_id || '待定'}) 截止:${r.deadline || '无'}`;
                                            });
                                            replyContent = `📋 **任务查询结果**（共${rows.length}条）\n\n${lines.join('\n')}\n\n💡 回复 "结单 ID" 可标记完成`;
                                        }
                                        resolve();
                                    });
                                });
                                break;
                            }

                            case 'UPDATE_TASK': {
                                const updateTaskId = taskInfo.task_id;
                                const updates = taskInfo.updates || {};
                                if (!updateTaskId) {
                                    replyContent = '请指定任务编号，如：修改 12 截止时间为明天';
                                    break;
                                }
                                let resolvedId = String(updateTaskId).replace(/TASK-/i, '');
                                if (resolvedId === 'last' || resolvedId.includes('刚才')) {
                                    const lastTask = await new Promise(r => db.get('SELECT id FROM tasks WHERE group_id = ? ORDER BY created_at DESC LIMIT 1', [message.group_id], (e, row) => r(row)));
                                    if (lastTask) resolvedId = String(lastTask.id);
                                }
                                const setClauses = [], updateParams = [];
                                if (updates.content) { setClauses.push('content = ?'); updateParams.push(updates.content); }
                                if (updates.deadline) { setClauses.push('deadline = ?'); updateParams.push(updates.deadline); }
                                if (updates.assignee) { setClauses.push('assignee_id = ?'); updateParams.push(updates.assignee); }
                                if (updates.priority) { setClauses.push('priority = ?'); updateParams.push(updates.priority); }
                                if (updates.status) { setClauses.push('status = ?'); updateParams.push(updates.status); }
                                if (setClauses.length === 0) { replyContent = '请指定要修改的内容，如：截止时间、负责人、优先级、状态等'; break; }
                                updateParams.push(resolvedId);
                                await new Promise((resolve) => {
                                    db.run(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`, updateParams, function(err) {
                                        if (err || this.changes === 0) { replyContent = `❌ 未找到或修改失败 ID ${resolvedId}`; }
                                        else {
                                            const priorityMap = { high: '🔥高', medium: '中', low: '低' };
                                            const statusMap = { in_progress: '🔄进行中', done: '✅已完成' };
                                            const changed = Object.entries(updates).filter(([,v]) => v).map(([k,v]) => {
                                                if (k === 'deadline') return `截止→${v}`;
                                                if (k === 'assignee') return `负责人→@${v}`;
                                                if (k === 'priority') return `优先级→${priorityMap[v] || v}`;
                                                if (k === 'status') return `状态→${statusMap[v] || v}`;
                                                return `内容→${v}`;
                                            });
                                            replyContent = `✏️ **任务已更新**\n📌 编号：${resolvedId}\n🔄 变更：${changed.join('，')}`;
                                        }
                                        resolve();
                                    });
                                });
                                break;
                            }

                            case 'HELP':
                                replyContent = `📖 **任务小助手使用指南**\n\n【创建任务】@我 + 任务描述\n示例："帮我整理客户名单，明天5点前给@张三"\n\n【结单】@我 + "结单 编号"\n示例："结单 15"\n\n【查询】@我 + "查任务/我的任务"\n示例："查一下待办"\n\n【修改】@我 + "修改 编号 + 内容"\n示例："修改15截止时间为下周一"\n\n💬 @我 "帮助" 查看此指南`;
                                break;

                            case 'CLARIFICATION_NEEDED':
                                replyContent = aiResult.message || '🤔 请提供更多信息';
                                break;
                                
                            case 'CHAT':
                            default:
                                replyContent = aiResult.message || `收到您的消息：${message.content}`;
                                break;
                        }
                    }

                    // 4. 发送回复
                    const res = await axios.post(message.response_url, {
                        msgtype: 'markdown',
                        markdown: {
                            content: replyContent
                        }
                    });
                    console.log('机器人@自动回复请求发送结束，响应数据:', JSON.stringify(res.data));
                    
                    if (res.data && res.data.errcode !== 0) {
                        console.error('机器人@自动回复API报错:', res.data);
                    } else {
                        console.log('机器人@自动回复发送成功');
                        // 标记为已回复
                        db.run(
                            'UPDATE messages SET reply_status = 1, reply_time = ? WHERE message_id = ?',
                            [new Date().toISOString(), message.message_id],
                            (err) => {
                                if (err) console.error('更新消息回复状态失败:', err.message);
                            }
                        );
                        // 保存机器人回复到消息历史，以便后续对话上下文使用
                        db.run(
                            'INSERT INTO messages (message_id, group_id, sender_id, sender_name, content, sent_at, reply_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [
                                `bot_reply_${Date.now()}`,
                                message.group_id,
                                'bot',
                                '任务小助手',
                                replyContent,
                                new Date().toISOString(),
                                1 // 已回复状态
                            ],
                            (err) => {
                                if (err) console.error('保存机器人回复失败:', err.message);
                            }
                        );
                    }
                } catch (err) {
                    console.error('机器人@自动回复发送失败:', err.message);
                }
            } else {
                // 仅当非机器人@消息时才进行敏感词检测 (或两者并行，视需求而定，这里假设机器人指令不仅需检测敏感词)
                // 检查消息是否包含敏感词
                const matchedWords = await this.checkSensitiveWords(message);
            
            // 如果包含敏感词，创建敏感词告警
            if (matchedWords && matchedWords.length > 0) {
                const highestSeverity = Math.min(...matchedWords.map(w => w.severity));
                this.createSensitiveAlert(message, matchedWords, highestSeverity);
            }
            } // Close the else block from the robot reply check
            
            // 4. 保存消息到数据库
            await this.saveMessage(message);
            
            console.log('消息处理流程完成');
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

    // 每日 20:30 定时任务播报
    scheduleDailyReport() {
        // 每天 20:30:00 触发
        schedule.scheduleJob('0 30 20 * * *', () => {
            console.log('[每日播报] 开始推送未完成任务...');
            this.sendDailyReport();
        });
        console.log('每日任务播报已设定: 20:30');
    }

    // 执行每日播报
    async sendDailyReport() {
        const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });

        // 查询所有开启了 auto_remind 的群，及其未完成任务
        db.all(
            `SELECT g.group_id, g.group_name, g.webhook_url, g.auto_remind,
                    t.id as task_id, t.content, t.assignee_id, t.deadline, t.status, t.created_at
             FROM groups g
             LEFT JOIN tasks t ON g.group_id = t.group_id AND t.status IN ('in_progress', 'overdue')
             WHERE g.auto_remind = 1 AND g.webhook_url IS NOT NULL AND g.webhook_url != ''
             ORDER BY g.group_id, t.status DESC, t.created_at ASC`,
            async (err, rows) => {
                if (err) {
                    console.error('[每日播报] 查询失败:', err.message);
                    return;
                }

                // 按群分组
                const groupMap = {};
                rows.forEach(row => {
                    if (!groupMap[row.group_id]) {
                        groupMap[row.group_id] = {
                            name: row.group_name,
                            webhook_url: row.webhook_url,
                            tasks: []
                        };
                    }
                    if (row.task_id) {
                        groupMap[row.group_id].tasks.push(row);
                    }
                });

                // 逐群推送
                for (const [groupId, group] of Object.entries(groupMap)) {
                    if (group.tasks.length === 0) continue;

                    const overdueTasks = group.tasks.filter(t => t.status === 'overdue');
                    const inProgressTasks = group.tasks.filter(t => t.status === 'in_progress');

                    let content = `📋 **每日任务播报**（${today}）\n\n`;

                    if (overdueTasks.length > 0) {
                        content += `⚠️ **超时任务（${overdueTasks.length}条）**\n`;
                        overdueTasks.forEach(t => {
                            content += `• [${t.task_id}] ${t.content} - ${t.assignee_id || '待认领'} - 截止:${t.deadline || '无'}\n`;
                        });
                        content += '\n';
                    }

                    if (inProgressTasks.length > 0) {
                        content += `🔄 **进行中（${inProgressTasks.length}条）**\n`;
                        inProgressTasks.forEach(t => {
                            content += `• [${t.task_id}] ${t.content} - ${t.assignee_id || '待认领'} - 截止:${t.deadline || '无'}\n`;
                        });
                        content += '\n';
                    }

                    content += `💡 回复 "结单 ID" 可标记完成`;

                    try {
                        await axios.post(group.webhook_url, {
                            msgtype: 'markdown',
                            markdown: { content }
                        });
                        console.log(`[每日播报] 已推送到群: ${group.name} (${groupId})`);
                    } catch (e) {
                        console.error(`[每日播报] 推送失败: ${group.name} (${groupId}):`, e.message);
                    }
                }
            }
        );
    }

    // 检查任务提醒 (截止时间 或 24h 待跟进)
    checkTaskReminders() {
        const now = new Date();
        const timeoutHours = 24;
        const thresholdTime = new Date(now);
        thresholdTime.setHours(thresholdTime.getHours() - timeoutHours);

        // 查询所有未完成的任务（in_progress 状态，可能需要标记为 overdue）
        db.all(
            `SELECT t.*, g.webhook_url, g.auto_remind, r.id as reminder_id
             FROM tasks t 
             LEFT JOIN groups g ON t.group_id = g.group_id 
             LEFT JOIN reminders r ON t.id = r.task_id AND r.status = 'sent'
             WHERE t.status IN ('in_progress', 'overdue') AND r.id IS NULL`,
            (err, tasks) => {
                if (err) {
                    console.error('查询待提醒任务失败:', err.message);
                    return;
                }

                tasks.forEach(task => {
                    let shouldRemind = false;
                    let remindReason = '';

                    // 1. 优先检查截止时间
                    if (task.deadline && task.deadline !== '无') {
                        const deadlineDate = new Date(task.deadline);
                        if (!isNaN(deadlineDate.getTime())) {
                            if (now >= deadlineDate) {
                                shouldRemind = true;
                                remindReason = 'deadline';
                            }
                        }
                    }
                    
                    // 2. 无截止时间，走24h兜底逻辑
                    if (!shouldRemind && (!task.deadline || task.deadline === '无')) {
                        const createdDate = new Date(task.created_at);
                        if (now >= thresholdTime && thresholdTime > createdDate) {
                             shouldRemind = true;
                             remindReason = 'timeout_24h';
                        }
                    }

                    if (shouldRemind) {
                        // 将任务标记为超时预警（不自动结单）
                        if (task.status !== 'overdue') {
                            db.run('UPDATE tasks SET status = ? WHERE id = ?', ['overdue', task.id], (err) => {
                                if (err) console.error(`标记任务超时失败 (Task ${task.id}):`, err.message);
                                else console.log(`任务已标记为超时预警 (Task ${task.id})`);
                            });
                        }
                        // 检查 auto_remind 开关
                        if (task.auto_remind !== 0) {
                            this.sendTaskReminder(task, remindReason);
                        }
                    }
                });
            }
        );
    }

    // 发送任务提醒（超时预警 或 手动催办）
    async sendTaskReminder(task, reasonOrIsManual, customContent = '') {
        const isManual = reasonOrIsManual === true;
        const reason = typeof reasonOrIsManual === 'string' ? reasonOrIsManual : (isManual ? 'manual_push' : 'unknown');
        
        let webhookUrl = task.webhook_url;
        let groupName = task.group_name || '';

        // 如果没有 webhook_url，尝试从 DB 获取
        if (!webhookUrl) {
            try {
                const group = await new Promise((resolve, reject) => {
                    db.get('SELECT webhook_url, group_name FROM groups WHERE group_id = ?', [task.group_id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
                if (group) {
                    webhookUrl = group.webhook_url;
                    groupName = group.group_name;
                }
            } catch (e) {
                console.error(`[任务提醒] 获取群信息失败: ${e.message}`);
            }
        }

        if (!webhookUrl) {
            console.error(`[任务提醒] 缺少 Webhook URL: Task ${task.id}, Group ${task.group_id}`);
            return false;
        }
        
        console.log(`发送任务提醒: Task ${task.id}, Type: ${isManual ? 'Manual' : 'Auto'}, Reason: ${reason}`);

        try {
            const assigneeName = task.assignee_id ? `<@${task.assignee_id}>` : '待认领';
            // deadline 可能是 ISO string 或其他格式，简单处理
            let deadlineStr = '无';
            if (task.deadline && task.deadline !== '无') {
                 // 尝试转为本地时间显示
                 try {
                     deadlineStr = new Date(task.deadline).toLocaleString('zh-CN', { hour12: false });
                 } catch(e) {
                     deadlineStr = task.deadline;
                 }
            }

            let title = '';
            let desc = '';
            let color = 'warning'; // warning orange, comment gray, info green

            if (isManual) {
                title = '🔔 【任务提醒】';
                // 使用自定义内容，或者默认文案
                desc = customContent || '管理员发起了任务催办：';
                color = 'comment';
            } else if (reason === 'deadline') {
                title = '⚠️ 【超时预警】';
                desc = '当前已超过截止时间，请负责人及时处理或回复进度。';
            } else {
                title = '⚠️ 【超时预警】';
                desc = '该任务已创建超过 24 小时仍未结单，请负责人及时处理。';
            }

            const content = `
${title}
> 任务内容：<font color="${color}">${task.content}</font>
> 负责人：${assigneeName}
> 截止时间：${deadlineStr}
${groupName ? `> 所在群聊：${groupName}` : ''}

${desc}
            `.trim();
            
            await axios.post(webhookUrl, {
                msgtype: 'markdown',
                markdown: { content: content }
            });

            // 记录提醒
            db.run(
                'INSERT INTO reminders (task_id, group_id, target_user_id, remind_at, content, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [task.id, task.group_id, task.assignee_id, new Date().toISOString(), content, isManual ? 'manual' : 'auto', 'sent'],
                (err) => {
                    if (err) console.error(`记录提醒日志失败 (Task ${task.id}):`, err.message);
                }
            );
            
            console.log(`任务提醒发送成功 (Task ${task.id})`);
            return true;

        } catch (err) {
            console.error(`任务提醒发送失败 (Task ${task.id}):`, err.message);
            return false;
        }
    }
}

module.exports = new MonitorService();