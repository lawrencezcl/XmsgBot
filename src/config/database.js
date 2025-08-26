const mongoose = require('mongoose');
const Redis = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

// MongoDB 连接管理
class DatabaseManager {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
    this.isConnected = false;
  }

  // 连接 MongoDB
  async connectMongoDB() {
    try {
      logger.info('正在连接 MongoDB...');
      
      // 设置 Mongoose 配置
      mongoose.set('strictQuery', false);
      
      // 连接数据库
      this.mongoConnection = await mongoose.connect(
        config.database.mongodb.uri,
        config.database.mongodb.options
      );
      
      logger.info('MongoDB 连接成功');
      
      // 监听连接事件
      mongoose.connection.on('connected', () => {
        logger.info('MongoDB 连接已建立');
      });
      
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB 连接错误:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB 连接已断开');
        this.isConnected = false;
      });
      
      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB 重新连接成功');
        this.isConnected = true;
      });
      
      this.isConnected = true;
      return this.mongoConnection;
      
    } catch (error) {
      logger.error('MongoDB 连接失败:', error);
      throw error;
    }
  }

  // 连接 Redis
  async connectRedis() {
    try {
      logger.info('正在连接 Redis...');
      
      // 创建 Redis 客户端
      this.redisClient = Redis.createClient({
        url: config.database.redis.url,
        ...config.database.redis.options
      });
      
      // 监听连接事件
      this.redisClient.on('connect', () => {
        logger.info('Redis 连接已建立');
      });
      
      this.redisClient.on('ready', () => {
        logger.info('Redis 连接就绪');
      });
      
      this.redisClient.on('error', (err) => {
        logger.error('Redis 连接错误:', err);
      });
      
      this.redisClient.on('end', () => {
        logger.warn('Redis 连接已关闭');
      });
      
      this.redisClient.on('reconnecting', () => {
        logger.info('Redis 正在重新连接...');
      });
      
      // 连接到 Redis
      await this.redisClient.connect();
      
      logger.info('Redis 连接成功');
      return this.redisClient;
      
    } catch (error) {
      logger.error('Redis 连接失败:', error);
      throw error;
    }
  }

  // 连接所有数据库
  async connectAll() {
    try {
      logger.info('正在初始化数据库连接...');
      
      // 并行连接数据库
      await Promise.all([
        this.connectMongoDB(),
        this.connectRedis()
      ]);
      
      logger.info('所有数据库连接成功');
      return {
        mongodb: this.mongoConnection,
        redis: this.redisClient
      };
      
    } catch (error) {
      logger.error('数据库连接失败:', error);
      throw error;
    }
  }

  // 断开所有连接
  async disconnectAll() {
    try {
      logger.info('正在断开数据库连接...');
      
      const promises = [];
      
      // 断开 MongoDB
      if (this.mongoConnection) {
        promises.push(mongoose.connection.close());
      }
      
      // 断开 Redis
      if (this.redisClient) {
        promises.push(this.redisClient.quit());
      }
      
      await Promise.all(promises);
      
      this.mongoConnection = null;
      this.redisClient = null;
      this.isConnected = false;
      
      logger.info('所有数据库连接已断开');
      
    } catch (error) {
      logger.error('断开数据库连接时出错:', error);
      throw error;
    }
  }

  // 检查连接状态
  async checkHealth() {
    const health = {
      mongodb: false,
      redis: false,
      overall: false
    };
    
    try {
      // 检查 MongoDB
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        health.mongodb = true;
      }
    } catch (error) {
      logger.error('MongoDB 健康检查失败:', error);
    }
    
    try {
      // 检查 Redis
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      logger.error('Redis 健康检查失败:', error);
    }
    
    health.overall = health.mongodb && health.redis;
    return health;
  }

  // 获取连接统计信息
  getConnectionStats() {
    const stats = {
      mongodb: {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      redis: {
        isOpen: this.redisClient ? this.redisClient.isOpen : false,
        isReady: this.redisClient ? this.redisClient.isReady : false
      }
    };
    
    return stats;
  }

  // 获取 MongoDB 实例
  getMongoDB() {
    if (!this.mongoConnection) {
      throw new Error('MongoDB 未连接');
    }
    return mongoose;
  }

  // 获取 Redis 实例
  getRedis() {
    if (!this.redisClient) {
      throw new Error('Redis 未连接');
    }
    return this.redisClient;
  }
}

// 创建数据库管理器实例
const dbManager = new DatabaseManager();

// 优雅关闭处理
process.on('SIGINT', async () => {
  logger.info('收到 SIGINT 信号，正在关闭数据库连接...');
  try {
    await dbManager.disconnectAll();
    process.exit(0);
  } catch (error) {
    logger.error('关闭数据库连接时出错:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  logger.info('收到 SIGTERM 信号，正在关闭数据库连接...');
  try {
    await dbManager.disconnectAll();
    process.exit(0);
  } catch (error) {
    logger.error('关闭数据库连接时出错:', error);
    process.exit(1);
  }
});

// 未捕获异常处理
process.on('uncaughtException', async (error) => {
  logger.error('未捕获的异常:', error);
  try {
    await dbManager.disconnectAll();
  } catch (disconnectError) {
    logger.error('断开数据库连接时出错:', disconnectError);
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('未处理的 Promise 拒绝:', reason);
  try {
    await dbManager.disconnectAll();
  } catch (disconnectError) {
    logger.error('断开数据库连接时出错:', disconnectError);
  }
  process.exit(1);
});

module.exports = dbManager;