#!/usr/bin/env node

/**
 * MsgBot API Server
 * 主服务器启动文件
 */

const { app, start } = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const CollectionScheduler = require('./collectors/CollectionScheduler');
const PushScheduler = require('./services/PushScheduler');
const QueueManager = require('./services/QueueManager');

// 启动服务器和相关服务
async function startServer() {
  try {
    logger.info('Starting MsgBot API Server...', {
      version: config.app.version,
      environment: config.app.environment,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    });
    
    // 启动HTTP服务器
    const server = await start(config.app.port);
    
    // 初始化队列管理器
    logger.info('Initializing Queue Manager...');
    const queueManager = new QueueManager();
    await queueManager.initialize();
    
    // 启动数据采集调度器
    if (config.features.twitterCollection) {
      logger.info('Starting Twitter Collection Scheduler...');
      const collectionScheduler = new CollectionScheduler();
      await collectionScheduler.start();
      
      // 保存调度器实例以便后续使用
      global.collectionScheduler = collectionScheduler;
    }
    
    // 启动推送调度器
    if (config.features.pushNotifications) {
      logger.info('Starting Push Scheduler...');
      const pushScheduler = new PushScheduler();
      await pushScheduler.start();
      
      // 保存调度器实例以便后续使用
      global.pushScheduler = pushScheduler;
    }
    
    // 保存全局实例
    global.queueManager = queueManager;
    
    logger.info('MsgBot API Server started successfully', {
      port: config.app.port,
      environment: config.app.environment,
      features: {
        twitterCollection: config.features.twitterCollection,
        pushNotifications: config.features.pushNotifications,
        webhooks: config.features.webhooks
      }
    });
    
    // 输出启动信息
    console.log(`
🚀 MsgBot API Server is running!`);
    console.log(`📡 Server: http://localhost:${config.app.port}`);
    console.log(`📚 API Documentation: http://localhost:${config.app.port}/api`);
    console.log(`🔍 Health Check: http://localhost:${config.app.port}/api/health`);
    console.log(`🌍 Environment: ${config.app.environment}`);
    console.log(`📦 Version: ${config.app.version}`);
    console.log(`\n✨ Ready to serve requests!\n`);
    
    return server;
  } catch (error) {
    logger.error('Failed to start MsgBot API Server:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Server startup failed:', error);
    process.exit(1);
  });
}

module.exports = { startServer };