const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../../.env') });

// 配置对象
const config = {
  // 应用基础配置
  app: {
    name: 'MsgBot Multi-Channel Push System',
    version: '1.0.0',
    port: parseInt(process.env.PORT) || 3000,
    env: process.env.NODE_ENV || 'development',
    timezone: 'Asia/Shanghai'
  },

  // 数据库配置
  database: {
    mongodb: {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/msgbot',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferMaxEntries: 0,
        bufferCommands: false
      }
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      options: {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
        lazyConnect: true,
        keepAlive: 30000
      }
    }
  },

  // Twitter API 配置
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    
    // API 限制配置
    rateLimit: {
      searchTweets: 300, // 每15分钟
      userTweets: 900,   // 每15分钟
      streamRules: 25    // 每15分钟
    },
    
    // 采集配置
    collection: {
      maxTweetsPerRequest: 100,
      defaultKeywords: ['AI', '人工智能', 'ChatGPT', '科技', 'technology'],
      excludeKeywords: ['广告', 'ad', 'spam'],
      minEngagement: 5,
      languages: ['zh', 'en'],
      includeRetweets: false
    }
  },

  // 微信配置
  wechat: {
    appId: process.env.WECHAT_APP_ID,
    appSecret: process.env.WECHAT_APP_SECRET,
    templateId: process.env.WECHAT_TEMPLATE_ID,
    
    // API配置
    api: {
      baseUrl: 'https://api.weixin.qq.com',
      timeout: 10000,
      retries: 3
    },
    
    // 推送配置
    push: {
      maxContentLength: 200,
      defaultColor: '#173177',
      clickUrl: 'https://your-miniprogram.com'
    }
  },

  // Telegram 配置
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    
    // API配置
    api: {
      baseUrl: 'https://api.telegram.org',
      timeout: 10000,
      retries: 3
    },
    
    // 推送配置
    push: {
      parseMode: 'HTML',
      disableWebPagePreview: false,
      maxMessageLength: 4096,
      maxCaptionLength: 1024
    }
  },

  // Discord 配置
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    channelId: process.env.DISCORD_CHANNEL_ID,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    
    // 推送配置
    push: {
      maxContentLength: 2000,
      maxEmbedLength: 6000,
      color: 0x1DA1F2, // Twitter蓝色
      thumbnailUrl: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
    }
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  },

  // 推送系统配置
  push: {
    // 推送间隔（分钟）
    intervalMinutes: parseInt(process.env.PUSH_INTERVAL_MINUTES) || 5,
    
    // 每次推送最大推文数
    maxTweetsPerPush: parseInt(process.env.MAX_TWEETS_PER_PUSH) || 10,
    
    // 推文缓存时间（小时）
    tweetCacheHours: parseInt(process.env.TWEET_CACHE_HOURS) || 24,
    
    // 重试配置
    retry: {
      maxAttempts: 3,
      delayMs: 5000,
      backoffMultiplier: 2
    },
    
    // 批处理配置
    batch: {
      size: 50,
      concurrency: 5,
      delayBetweenBatches: 1000
    }
  },

  // 消息队列配置
  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    },
    
    // 队列配置
    jobs: {
      // Twitter采集任务
      twitterCollection: {
        name: 'twitter-collection',
        concurrency: 2,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      },
      
      // 推送任务
      pushNotification: {
        name: 'push-notification',
        concurrency: 10,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      },
      
      // 数据处理任务
      dataProcessing: {
        name: 'data-processing',
        concurrency: 5,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 3000
        }
      }
    }
  },

  // 安全配置
  security: {
    // 密码加密
    bcrypt: {
      saltRounds: 12
    },
    
    // CORS配置
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
      optionsSuccessStatus: 200
    },
    
    // 限流配置
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 最大请求数
      message: '请求过于频繁，请稍后再试',
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: true,
      path: process.env.LOG_FILE_PATH || 'logs/app.log',
      maxSize: '20m',
      maxFiles: '14d'
    },
    console: {
      enabled: true,
      colorize: true
    },
    
    // 日志格式
    format: {
      timestamp: true,
      errors: { stack: true }
    }
  },

  // 监控配置
  monitoring: {
    // 健康检查
    healthCheck: {
      enabled: true,
      interval: 30000, // 30秒
      timeout: 5000    // 5秒
    },
    
    // 性能监控
    performance: {
      enabled: true,
      sampleRate: 0.1 // 10%采样率
    },
    
    // 错误报告
    errorReporting: {
      enabled: true,
      maxErrors: 100,
      resetInterval: 3600000 // 1小时
    }
  },

  // 缓存配置
  cache: {
    // 默认TTL（秒）
    defaultTTL: 3600,
    
    // 不同类型数据的TTL
    ttl: {
      userProfile: 1800,    // 30分钟
      tweetData: 3600,      // 1小时
      subscriptions: 900,   // 15分钟
      systemConfig: 7200    // 2小时
    }
  }
};

// 验证必需的环境变量
function validateConfig() {
  const requiredEnvVars = [
    'MONGODB_URI',
    'REDIS_URL',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn('警告: 以下环境变量未设置:', missingVars.join(', '));
    console.warn('请检查 .env 文件配置');
  }
  
  // 验证Twitter配置
  if (!config.twitter.bearerToken && !config.twitter.apiKey) {
    console.warn('警告: Twitter API 配置不完整，Twitter功能将无法使用');
  }
  
  return config;
}

// 获取当前环境配置
function getEnvConfig() {
  const env = config.app.env;
  
  // 根据环境调整配置
  if (env === 'production') {
    config.logging.level = 'warn';
    config.logging.console.enabled = false;
    config.security.cors.origin = process.env.PRODUCTION_ORIGIN || 'https://yourdomain.com';
  } else if (env === 'development') {
    config.logging.level = 'debug';
    config.monitoring.performance.sampleRate = 1.0; // 开发环境100%采样
  }
  
  return config;
}

module.exports = validateConfig();
module.exports.getEnvConfig = getEnvConfig;
module.exports.validateConfig = validateConfig;