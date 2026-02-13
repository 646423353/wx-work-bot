const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const monitorService = require('../services/monitorService');
const wechatService = require('../services/wechatService');

// 企业微信加解密库（可选，如果安装了@wecom/crypto则使用）
let wecomCrypto;
try {
  wecomCrypto = require('@wecom/crypto');
  console.log('@wecom/crypto 已加载');
} catch (e) {
  console.log('@wecom/crypto 未安装，将使用简化验证模式');
}

// 从环境变量获取企业微信配置
const CORP_ID = process.env.CORP_ID || '';
const TOKEN = process.env.TOKEN || '';
const ENCODING_AES_KEY = process.env.ENCODING_AES_KEY || '';

const responseWrapper = (data = null, message = 'success', code = 200) => {
  return { code, message, data };
};

const errorWrapper = (message = 'error', code = 500) => {
  return { code, message, data: null };
};

router.get('/health', (req, res) => {
  res.json(responseWrapper({ status: 'ok', timestamp: new Date().toISOString() }));
});

router.get('/monitoring/overview', (req, res) => {
  try {
    db.get('SELECT COUNT(*) as count FROM groups WHERE status = 1', (err, groupCount) => {
      if (err) {
        console.error('获取监控群聊数失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      db.get('SELECT COUNT(*) as count FROM messages WHERE sent_at >= ?', [today.toISOString()], (err, messageCount) => {
        if (err) {
          console.error('获取今日消息总数失败:', err.message);
          res.json(errorWrapper('获取数据失败'));
          return;
        }

        db.get('SELECT COUNT(*) as count FROM tasks WHERE status = ?', ['overdue'], (err, overdueTasksCount) => {
          if (err) {
            console.error('获取超时任务数失败:', err.message);
            res.json(errorWrapper('获取数据失败'));
            return;
          }

          db.get('SELECT AVG(CAST((julianday(reply_time) - julianday(sent_at)) * 24 * 60 AS INTEGER)) as avg_response_time FROM messages WHERE reply_status = 1 AND sent_at >= ?', [today.toISOString()], (err, avgResponseTime) => {
            if (err) {
              console.error('获取平均响应时间失败:', err.message);
              res.json(errorWrapper('获取数据失败'));
              return;
            }

            res.json(responseWrapper({
              monitoredGroupsCount: groupCount.count || 0,
              todayMessagesCount: messageCount.count || 0,
              overdueTasksCount: overdueTasksCount.count || 0,
              averageResponseTime: avgResponseTime.avg_response_time ? `${Math.round(avgResponseTime.avg_response_time)}m` : '0m'
            }));
          });
        });
      });
    });
  } catch (error) {
    console.error('获取监控概览数据失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

// 手动催办任务
router.post('/tasks/:id/push', (req, res) => {
  try {
    const { id } = req.params;
    
    // 先获取任务信息
    db.get('SELECT * FROM tasks WHERE id = ?', [id], async (err, task) => {
      if (err) {
        console.error('获取任务失败:', err.message);
        res.json(errorWrapper('催办失败'));
        return;
      }
      
      if (!task) {
        res.json(errorWrapper('任务不存在'));
        return;
      }
      
      if (task.status === 'done') {
        res.json(errorWrapper('已完成的任务无需催办'));
        return;
      }
      
      try {
        const { customContent } = req.body;
        const success = await monitorService.sendTaskReminder(task, true, customContent); // true = isManual
        if (success) {
          res.json(responseWrapper(null, '已发送提醒'));
        } else {
          res.json(errorWrapper('发送提醒失败，请检查群机器人配置'));
        }
      } catch (e) {
         res.json(errorWrapper('发送提醒异常'));
      }
    });
  } catch (error) {
    console.error('催办任务失败:', error.message);
    res.json(errorWrapper('催办任务失败'));
  }
});

// 获取群聊统计数据（用于监控仪表盘）
router.get('/monitoring/group-stats', (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // 查询每个群聊的今日消息统计
    db.all(`
      SELECT 
        g.group_id,
        g.group_name,
        COUNT(m.id) as todayMessages,
        SUM(CASE WHEN m.reply_status = 0 THEN 1 ELSE 0 END) as unreplied,
        AVG(CASE WHEN m.reply_status = 1 THEN (julianday(m.reply_time) - julianday(m.sent_at)) * 24 * 60 END) as avgResponseMinutes,
        MAX(m.sent_at) as lastActive
      FROM groups g
      LEFT JOIN messages m ON g.group_id = m.group_id AND m.sent_at >= ?
      WHERE g.status = 1
      GROUP BY g.group_id, g.group_name
      ORDER BY todayMessages DESC
    `, [todayStr], (err, rows) => {
      if (err) {
        console.error('获取群聊统计数据失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }

      const stats = rows.map(row => {
        const avgTime = row.avgResponseMinutes || 0;
        let status = 'normal';
        if (row.unreplied > 2 || avgTime > 20) {
          status = 'warning';
        } else if (row.unreplied > 0 || avgTime > 10) {
          status = 'warning';
        }

        return {
          id: row.group_id,
          name: row.group_name,
          todayMessages: row.todayMessages || 0,
          unreplied: row.unreplied || 0,
          averageResponseTime: avgTime > 0 ? avgTime.toFixed(1) : '0.0',
          lastActive: row.lastActive ? new Date(row.lastActive).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--:--',
          status: status
        };
      });

      res.json(responseWrapper(stats));
    });
  } catch (error) {
    console.error('获取群聊统计数据失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

// 获取超时任务列表（替代原来的未回复告警）
router.get('/monitoring/alerts', (req, res) => {
  try {
    db.all(`
      SELECT 
        t.id,
        t.content,
        t.created_at,
        t.group_id,
        g.group_name,
        t.assignee_id as assignee,
        (julianday('now') - julianday(t.created_at)) * 24 * 60 as timeout_minutes
      FROM tasks t
      LEFT JOIN groups g ON t.group_id = g.group_id
      WHERE t.status = 'overdue'
      ORDER BY t.created_at ASC
      LIMIT 20
    `, (err, rows) => {
      if (err) {
        console.error('获取超时任务列表失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }

      const alerts = rows.map(row => {
        const timeout = Math.floor(row.timeout_minutes);
        return {
          id: row.id,
          groupId: row.group_id,
          priority: 'warning',
          timeout: timeout,
          time: new Date(row.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          groupName: row.group_name,
          content: row.content,
          responsiblePerson: row.assignee || '未分配'
        };
      });

      res.json(responseWrapper(alerts));
    });
  } catch (error) {
    console.error('获取超时任务列表失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.get('/monitoring/messages', (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    db.all(
      'SELECT m.*, g.group_name FROM messages m JOIN groups g ON m.group_id = g.group_id ORDER BY m.sent_at DESC LIMIT ? OFFSET ?',
      [limit, offset],
      (err, messages) => {
        if (err) {
          console.error('获取消息列表失败:', err.message);
          res.json(errorWrapper('获取数据失败'));
          return;
        }
        
        const formattedMessages = messages.map(msg => ({
          id: msg.message_id,
          groupName: msg.group_name,
          sender: msg.sender_name || '未知',
          content: msg.content,
          time: new Date(msg.sent_at).toLocaleString('zh-CN'),
          status: msg.reply_status === 0 ? 'unreplied' : 'replied'
        }));
        
        res.json(responseWrapper(formattedMessages));
      }
    );
  } catch (error) {
    console.error('获取消息列表失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

// 发送回复消息接口
router.post('/messages/reply', async (req, res) => {
  try {
    const { group_id, content } = req.body;
    
    if (!group_id || !content) {
      res.json(errorWrapper('缺少必要参数'));
      return;
    }


    // 0. 优先尝试 Webhook 回复 (新增逻辑)
    db.get('SELECT webhook_url FROM groups WHERE group_id = ?', [group_id], async (err, groupRow) => {
        if (!err && groupRow && groupRow.webhook_url) {
            console.log('Detect webhook_url, trying to send via webhook...');
            try {
                const axios = require('axios');
                await axios.post(groupRow.webhook_url, {
                    msgtype: 'text',
                    text: { content: content }
                });
                
                // 发送成功，记录系统回复消息并更新状态
                const replyMsgId = `reply_${Date.now()}`;
                const autoReplyMsg = {
                    msgid: replyMsgId,
                    chatid: group_id,
                    from: { userid: 'system_webhook', name: '系统回复(Webhook)' },
                    msgtype: 'text',
                    text: { content: content },
                    msgtime: Date.now()
                };

                await monitorService.processNewMessage(autoReplyMsg);
                res.json(responseWrapper(null, '回复发送成功(Webhook)'));
                return;
            } catch (webhookErr) {
                console.error('Webhook 发送失败, 尝试回退到私聊回复:', webhookErr.message);
                // 继续执行下方的 fallback 逻辑
            }
        }

        // 1. 原有逻辑：查询该群聊中最近的一条未回复消息的发送者
        fallbackToPrivateReply();
    });

    function fallbackToPrivateReply() {
    db.get(
      'SELECT sender_id, sender_name FROM messages WHERE group_id = ? AND reply_status = 0 ORDER BY sent_at DESC LIMIT 1',
      [group_id],
      async (err, row) => {
        if (err) {
          console.error('查询未回复消息发送者失败:', err.message);
          res.json(errorWrapper('查询消息发送者失败'));
          return;
        }

        if (!row || !row.sender_id) {
          // 如果没有找到未回复的消息（可能是已被其他方式处理），尝试回复给群里最近活跃的人，或者报错
          // 这里为了保险，如果有内容但没找到未回复记录，可能是一个误操作或者手动触发。
          // 我们可以尝试查找该群最近的一条消息（不管是否回复）的发送者作为fallback
          db.get(
            'SELECT sender_id FROM messages WHERE group_id = ? ORDER BY sent_at DESC LIMIT 1',
             [group_id],
             async (err2, fallbackRow) => {
               if (err2 || !fallbackRow) {
                 res.json(errorWrapper('无法确定回复对象（群内无消息记录）'));
                 return;
               }
               await sendPrivateReply(fallbackRow.sender_id);
             }
          );
          return;
        }

        await sendPrivateReply(row.sender_id);
      }
    );
  }

    async function sendPrivateReply(targetUserId) {
        // 2. 发送应用消息（私聊）
        const success = await wechatService.sendAppMessage(targetUserId, content);
        
        if (!success) {
          // 这里失败可能是因为该用户不是企业成员（外部联系人无法直接发应用消息？）
          // 错误码 86008 是针对群聊的，针对个人消息，如果是外部联系人可能需要互通账号
          // 假设是内部员工或已验证的外部联系人
          res.json(errorWrapper('发送私信失败'));
          return;
        }

        // 3. 构造消息对象并处理（触发自动回复状态更新）
        const config = require('../../config/config');
        const senderId = config.monitor.internalUserIds && config.monitor.internalUserIds.length > 0 
                        ? config.monitor.internalUserIds[0] 
                        : 'system_reply';

        const message = {
            message_id: `reply_${Date.now()}`,
            group_id: group_id,
            sender_id: senderId,
            sender_name: '系统回复(私信)',
            content: content,
            msg_type: 'text',
            sent_at: new Date().toISOString(),
            reply_status: 1 // 客服回复默认状态
        };

        // 4. 调用监控服务处理该消息 
        // 这将：(1) 保存该消息 (2) 触发回复判定逻辑，将该群之前的未回复消息标记为已回复
        await monitorService.processNewMessage(message);

        res.json(responseWrapper(null, '私信回复发送成功'));
    }

  } catch (error) {
    console.error('回复消息接口异常:', error.message);
    res.json(errorWrapper('回复消息失败'));
  }
});

router.get('/groups', (req, res) => {
  try {
    db.all(`
      SELECT g.*, 
             (SELECT COUNT(DISTINCT sender_id) FROM messages WHERE group_id = g.group_id) as active_member_count,
             (SELECT COUNT(*) FROM tasks WHERE group_id = g.group_id AND status = 'in_progress') as task_in_progress,
             (SELECT COUNT(*) FROM tasks WHERE group_id = g.group_id AND status = 'overdue') as task_overdue,
             (SELECT COUNT(*) FROM tasks WHERE group_id = g.group_id AND status = 'done') as task_done
      FROM groups g
      ORDER BY g.status DESC, g.priority ASC, g.created_at DESC
    `, (err, groups) => {
      if (err) {
        console.error('获取群聊列表失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }
      
      const formattedGroups = groups.map(group => ({
        id: group.id,
        groupId: group.group_id,
        name: group.group_name,
        memberCount: group.member_count || group.active_member_count || 0,
        status: group.status === 1 ? 'active' : 'paused',
        webhookUrl: group.webhook_url || '',
        autoRemind: group.auto_remind !== 0,
        createdAt: new Date(group.created_at).toLocaleString('zh-CN'),
        taskStats: {
          inProgress: group.task_in_progress || 0,
          overdue: group.task_overdue || 0,
          done: group.task_done || 0
        }
      }));
      
      res.json(responseWrapper(formattedGroups));
    });
  } catch (error) {
    console.error('获取群聊列表失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.post('/groups', (req, res) => {
  try {
    const { name, memberCount, status, webhookUrl, autoRemind } = req.body;
    
    if (!name) {
      res.json(errorWrapper('群聊名称不能为空'));
      return;
    }
    
    db.run(
      'INSERT INTO groups (group_id, group_name, status, webhook_url, auto_remind) VALUES (?, ?, ?, ?, ?)',
      [`group_${Date.now()}`, name, status === 'active' ? 1 : 0, webhookUrl || '', autoRemind === false ? 0 : 1],
      (err) => {
        if (err) {
          console.error('添加群聊失败:', err.message);
          res.json(errorWrapper('添加群聊失败'));
          return;
        }
        
        res.json(responseWrapper(null, '添加群聊成功'));
      }
    );
  } catch (error) {
    console.error('添加群聊失败:', error.message);
    res.json(errorWrapper('添加群聊失败'));
  }
});
// 同步群聊信息（从企微接口获取）
router.get('/groups/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先查询本地记录获取 group_id
    const group = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM groups WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!group) {
      return res.json(errorWrapper('群聊不存在'));
    }
    
    // 从企微获取群详情
    const detail = await wechatService.getGroupDetail(group.group_id);
    if (!detail) {
      return res.json(errorWrapper('无法从企业微信获取群信息，请检查配置'));
    }
    
    const newName = detail.name || group.group_name;
    const newMemberCount = detail.userlist ? detail.userlist.length : 0;
    
    // 更新本地数据库
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE groups SET group_name = ?, member_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newName, newMemberCount, id],
        (err) => err ? reject(err) : resolve()
      );
    });
    
    res.json(responseWrapper({
      name: newName,
      memberCount: newMemberCount
    }, '同步成功'));
  } catch (error) {
    console.error('同步群聊信息失败:', error.message);
    res.json(errorWrapper('同步失败: ' + error.message));
  }
});

router.put('/groups/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, memberCount, status, webhookUrl, autoRemind } = req.body;
    
    db.run(
      'UPDATE groups SET group_name = ?, status = ?, webhook_url = ?, auto_remind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, status === 'active' ? 1 : 0, webhookUrl || '', autoRemind === false ? 0 : 1, id],
      (err) => {
        if (err) {
          console.error('更新群聊配置失败:', err.message);
          res.json(errorWrapper('更新群聊配置失败'));
          return;
        }
        
        res.json(responseWrapper(null, '更新群聊配置成功'));
      }
    );
  } catch (error) {
    console.error('更新群聊配置失败:', error.message);
    res.json(errorWrapper('更新群聊配置失败'));
  }
});

router.delete('/groups/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    db.run('DELETE FROM groups WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('删除群聊失败:', err.message);
        res.json(errorWrapper('删除群聊失败'));
        return;
      }
      
      res.json(responseWrapper(null, '删除群聊成功'));
    });
  } catch (error) {
    console.error('删除群聊失败:', error.message);
    res.json(errorWrapper('删除群聊失败'));
  }
});

router.get('/alerts', (req, res) => {
  try {
    db.all('SELECT key, value FROM system_settings', (err, rows) => {
        if (err) {
            console.error('获取告警配置失败:', err.message);
            res.json(errorWrapper('获取数据失败'));
            return;
        }
        
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });

        // 构造前端需要的格式
        const alerts = [{
            id: 1,
            enabled: settings.alert_enabled === 'true',
            timeout: parseInt(settings.alert_timeout || '30', 10),
            notificationTypes: JSON.parse(settings.notification_types || '[]')
        }];
        
        res.json(responseWrapper(alerts));
    });
  } catch (error) {
    console.error('获取告警配置失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.put('/alerts/:id', (req, res) => {
  try {
      const { enabled, timeout, notificationTypes } = req.body;
      
      db.serialize(() => {
          const runUpdate = (key, value) => {
              db.run('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [key, value], (err) => {
                  if (err) console.error(`更新配置 ${key} 失败:`, err.message);
              });
          };

          runUpdate('alert_enabled', enabled.toString());
          runUpdate('alert_timeout', timeout.toString());
          runUpdate('notification_types', JSON.stringify(notificationTypes));
      });

      res.json(responseWrapper(null, '保存告警配置成功'));
  } catch (error) {
    console.error('保存告警配置失败:', error.message);
    res.json(errorWrapper('保存告警配置失败'));
  }
});

router.get('/sensitive-words', (req, res) => {
  try {
    db.all('SELECT * FROM sensitive_words ORDER BY severity ASC, created_at DESC', (err, words) => {
      if (err) {
        console.error('获取敏感词列表失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }
      
      const formattedWords = words.map(word => ({
        id: word.id,
        word: word.word
      }));
      
      res.json(responseWrapper(formattedWords));
    });
  } catch (error) {
    console.error('获取敏感词列表失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.post('/sensitive-words', (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word) {
      res.json(errorWrapper('敏感词不能为空'));
      return;
    }
    
    db.run(
      'INSERT INTO sensitive_words (word, severity) VALUES (?, ?)',
      [word, 2],
      (err) => {
        if (err) {
          console.error('添加敏感词失败:', err.message);
          res.json(errorWrapper('添加敏感词失败'));
          return;
        }
        
        res.json(responseWrapper(null, '添加敏感词成功'));
      }
    );
  } catch (error) {
    console.error('添加敏感词失败:', error.message);
    res.json(errorWrapper('添加敏感词失败'));
  }
});

router.delete('/sensitive-words/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    db.run('DELETE FROM sensitive_words WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('删除敏感词失败:', err.message);
        res.json(errorWrapper('删除敏感词失败'));
        return;
      }
      
      res.json(responseWrapper(null, '删除敏感词成功'));
    });
  } catch (error) {
    console.error('删除敏感词失败:', error.message);
    res.json(errorWrapper('删除敏感词失败'));
  }
});

router.get('/reports', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // 构造日期查询条件
    let start = startDate ? new Date(startDate) : new Date(0); // 默认从以前开始
    let end = endDate ? new Date(endDate) : new Date(); // 默认到当前时间
    
    // 如果只有日期部分，确保包含整天 (设置到当天 23:59:59.999)
    if (endDate && endDate.length <= 10) {
        end.setHours(23, 59, 59, 999);
    }

    const startStr = start.toISOString();
    const endStr = end.toISOString();

    const messageSql = `
      SELECT 
        g.group_name,
        COUNT(m.id) as totalMessages,
        SUM(CASE WHEN m.reply_status = 1 THEN 1 ELSE 0 END) as repliedMessages,
        SUM(CASE WHEN m.reply_status = 0 THEN 1 ELSE 0 END) as unrepliedMessages,
        AVG(CASE WHEN m.reply_status = 1 THEN (julianday(m.reply_time) - julianday(m.sent_at)) * 24 * 60 END) as avgResponseMinutes
      FROM groups g
      LEFT JOIN messages m ON g.group_id = m.group_id AND m.sent_at BETWEEN ? AND ?
      GROUP BY g.group_id, g.group_name
      ORDER BY totalMessages DESC
    `;

    const taskSql = `
      SELECT 
        date(t.created_at) as date,
        g.group_name,
        COUNT(*) as count
      FROM tasks t
      JOIN groups g ON t.group_id = g.group_id
      WHERE t.created_at BETWEEN ? AND ?
      GROUP BY date(t.created_at), g.group_name
      ORDER BY date(t.created_at) DESC, count DESC
    `;

    // 使用 Promise 处理并行查询
    const getMessageStats = new Promise((resolve, reject) => {
        db.all(messageSql, [startStr, endStr], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    const getTaskStats = new Promise((resolve, reject) => {
        db.all(taskSql, [startStr, endStr], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    Promise.all([getMessageStats, getTaskStats])
        .then(([messageRows, taskRows]) => {
            // 计算消息汇总数据
            let globalTotal = 0;
            let globalReplied = 0;
            let globalUnreplied = 0;

            const groupStats = messageRows.map(row => {
                globalTotal += row.totalMessages;
                globalReplied += row.repliedMessages;
                globalUnreplied += row.unrepliedMessages;

                const responseRate = row.totalMessages > 0 ? row.repliedMessages / row.totalMessages : 0;
                const avgTime = row.avgResponseMinutes ? Math.round(row.avgResponseMinutes) : 0;

                return {
                    groupName: row.group_name,
                    totalMessages: row.totalMessages,
                    repliedMessages: row.repliedMessages,
                    unrepliedMessages: row.unrepliedMessages,
                    responseRate: responseRate,
                    avgResponseTime: `${avgTime}分钟`
                };
            });

            // 处理任务统计数据
            const dailyTaskStats = taskRows.map(row => ({
                date: row.date,
                groupName: row.group_name,
                count: row.count
            }));

            const reportData = {
                totalMessages: globalTotal,
                repliedMessages: globalReplied,
                unrepliedMessages: globalUnreplied,
                groupStats: groupStats,
                dailyTaskStats: dailyTaskStats
            };
            
            res.json(responseWrapper(reportData));
        })
        .catch(err => {
            console.error('查询报表数据失败:', err.message);
            res.json(errorWrapper('获取数据失败'));
        });
  } catch (error) {
    console.error('获取报表数据失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.get('/reports/export', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xlsx');
    res.send(Buffer.from(''));
  } catch (error) {
    console.error('导出报表失败:', error.message);
    res.json(errorWrapper('导出报表失败'));
  }
});

router.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('登录请求:', { username, password: '***' });
    
    if (username === 'admin' && password === 'admin123') {
      const responseData = responseWrapper({
        token: 'mock_token_' + Date.now(),
        user: {
          id: 1,
          name: '张主管',
          department: '客服团队'
        }
      }, '登录成功');
      
      console.log('登录成功，响应:', responseData);
      res.json(responseData);
    } else {
      const errorResponse = errorWrapper('用户名或密码错误', 401);
      console.log('登录失败，响应:', errorResponse);
      res.status(401).json(errorResponse);
    }
  } catch (error) {
    console.error('登录失败:', error.message);
    const errorResponse = errorWrapper('登录失败');
    res.status(500).json(errorResponse);
  }
});

router.post('/auth/logout', (req, res) => {
  try {
    res.json(responseWrapper(null, '退出登录成功'));
  } catch (error) {
    console.error('退出登录失败:', error.message);
    res.json(errorWrapper('退出登录失败'));
  }
});

router.get('/settings', (req, res) => {
  try {
    const settings = {
      systemName: '企业微信消息监控助手',
      refreshInterval: 30,
      enableNotification: true,
      theme: 'light',
      language: 'zh-CN'
    };
    
    res.json(responseWrapper(settings));
  } catch (error) {
    console.error('获取设置失败:', error.message);
    res.json(errorWrapper('获取设置失败'));
  }
});

router.put('/settings', (req, res) => {
  try {
    const { systemName, refreshInterval, enableNotification, theme, language } = req.body;
    
    console.log('保存设置:', req.body);
    
    // TODO: 将设置保存到数据库或配置文件
    // 当前设置保存在内存中，重启后不会保留
    
    res.json(responseWrapper({
      systemName: systemName || '企业微信消息监控助手',
      refreshInterval: refreshInterval || 30,
      enableNotification: enableNotification !== undefined ? enableNotification : true,
      theme: theme || 'light',
      language: language || 'zh-CN'
    }, '保存设置成功'));
  } catch (error) {
    console.error('保存设置失败:', error.message);
    res.status(500).json(errorWrapper('保存设置失败'));
  }
});

router.post('/wechat/message', (req, res) => {
  try {
    const message = req.body;
    
    message.message_id = message.message_id || `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    message.sent_at = message.sent_at || new Date().toISOString();
    
    monitorService.processNewMessage(message);
    
    res.json(responseWrapper(null, '消息接收成功'));
  } catch (error) {
    console.error('接收消息失败:', error.message);
    res.json(errorWrapper('接收消息失败'));
  }
});

// 企业微信消息回调接口 - URL验证
router.get('/webhook', (req, res) => {
  try {
    let { msg_signature, timestamp, nonce, echostr } = req.query;

    console.log('收到企业微信验证请求:', {
      msg_signature,
      timestamp,
      nonce,
      echostr: echostr ? '存在' : '不存在'
    });

    // 对echostr进行URL解码
    if (echostr) {
      echostr = decodeURIComponent(echostr);
    }

    // 如果没有安装加密库或缺少配置
    if (!wecomCrypto || !TOKEN || !ENCODING_AES_KEY) {
      console.warn('警告: 未配置企业微信加密参数，使用简化验证模式');
      
      if (echostr) {
        res.setHeader('Content-Type', 'text/plain');
        res.send(echostr);
      } else {
        res.send('success');
      }
      return;
    }

    // 验证签名并解密
    try {
      // 1. 验证签名
      const expectedSignature = wecomCrypto.getSignature(TOKEN, timestamp, nonce, echostr);
      
      if (expectedSignature !== msg_signature) {
        console.error('签名验证失败');
        console.error('期望签名:', expectedSignature);
        console.error('收到签名:', msg_signature);
        res.status(401).send('sign error');
        return;
      }

      console.log('签名验证成功');

      // 2. 解密echostr
      const decrypted = wecomCrypto.decrypt(ENCODING_AES_KEY, echostr);
      
      console.log('解密成功，明文内容长度:', decrypted.message.length);
      
      // 3. 返回解密后的明文（必须原样返回，不能加引号，不能有bom头，不能有换行符）
      res.setHeader('Content-Type', 'text/plain');
      res.send(decrypted.message);
      
    } catch (cryptoError) {
      console.error('企业微信解密失败:', cryptoError.message);
      res.status(500).send('decrypt error');
    }
    
  } catch (error) {
    console.error('处理企业微信验证请求失败:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).send('fail');
  }
});

router.post('/webhook', (req, res) => {
  try {
    const { msg_signature, timestamp, nonce } = req.query;
    let xmlData = req.body;

    console.log('收到企业微信消息推送:', {
      msg_signature,
      timestamp,
      nonce,
      body: xmlData
    });

    // 处理XML数据 - 从对象或字符串中提取Encrypt
    let encrypt = '';
    
    if (typeof xmlData === 'string') {
      // 如果是原始XML字符串，提取Encrypt
      const encryptMatch = xmlData.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/i);
      if (encryptMatch) {
        encrypt = encryptMatch[1];
      }
    } else if (xmlData) {
      // 尝试多种路径提取Encrypt，增加健壮性
      // 1. 扁平化结构 (body-parser-xml normalizeTags=true, explicitArray=false) -> { encrypt: '...' }
      // 2. 标准结构 -> { xml: { Encrypt: '...' } }
      // 3. 混合情况 -> { xml: { encrypt: '...' } }
      encrypt = xmlData.encrypt || 
               (xmlData.xml && (xmlData.xml.Encrypt || xmlData.xml.encrypt));
    }
    
    console.log('提取的Encrypt:', encrypt ? encrypt.substring(0, 50) + '...' : '为空');

    // 如果没有提取到Encrypt，返回错误
    if (!encrypt) {
      console.error('无法提取加密消息');
      console.error('原始数据类型:', typeof xmlData);
      res.status(400).send('fail');
      return;
    }

    // 打印配置信息（用于调试）
    console.log('配置检查:');
    console.log('- wecomCrypto加载状态:', wecomCrypto ? '已加载' : '未加载');
    console.log('- TOKEN配置状态:', TOKEN ? '已配置(' + TOKEN.length + '字符)' : '未配置');
    console.log('- ENCODING_AES_KEY配置状态:', ENCODING_AES_KEY ? '已配置(' + ENCODING_AES_KEY.length + '字符)' : '未配置');

    // 如果没有配置加密参数，返回错误
    if (!wecomCrypto || !TOKEN || !ENCODING_AES_KEY) {
      console.error('加密参数不完整，无法解密消息');
      res.status(500).send('fail');
      return;
    }

    // 1. 验证签名
    const signature = wecomCrypto.getSignature(TOKEN, timestamp, nonce, encrypt);
    console.log('签名验证:');
    console.log('- 期望签名:', signature);
    console.log('- 收到签名:', msg_signature);
    
    if (signature !== msg_signature) {
      console.error('签名验证失败');
      res.status(403).send('fail');
      return;
    }

    console.log('签名验证成功');

    // 2. 解密消息
    console.log('开始解密...');
    const decrypted = wecomCrypto.decrypt(ENCODING_AES_KEY, encrypt);
    console.log('解密成功，消息长度:', decrypted.message.length);
    console.log('解密后的消息:', decrypted.message);

    // 3. 解析XML消息
    const message = parseWechatMessage(decrypted.message);

    if (message) {
      console.log('解析后的消息:', message);
      // 4. 存储消息到数据库
      storeMessage(message);

      // 5. 触发告警检查
      monitorService.processNewMessage(message);
    }

    res.send('success');
  } catch (error) {
    console.error('处理企业微信消息失败:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).send('fail');
  }
});

// 解析企业微信XML消息
function parseWechatMessage(xmlData) {
  try {
    // 简单的XML解析（生产环境建议使用xml2js库）
    const xml2js = require('xml2js');
    let message = null;
    
    // 检查是否为JSON格式 (以 { 开头)
    if (typeof xmlData === 'string' && xmlData.trim().startsWith('{')) {
      try {
        const json = JSON.parse(xmlData);
        console.log('检测到JSON格式消息:', JSON.stringify(json, null, 2));
        
        // 映射JSON字段到标准消息结构 (兼容群机器人回调格式)
        // 文档: https://developer.work.weixin.qq.com/document/path/100719
        message = {
          message_id: json.msgid || `msg_${Date.now()}`,
          group_id: json.chatid || '', // 群聊ID
          sender_id: (json.from && json.from.userid) || '',
          sender_name: (json.from && json.from.name) || (json.from && json.from.userid) || '',
          // 机器人回调的文本内容在 json.text.content
          content: (json.text && json.text.content) || JSON.stringify(json), 
          msg_type: json.msgtype || 'text',
          sent_at: new Date().toISOString(),
          reply_status: 0,
          raw_data: json,
          // 关键字段: 机器人回调的回复URL
          response_url: json.response_url || ''
        };
        
        return message;
      } catch (e) {
        console.warn('尝试解析JSON失败，回退到XML解析:', e.message);
      }
    }

    // XML解析逻辑
    xml2js.parseString(xmlData, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('解析XML失败:', err.message);
        return;
      }
      
      const xml = result.xml;
      if (xml) {
        message = {
          message_id: xml.MsgId || `msg_${Date.now()}`,
          group_id: xml.FromUserName || '',
          sender_id: xml.FromUserName || '',
          sender_name: xml.FromUserName || '',
          content: xml.Content || '',
          msg_type: xml.MsgType || 'text',
          sent_at: new Date().toISOString(),
          reply_status: 0
        };
      }
    });
    
    return message;
  } catch (error) {
    console.error('解析消息失败:', error.message);
    return null;
  }
}

// 存储消息到数据库
function storeMessage(message) {
  try {
    db.run(
      `INSERT INTO messages (message_id, group_id, sender_id, sender_name, content, message_type, sent_at, reply_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [message.message_id, message.group_id, message.sender_id, message.sender_name, 
       message.content, message.msg_type, message.sent_at, message.reply_status],
      (err) => {
        if (err) {
          console.error('存储消息失败:', err.message);
        } else {
          console.log('消息已存储:', message.message_id);
        }
      }
    );
  } catch (error) {
    console.error('存储消息失败:', error.message);
  }
}


// 获取任务统计
router.get('/tasks/stats', (req, res) => {
    db.all(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const stats = { in_progress: 0, overdue: 0, done: 0, total: 0 };
        rows.forEach(row => {
            if (stats.hasOwnProperty(row.status)) {
                stats[row.status] = row.count;
            }
            stats.total += row.count;
        });
        res.json(stats);
    });
});

// 获取任务列表 (分页)
router.get('/tasks', (req, res) => {
    const { status, page = 1, pageSize = 20 } = req.query;
    const limit = parseInt(pageSize);
    const offset = (parseInt(page) - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
        whereClause = ' WHERE t.status = ?';
        params.push(status);
    }

    // 1. 获取总数
    const countSql = `SELECT COUNT(*) as total FROM tasks t ${whereClause}`;
    
    db.get(countSql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const total = result.total;

        // 2. 获取数据
        let dataSql = `SELECT t.*, g.group_name, u.username as creator_name 
                       FROM tasks t 
                       LEFT JOIN groups g ON t.group_id = g.group_id 
                       LEFT JOIN users u ON t.creator_id = u.username 
                       ${whereClause} 
                       ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        
        // 追加分页参数
        const dataParams = [...params, limit, offset];

        db.all(dataSql, dataParams, (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({
                total,
                list: rows,
                page: parseInt(page),
                pageSize: limit
            });
        });
    });
});

module.exports = router;
