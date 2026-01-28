const express = require('express');
const router = express.Router();
const db = require('../utils/database');
const monitorService = require('../services/monitorService');
const wechatService = require('../services/wechatService');

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
        
        db.get('SELECT COUNT(*) as count FROM messages WHERE reply_status = 0', (err, unrepliedCount) => {
          if (err) {
            console.error('获取未回复消息数失败:', err.message);
            res.json(errorWrapper('获取数据失败'));
            return;
          }
          
          db.get('SELECT AVG(CAST((julianday(reply_time) - julianday(sent_at)) * 24 * 60 AS INTEGER)) as avg_response_time FROM messages WHERE reply_status = 1', (err, avgResponseTime) => {
            if (err) {
              console.error('获取平均响应时间失败:', err.message);
              res.json(errorWrapper('获取数据失败'));
              return;
            }
            
            res.json(responseWrapper({
              monitoredGroupsCount: groupCount.count || 0,
              todayMessagesCount: messageCount.count || 0,
              unrepliedMessagesCount: unrepliedCount.count || 0,
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

router.get('/groups', (req, res) => {
  try {
    db.all('SELECT * FROM groups ORDER BY status DESC, priority ASC, created_at DESC', (err, groups) => {
      if (err) {
        console.error('获取群聊列表失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }
      
      const formattedGroups = groups.map(group => ({
        id: group.id,
        name: group.group_name,
        memberCount: Math.floor(Math.random() * 100) + 10,
        status: group.status === 1 ? 'active' : 'paused',
        createdAt: new Date(group.created_at).toLocaleString('zh-CN')
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
    const { name, memberCount, status } = req.body;
    
    if (!name) {
      res.json(errorWrapper('群聊名称不能为空'));
      return;
    }
    
    db.run(
      'INSERT INTO groups (group_id, group_name, status) VALUES (?, ?, ?)',
      [`group_${Date.now()}`, name, status === 'active' ? 1 : 0],
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

router.put('/groups/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, memberCount, status } = req.body;
    
    db.run(
      'UPDATE groups SET group_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, status === 'active' ? 1 : 0, id],
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
    const alerts = [
      {
        id: 1,
        enabled: true,
        timeout: 30,
        notificationTypes: ['email', 'wechat']
      }
    ];
    
    res.json(responseWrapper(alerts));
  } catch (error) {
    console.error('获取告警配置失败:', error.message);
    res.json(errorWrapper('获取数据失败'));
  }
});

router.put('/alerts/:id', (req, res) => {
  try {
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
    const reportData = {
      totalMessages: 1286,
      repliedMessages: 1283,
      unrepliedMessages: 3,
      groupStats: [
        {
          groupName: '客户服务群',
          totalMessages: 456,
          repliedMessages: 455,
          unrepliedMessages: 1,
          responseRate: 0.9978,
          avgResponseTime: '5.2分钟'
        },
        {
          groupName: '技术支持群',
          totalMessages: 389,
          repliedMessages: 388,
          unrepliedMessages: 1,
          responseRate: 0.9974,
          avgResponseTime: '8.5分钟'
        },
        {
          groupName: '销售咨询群',
          totalMessages: 441,
          repliedMessages: 440,
          unrepliedMessages: 1,
          responseRate: 0.9977,
          avgResponseTime: '6.8分钟'
        }
      ]
    };
    
    res.json(responseWrapper(reportData));
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
    res.json(responseWrapper(null, '保存设置成功'));
  } catch (error) {
    console.error('保存设置失败:', error.message);
    res.json(errorWrapper('保存设置失败'));
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

// 企业微信消息回调接口
router.get('/webhook', (req, res) => {
  try {
    const { msg_signature, timestamp, nonce, echostr } = req.query;
    
    console.log('收到企业微信验证请求:', {
      msg_signature,
      timestamp,
      nonce,
      echostr: echostr ? '存在' : '不存在'
    });
    
    // TODO: 实现企业微信消息签名验证
    // 这里简化处理，直接返回 echostr 完成验证
    // 生产环境需要验证签名
    
    if (echostr) {
      res.send(echostr);
    } else {
      res.send('success');
    }
  } catch (error) {
    console.error('处理企业微信验证请求失败:', error.message);
    res.status(500).send('fail');
  }
});

router.post('/webhook', (req, res) => {
  try {
    const { msg_signature, timestamp, nonce } = req.query;
    const xmlData = req.body;
    
    console.log('收到企业微信消息推送:', {
      msg_signature,
      timestamp,
      nonce,
      body: xmlData
    });
    
    // TODO: 实现企业微信消息解密和处理
    // 1. 验证消息签名
    // 2. 解密消息内容
    // 3. 解析XML消息
    // 4. 存储消息到数据库
    // 5. 触发告警检查
    
    // 简化处理：直接返回 success
    res.send('success');
  } catch (error) {
    console.error('处理企业微信消息失败:', error.message);
    res.status(500).send('fail');
  }
});

module.exports = router;
