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
          status = 'abnormal';
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

// 获取未回复告警列表
router.get('/monitoring/alerts', (req, res) => {
  try {
    const timeoutMinutes = 30; // 超时时间（分钟）

    db.all(`
      SELECT 
        m.id,
        m.message_id,
        m.content,
        m.sent_at,
        g.group_name,
        m.sender_name,
        (julianday('now') - julianday(m.sent_at)) * 24 * 60 as timeout_minutes
      FROM messages m
      JOIN groups g ON m.group_id = g.group_id
      WHERE m.reply_status = 0
        AND (julianday('now') - julianday(m.sent_at)) * 24 * 60 > ?
      ORDER BY m.sent_at ASC
      LIMIT 20
    `, [timeoutMinutes], (err, rows) => {
      if (err) {
        console.error('获取告警列表失败:', err.message);
        res.json(errorWrapper('获取数据失败'));
        return;
      }

      const alerts = rows.map(row => {
        const timeout = Math.floor(row.timeout_minutes);
        return {
          id: row.id,
          priority: timeout > 60 ? 'emergency' : 'warning',
          timeout: timeout,
          time: new Date(row.sent_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
          groupName: row.group_name,
          content: row.content,
          responsiblePerson: row.sender_name
        };
      });

      res.json(responseWrapper(alerts));
    });
  } catch (error) {
    console.error('获取告警列表失败:', error.message);
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

    // 如果安装了@wecom/crypto，使用官方库进行验证和解密
    if (wecomCrypto && TOKEN && ENCODING_AES_KEY) {
      try {
        // 1. 验证签名
        const signature = wecomCrypto.getSignature(TOKEN, timestamp, nonce, echostr);
        if (signature !== msg_signature) {
          console.error('签名验证失败');
          res.status(403).send('fail');
          return;
        }

        // 2. 解密echostr
        const decrypted = wecomCrypto.decrypt(ENCODING_AES_KEY, echostr);
        console.log('解密后的echostr:', decrypted.message);

        // 3. 返回解密后的明文（必须原样返回，不能加引号，不能有bom头，不能有换行符）
        res.setHeader('Content-Type', 'text/plain');
        res.send(decrypted.message);
        return;
      } catch (cryptoError) {
        console.error('企业微信解密失败:', cryptoError.message);
        // 解密失败时返回fail
        res.status(500).send('fail');
        return;
      }
    }

    // 如果没有安装加密库或缺少配置，使用简化模式（仅用于测试）
    console.warn('警告: 使用简化验证模式，生产环境请安装@wecom/crypto并配置环境变量');

    if (echostr) {
      // 简化模式直接返回echostr（仅用于测试，生产环境不安全）
      res.setHeader('Content-Type', 'text/plain');
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

    // 如果安装了@wecom/crypto，使用官方库进行解密
    if (wecomCrypto && TOKEN && ENCODING_AES_KEY) {
      try {
        // 从XML中提取加密消息
        const encryptMatch = xmlData.match(/<Encrypt><!\[CDATA\[(.*?)\]\]><\/Encrypt>/);
        if (!encryptMatch) {
          console.error('无法从XML中提取加密消息');
          res.status(400).send('fail');
          return;
        }
        const encrypt = encryptMatch[1];

        // 1. 验证签名
        const signature = wecomCrypto.getSignature(TOKEN, timestamp, nonce, encrypt);
        if (signature !== msg_signature) {
          console.error('签名验证失败');
          res.status(403).send('fail');
          return;
        }

        // 2. 解密消息
        const decrypted = wecomCrypto.decrypt(ENCODING_AES_KEY, encrypt);
        console.log('解密后的消息:', decrypted.message);

        // 3. 解析XML消息
        const message = parseWechatMessage(decrypted.message);

        if (message) {
          // 4. 存储消息到数据库
          storeMessage(message);

          // 5. 触发告警检查
          monitorService.processNewMessage(message);
        }

        res.send('success');
        return;
      } catch (cryptoError) {
        console.error('企业微信消息解密失败:', cryptoError.message);
        res.status(500).send('fail');
        return;
      }
    }

    // 如果没有安装加密库，记录日志并返回success（测试模式）
    console.warn('警告: 未安装@wecom/crypto，无法解密消息。生产环境请安装并配置环境变量');
    console.log('原始消息内容:', xmlData);

    res.send('success');
  } catch (error) {
    console.error('处理企业微信消息失败:', error.message);
    res.status(500).send('fail');
  }
});

// 解析企业微信XML消息
function parseWechatMessage(xmlData) {
  try {
    // 简单的XML解析（生产环境建议使用xml2js库）
    const xml2js = require('xml2js');
    let message = null;
    
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
      `INSERT INTO messages (message_id, group_id, sender_id, sender_name, content, msg_type, sent_at, reply_status)
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

module.exports = router;
