const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const config = require('./config');
const logger = require('./utils/logger');
const DatabaseManager = require('./config/database');
const apiRoutes = require('./routes');

// 创建Express应用
const app = express();

// 信任代理（如果在反向代理后面运行）
app.set('trust proxy', 1);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS配置
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining', 'X-Rate-Limit-Reset']
}));

// 压缩响应
app.use(compression());

// 请求日志
if (config.app.environment !== 'test') {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim())
    },
    skip: (req) => {
      // 跳过健康检查和静态资源的日志
      return req.url === '/api/health' || req.url.startsWith('/static/');
    }
  }));
}

// 全局速率限制
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: config.security.rateLimit.max,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    retryAfter: Math.ceil(15 * 60) // 秒
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.security('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil(15 * 60)
    });
  }
});

app.use(globalLimiter);

// 请求体解析
app.use(express.json({ 
  limit: config.security.bodyLimit,
  verify: (req, res, buf) => {
    // 为webhook验证保存原始请求体
    if (req.url.startsWith('/api/webhooks/')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: config.security.bodyLimit 
}));

// 安全清理
app.use(mongoSanitize()); // 防止NoSQL注入
app.use(xss()); // 防止XSS攻击
app.use(hpp()); // 防止HTTP参数污染

// 请求ID中间件
app.use((req, res, next) => {
  req.id = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// 请求开始时间
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// 静态文件服务（如果需要）
if (config.app.serveStatic) {
  app.use('/static', express.static('public', {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));
}

// API路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MsgBot API Server',
    version: config.app.version,
    environment: config.app.environment,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    documentation: '/api'
  });
});

// 404处理
app.use('*', (req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  res.status(404).json({
    success: false,
    message: '请求的资源不存在',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  // 记录错误
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.id
  });
  
  // 根据错误类型返回不同的响应
  let statusCode = 500;
  let message = '服务器内部错误';
  
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '数据验证失败';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = '无效的数据格式';
  } else if (error.name === 'MongoError' && error.code === 11000) {
    statusCode = 409;
    message = '数据已存在';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的访问令牌';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '访问令牌已过期';
  }
  
  const errorResponse = {
    success: false,
    message,
    requestId: req.id,
    timestamp: new Date().toISOString()
  };
  
  // 在开发环境中包含错误堆栈
  if (config.app.environment === 'development') {
    errorResponse.error = error.message;
    errorResponse.stack = error.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// 响应时间记录中间件
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    const responseTime = Date.now() - req.startTime;
    
    // 记录响应时间
    if (responseTime > 1000) { // 超过1秒的请求记录为警告
      logger.warn('Slow request detected', {
        url: req.url,
        method: req.method,
        responseTime,
        statusCode: res.statusCode,
        requestId: req.id
      });
    }
    
    // 设置响应时间头
    res.setHeader('X-Response-Time', `${responseTime}ms`);
    
    return originalSend.call(this, data);
  };
  
  next();
});

// 优雅关闭处理
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // 停止接受新连接
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed');
      });
    }
    
    // 关闭数据库连接
    const dbManager = new DatabaseManager();
    await dbManager.disconnect();
    
    // 关闭队列连接
    const QueueManager = require('./services/QueueManager');
    const queueManager = new QueueManager();
    await queueManager.close();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// 监听进程信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// 导出应用和服务器实例
let server;

module.exports = {
  app,
  start: async (port = config.app.port) => {
    try {
      // 初始化数据库连接
      const dbManager = new DatabaseManager();
      await dbManager.connect();
      
      // 启动HTTP服务器
      server = app.listen(port, () => {
        logger.info(`MsgBot API Server started on port ${port}`, {
          environment: config.app.environment,
          version: config.app.version,
          pid: process.pid
        });
      });
      
      return server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  },
  stop: () => gracefulShutdown('manual')
};