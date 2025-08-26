# MsgBot - 多渠道推送系统

一个功能强大的多渠道推送系统，支持从Twitter采集热门推文并推送到微信小程序、Telegram机器人和Discord机器人。

## 功能特性

### 🐦 Twitter数据采集
- 实时监控Twitter平台热门推文
- 支持关键词和主题筛选
- 智能去重和内容过滤
- 高效的数据缓存机制

### 📱 多渠道推送
- **微信小程序**: 模板消息推送，用户订阅管理
- **Telegram机器人**: 频道推送，支持富文本格式
- **Discord机器人**: Webhook推送，支持嵌入消息

### 🔧 系统特性
- RESTful API设计
- 用户订阅管理
- 消息队列处理
- 实时推送调度
- 完整的日志记录
- Docker容器化部署

## 技术栈

- **后端**: Node.js + Express.js
- **数据库**: MongoDB + Redis
- **消息队列**: Bull (基于Redis)
- **API集成**: Twitter API v2, 微信API, Telegram Bot API, Discord API
- **部署**: Docker + Docker Compose

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker & Docker Compose

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd MsgBot
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入相应的API密钥和配置
```

4. **启动数据库服务**
```bash
npm run docker:up
```

5. **启动应用**
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### API密钥配置

#### Twitter API
1. 访问 [Twitter Developer Portal](https://developer.twitter.com/)
2. 创建应用并获取API密钥
3. 在`.env`文件中配置相关密钥

#### 微信小程序
1. 登录微信公众平台
2. 获取AppID和AppSecret
3. 配置模板消息ID

#### Telegram Bot
1. 与 @BotFather 对话创建机器人
2. 获取Bot Token
3. 获取目标频道或群组ID

#### Discord Bot
1. 访问 [Discord Developer Portal](https://discord.com/developers/applications)
2. 创建应用和机器人
3. 获取Bot Token和频道ID

## 项目结构

```
MsgBot/
├── src/
│   ├── app.js              # 应用入口
│   ├── config/             # 配置文件
│   ├── models/             # 数据模型
│   ├── routes/             # API路由
│   ├── services/           # 业务逻辑
│   ├── collectors/         # 数据采集器
│   ├── pushers/           # 推送服务
│   ├── middleware/        # 中间件
│   └── utils/             # 工具函数
├── logs/                  # 日志文件
├── scripts/               # 脚本文件
├── tests/                 # 测试文件
├── docker-compose.yml     # Docker配置
├── package.json          # 项目配置
└── README.md             # 项目文档
```

## API文档

### 用户管理
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取用户信息

### 订阅管理
- `GET /api/subscriptions` - 获取订阅列表
- `POST /api/subscriptions` - 创建订阅
- `PUT /api/subscriptions/:id` - 更新订阅
- `DELETE /api/subscriptions/:id` - 删除订阅

### 推文管理
- `GET /api/tweets` - 获取推文列表
- `GET /api/tweets/:id` - 获取推文详情

## 开发指南

### 本地开发

```bash
# 启动开发服务器
npm run dev

# 运行测试
npm test

# 代码检查
npm run lint
```

### 数据库管理

- MongoDB管理界面: http://localhost:8082
- Redis管理界面: http://localhost:8081

## 部署说明

### Docker部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

## 监控和日志

- 应用日志存储在 `logs/` 目录
- 支持多级别日志记录
- 集成系统监控和错误报告

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue或联系开发团队。