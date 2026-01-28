const axios = require('axios');
const config = require('../../config/config');

class WechatService {
    constructor() {
        this.corpId = config.wechat.corpId;
        this.appSecret = config.wechat.appSecret;
        this.agentId = config.wechat.agentId;
        this.accessToken = '';
        this.tokenExpireTime = 0;
    }
    
    // 获取access_token
    async getAccessToken() {
        // 检查access_token是否有效
        if (this.accessToken && Date.now() < this.tokenExpireTime) {
            return this.accessToken;
        }
        
        try {
            const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.appSecret}`;
            const response = await axios.get(url);
            
            if (response.data.errcode === 0) {
                this.accessToken = response.data.access_token;
                // 设置过期时间，提前5分钟过期
                this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000;
                console.log('获取access_token成功');
                return this.accessToken;
            } else {
                console.error('获取access_token失败:', response.data.errmsg);
                return null;
            }
        } catch (error) {
            console.error('获取access_token请求失败:', error.message);
            return null;
        }
    }
    
    // 发送应用消息
    async sendAppMessage(toUser, message) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return false;
            }
            
            const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${accessToken}`;
            const data = {
                touser: toUser,
                agentid: this.agentId,
                msgtype: 'text',
                text: {
                    content: message
                },
                safe: 0
            };
            
            const response = await axios.post(url, data);
            
            if (response.data.errcode === 0) {
                console.log('发送应用消息成功');
                return true;
            } else {
                console.error('发送应用消息失败:', response.data.errmsg);
                return false;
            }
        } catch (error) {
            console.error('发送应用消息请求失败:', error.message);
            return false;
        }
    }
    
    // 发送群聊消息
    async sendGroupMessage(chatId, message) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return false;
            }
            
            const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${accessToken}`;
            const data = {
                chatid: chatId,
                msgtype: 'text',
                text: {
                    content: message
                }
            };
            
            const response = await axios.post(url, data);
            
            if (response.data.errcode === 0) {
                console.log('发送群聊消息成功');
                return true;
            } else {
                console.error('发送群聊消息失败:', response.data.errmsg);
                return false;
            }
        } catch (error) {
            console.error('发送群聊消息请求失败:', error.message);
            return false;
        }
    }
    
    // 获取群聊列表
    async getGroupList() {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return [];
            }
            
            const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/list?access_token=${accessToken}&size=100&offset=0`;
            const response = await axios.get(url);
            
            if (response.data.errcode === 0) {
                console.log('获取群聊列表成功');
                return response.data.chatlist || [];
            } else {
                console.error('获取群聊列表失败:', response.data.errmsg);
                return [];
            }
        } catch (error) {
            console.error('获取群聊列表请求失败:', error.message);
            return [];
        }
    }
    
    // 获取群聊详情
    async getGroupDetail(chatId) {
        try {
            const accessToken = await this.getAccessToken();
            if (!accessToken) {
                return null;
            }
            
            const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/get?access_token=${accessToken}&chatid=${chatId}`;
            const response = await axios.get(url);
            
            if (response.data.errcode === 0) {
                console.log('获取群聊详情成功');
                return response.data.chat_info;
            } else {
                console.error('获取群聊详情失败:', response.data.errmsg);
                return null;
            }
        } catch (error) {
            console.error('获取群聊详情请求失败:', error.message);
            return null;
        }
    }
}

module.exports = new WechatService();