// MongoDB初始化脚本
// 创建数据库和初始集合

db = db.getSiblingDB('msgbot');

// 创建用户集合
db.createCollection('users');
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "createdAt": 1 });

// 创建订阅集合
db.createCollection('subscriptions');
db.subscriptions.createIndex({ "userId": 1 });
db.subscriptions.createIndex({ "keywords": 1 });
db.subscriptions.createIndex({ "isActive": 1 });

// 创建推文集合
db.createCollection('tweets');
db.tweets.createIndex({ "tweetId": 1 }, { unique: true });
db.tweets.createIndex({ "createdAt": 1 });
db.tweets.createIndex({ "keywords": 1 });
db.tweets.createIndex({ "isProcessed": 1 });

// 创建推送记录集合
db.createCollection('pushrecords');
db.pushrecords.createIndex({ "userId": 1 });
db.pushrecords.createIndex({ "tweetId": 1 });
db.pushrecords.createIndex({ "channel": 1 });
db.pushrecords.createIndex({ "createdAt": 1 });

// 创建系统配置集合
db.createCollection('systemconfigs');
db.systemconfigs.createIndex({ "key": 1 }, { unique: true });

// 插入默认系统配置
db.systemconfigs.insertMany([
  {
    key: 'twitter_keywords',
    value: ['AI', '人工智能', 'ChatGPT', '科技', 'technology'],
    description: '默认Twitter关键词列表',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    key: 'push_interval',
    value: 5,
    description: '推送间隔（分钟）',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    key: 'max_tweets_per_push',
    value: 10,
    description: '每次推送最大推文数量',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('MongoDB初始化完成！');
print('已创建数据库: msgbot');
print('已创建集合: users, subscriptions, tweets, pushrecords, systemconfigs');
print('已创建索引和默认配置');