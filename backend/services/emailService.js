const nodemailer = require('nodemailer');
const config = require('../../config/config');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.email.host,
            port: config.email.port,
            secure: config.email.secure,
            auth: {
                user: config.email.auth.user,
                pass: config.email.auth.pass
            }
        });
    }
    
    // 发送邮件
    async sendEmail(to, subject, text, html = '') {
        try {
            const mailOptions = {
                from: config.email.from,
                to: to,
                subject: subject,
                text: text,
                html: html
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log('邮件发送成功:', info.messageId);
            return true;
        } catch (error) {
            console.error('邮件发送失败:', error.message);
            return false;
        }
    }
    
    // 发送未回复消息汇总邮件
    async sendUnrepliedSummaryEmail(to, unrepliedMessages) {
        try {
            // 构建邮件内容
            let text = '【企业微信消息监控助手】未回复消息汇总\n\n';
            let html = '<h2>企业微信消息监控助手 - 未回复消息汇总</h2><table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse;"><tr><th>群聊名称</th><th>消息内容</th><th>发送时间</th><th>超时时长</th></tr>';
            
            unrepliedMessages.forEach(msg => {
                const now = new Date();
                const sentAt = new Date(msg.sent_at);
                const hours = Math.floor((now - sentAt) / (1000 * 60 * 60));
                const minutes = Math.floor(((now - sentAt) % (1000 * 60 * 60)) / (1000 * 60));
                const duration = `${hours}小时${minutes}分钟`;
                
                text += `群聊: ${msg.group_name}\n消息: ${msg.content}\n发送时间: ${msg.sent_at}\n超时时长: ${duration}\n\n`;
                html += `<tr><td>${msg.group_name}</td><td>${msg.content}</td><td>${msg.sent_at}</td><td>${duration}</td></tr>`;
            });
            
            html += '</table><p>请及时处理这些未回复消息，确保客户服务质量。</p>';
            
            // 发送邮件
            return await this.sendEmail(to, '【企业微信消息监控助手】未回复消息汇总', text, html);
        } catch (error) {
            console.error('发送未回复消息汇总邮件失败:', error.message);
            return false;
        }
    }
}

module.exports = new EmailService();