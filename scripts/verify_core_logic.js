const monitorService = require('../backend/services/monitorService');
const db = require('../backend/utils/database');
const config = require('../config/config');

// Mock internal user ID
config.monitor.internalUserIds = ['robot_123', 'kefu_456'];

// Mock message creator
function createMessage(groupId, senderId, senderName, content) {
    return {
        message_id: `msg_${Date.now()}_${Math.random()}`,
        group_id: groupId,
        sender_id: senderId,
        sender_name: senderName,
        content: content,
        msg_type: 'text',
        sent_at: new Date().toISOString()
    };
}

async function verify() {
    console.log('--- 开始验证核心逻辑 ---');
    const newGroupId = `group_test_${Date.now()}`;
    const customerId = 'customer_001';
    const kefuId = 'kefu_456';

    try {
        // 1. 验证自动建群 (Auto-Onboarding)
        console.log(`\n[STEP 1] 验证自动建群: 发送消息到新群 ${newGroupId}`);
        const msg1 = createMessage(newGroupId, customerId, 'Customer', 'Hello, anyone here?');
        await monitorService.processNewMessage(msg1);

        // 检查数据库
        const group = await new Promise((resolve) => {
            db.get('SELECT * FROM groups WHERE group_id = ?', [newGroupId], (err, row) => resolve(row));
        });

        if (group) {
            console.log(`[PASS] 群聊已自动创建: ${group.group_name} (Status: ${group.status})`);
        } else {
            console.error(`[FAIL] 群聊未创建!`);
        }

        // 2. 验证回复逻辑 (Reply Logic)
        console.log(`\n[STEP 2] 验证回复逻辑:`);
        
        // 检查 msg1 的状态 (应该是 unreplied, 0)
        let msg1Record = await new Promise(resolve => db.get('SELECT reply_status FROM messages WHERE message_id = ?', [msg1.message_id], (err, row) => resolve(row)));
        console.log(`- 客户消息初始状态: ${msg1Record.reply_status} (预期: 0)`);

        // 客服发送回复
        console.log(`- 客服发送回复消息...`);
        const msg2 = createMessage(newGroupId, kefuId, 'Kefu', 'Hi, I am here.');
        await monitorService.processNewMessage(msg2);

        // 再次检查 msg1 的状态 (应该是 replied, 1)
        msg1Record = await new Promise(resolve => db.get('SELECT reply_status FROM messages WHERE message_id = ?', [msg1.message_id], (err, row) => resolve(row)));
        console.log(`- 客户消息更新后状态: ${msg1Record.reply_status} (预期: 1)`);

        if (msg1Record.reply_status === 1) {
            console.log(`[PASS] 回复状态自动更新成功!`);
        } else {
            console.error(`[FAIL] 回复状态未自动更新!`);
        }

    } catch (err) {
        console.error('验证过程出错:', err);
    } finally {
        console.log('\n--- 验证结束 ---');
        // 可选：清理测试数据
        // db.run('DELETE FROM groups WHERE group_id = ?', [newGroupId]);
    }
}

// Wait a bit for DB connection if needed, then run
setTimeout(verify, 1000);
