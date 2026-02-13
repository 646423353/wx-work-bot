const express = require('express');
const bodyParser = require('body-parser');
const bodyParserXml = require('body-parser-xml');
const cors = require('cors');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 配置XML解析器
bodyParserXml(bodyParser);

const config = require('./config/config');
const db = require('./backend/utils/database');
const monitorService = require('./backend/services/monitorService');
const apiRoutes = require('./backend/routes/api');

// 创建Express应用
const app = express();

// 配置中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.xml({ limit: '1MB', xmlParseOptions: { normalize: true, normalizeTags: true, explicitArray: false } }));
app.use(cors());

// 统一设置响应字符集为UTF-8
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// 静态文件服务
// app.use(express.static('./frontend/public'));

// API路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (req, res) => {
    res.redirect('http://localhost:3002');
});

// 启动服务器
const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`服务器启动成功，监听地址: http://${config.server.host}:${config.server.port}`);
    
    // 启动监控服务
    monitorService.startMonitor();
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('正在关闭服务器...');
    
    // 停止监控服务
    monitorService.stopMonitor();
    
    // 关闭数据库连接
    db.close((err) => {
        if (err) {
            console.error('关闭数据库连接失败:', err.message);
        } else {
            console.log('数据库连接已关闭');
        }
        
        // 关闭服务器
        server.close(() => {
            console.log('服务器已关闭');
            process.exit(0);
        });
    });
});