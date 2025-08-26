// MongoDB初始化脚本
// 创建数据库和用户

print('Starting MongoDB initialization...');

// 切换到msgbot数据库
db = db.getSiblingDB('msgbot');

// 创建应用用户
db.createUser({
  user: 'msgbot_user',
  pwd: 'msgbot_password',
  roles: [
    {
      role: 'readWrite',
      db: 'msgbot'
    }
  ]
});

print('Created msgbot_user with readWrite permissions');

// 创建集合和索引
print('Creating collections and indexes...');

// 用户集合
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ status: 1 });
db.users.createIndex({ 'subscription.plan': 1 });
db.users.createIndex({ createdAt: 1 });
db.users.createIndex({ lastLoginAt: 1 });
print('Created users collection with indexes');

// 订阅集合
db.createCollection('subscriptions');
db.subscriptions.createIndex({ userId: 1 });
db.subscriptions.createIndex({ status: 1 });
db.subscriptions.createIndex({ keywords: 1 });
db.subscriptions.createIndex({ priority: 1 });
db.subscriptions.createIndex({ createdAt: 1 });
db.subscriptions.createIndex({ updatedAt: 1 });
db.subscriptions.createIndex({ userId: 1, status: 1 });
print('Created subscriptions collection with indexes');

// 推文集合
db.createCollection('tweets');
db.tweets.createIndex({ tweetId: 1 }, { unique: true });
db.tweets.createIndex({ authorId: 1 });
db.tweets.createIndex({ createdAt: 1 });
db.tweets.createIndex({ hotScore: -1 });
db.tweets.createIndex({ lang: 1 });
db.tweets.createIndex({ 'metrics.likeCount': -1 });
db.tweets.createIndex({ 'metrics.retweetCount': -1 });
db.tweets.createIndex({ 'metrics.replyCount': -1 });
db.tweets.createIndex({ keywords: 1 });
db.tweets.createIndex({ hasMedia: 1 });
db.tweets.createIndex({ hasLinks: 1 });
// 复合索引用于复杂查询
db.tweets.createIndex({ createdAt: 1, hotScore: -1 });
db.tweets.createIndex({ lang: 1, createdAt: 1 });
db.tweets.createIndex({ keywords: 1, createdAt: 1 });
print('Created tweets collection with indexes');

// 推送记录集合
db.createCollection('pushrecords');
db.pushrecords.createIndex({ userId: 1 });
db.pushrecords.createIndex({ subscriptionId: 1 });
db.pushrecords.createIndex({ tweetId: 1 });
db.pushrecords.createIndex({ channel: 1 });
db.pushrecords.createIndex({ status: 1 });
db.pushrecords.createIndex({ createdAt: 1 });
db.pushrecords.createIndex({ sentAt: 1 });
// 复合索引
db.pushrecords.createIndex({ userId: 1, status: 1 });
db.pushrecords.createIndex({ subscriptionId: 1, createdAt: 1 });
db.pushrecords.createIndex({ channel: 1, status: 1 });
print('Created pushrecords collection with indexes');

// 系统配置集合
db.createCollection('systemconfigs');
db.systemconfigs.createIndex({ key: 1 }, { unique: true });
print('Created systemconfigs collection with indexes');

// 插入默认系统配置
db.systemconfigs.insertMany([
  {
    key: 'twitter_collection',
    value: {
      enabled: true,
      keywords: ['AI', '人工智能', 'ChatGPT', 'OpenAI'],
      languages: ['zh', 'en'],
      minHotScore: 10,
      maxTweetsPerHour: 100
    },
    description: 'Twitter数据采集配置',
    updatedAt: new Date()
  },
  {
    key: 'push_settings',
    value: {
      enabled: true,
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 5000,
      rateLimits: {
        wechat: { requests: 100, window: 3600 },
        telegram: { requests: 30, window: 60 },
        discord: { requests: 50, window: 60 }
      }
    },
    description: '推送系统配置',
    updatedAt: new Date()
  },
  {
    key: 'user_limits',
    value: {
      free: {
        maxSubscriptions: 5,
        maxKeywordsPerSubscription: 10,
        maxPushesPerDay: 100
      },
      premium: {
        maxSubscriptions: 50,
        maxKeywordsPerSubscription: 50,
        maxPushesPerDay: 1000
      }
    },
    description: '用户限制配置',
    updatedAt: new Date()
  }
]);
print('Inserted default system configurations');

// 创建管理员用户（仅用于开发环境）
if (db.getName() === 'msgbot') {
  const bcrypt = require('bcrypt');
  const adminPassword = 'admin123456';
  
  // 注意：在实际生产环境中，应该使用更安全的密码
  db.users.insertOne({
    email: 'admin@msgbot.com',
    password: '$2b$12$LQv3c1yqBWVHxkd0LQ4YCOdtcuGdCGhf5YKSAaKtMN3pSmB8.2BtO', // admin123456
    nickname: '系统管理员',
    role: 'admin',
    status: 'active',
    subscription: {
      plan: 'premium',
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1年后过期
    },
    pushChannels: {
      wechat: { enabled: false },
      telegram: { enabled: false },
      discord: { enabled: false }
    },
    preferences: {
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      emailNotifications: true
    },
    stats: {
      totalSubscriptions: 0,
      totalPushes: 0,
      lastLoginAt: null
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  print('Created admin user: admin@msgbot.com / admin123456');
}

// 创建TTL索引用于自动清理过期数据
db.pushrecords.createIndex(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30天后自动删除
);
print('Created TTL index for pushrecords (30 days)');

db.tweets.createIndex(
  { createdAt: 1 },
  { 
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90天后自动删除
    partialFilterExpression: { hotScore: { $lt: 10 } } // 仅删除热度低的推文
  }
);
print('Created TTL index for low-score tweets (90 days)');

print('MongoDB initialization completed successfully!');
print('Database: msgbot');
print('Collections created: users, subscriptions, tweets, pushrecords, systemconfigs');
print('Indexes created for optimal query performance');
print('Default configurations inserted');
print('Admin user created (development only)');