const mongoose = require('mongoose');

const pushRecordSchema = new mongoose.Schema({
  // 关联信息
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    required: true,
    index: true
  },
  tweetId: {
    type: String,
    required: true,
    index: true
  },
  
  // 推送渠道信息
  channel: {
    type: String,
    enum: ['wechat', 'telegram', 'discord'],
    required: true,
    index: true
  },
  
  // 推送状态
  status: {
    type: String,
    enum: ['pending', 'sending', 'success', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // 推送内容
  content: {
    title: { type: String, maxlength: 200 },
    body: { type: String, maxlength: 2000 },
    summary: { type: String, maxlength: 500 },
    url: { type: String },
    imageUrl: { type: String },
    template: { type: String, default: 'simple' }
  },
  
  // 推送配置
  pushConfig: {
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    },
    retryCount: { type: Number, default: 0, max: 5 },
    maxRetries: { type: Number, default: 3 },
    retryDelay: { type: Number, default: 300 }, // 秒
    timeout: { type: Number, default: 30 } // 秒
  },
  
  // 推送结果
  result: {
    messageId: { type: String }, // 第三方平台返回的消息ID
    deliveryTime: { type: Date }, // 实际发送时间
    responseTime: { type: Number }, // 响应时间（毫秒）
    errorCode: { type: String },
    errorMessage: { type: String },
    rawResponse: { type: mongoose.Schema.Types.Mixed } // 原始响应数据
  },
  
  // 用户交互数据（如果支持）
  interaction: {
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isClicked: { type: Boolean, default: false },
    clickedAt: { type: Date },
    clickCount: { type: Number, default: 0 },
    feedback: {
      type: String,
      enum: ['like', 'dislike', 'report', 'block'],
      default: null
    },
    feedbackAt: { type: Date }
  },
  
  // 推送时间信息
  timing: {
    scheduledAt: { type: Date }, // 计划推送时间
    startedAt: { type: Date }, // 开始推送时间
    completedAt: { type: Date }, // 完成推送时间
    duration: { type: Number }, // 推送耗时（毫秒）
    queueTime: { type: Number } // 队列等待时间（毫秒）
  },
  
  // 重试记录
  retryHistory: [{
    attempt: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
    error: { type: String },
    duration: { type: Number }
  }],
  
  // 推送批次信息
  batchInfo: {
    batchId: { type: String }, // 批次ID
    batchSize: { type: Number }, // 批次大小
    batchIndex: { type: Number }, // 在批次中的位置
    isBatchComplete: { type: Boolean, default: false }
  },
  
  // 元数据
  metadata: {
    userAgent: { type: String },
    ipAddress: { type: String },
    deviceType: { type: String },
    appVersion: { type: String, default: '1.0.0' },
    apiVersion: { type: String, default: 'v1' }
  }
}, {
  timestamps: true
});

// 标记推送开始
pushRecordSchema.methods.markAsStarted = function() {
  this.status = 'sending';
  this.timing.startedAt = new Date();
  
  if (this.timing.scheduledAt) {
    this.timing.queueTime = this.timing.startedAt.getTime() - this.timing.scheduledAt.getTime();
  }
  
  return this.save();
};

// 标记推送成功
pushRecordSchema.methods.markAsSuccess = function(messageId, responseTime = 0, rawResponse = null) {
  this.status = 'success';
  this.timing.completedAt = new Date();
  
  if (this.timing.startedAt) {
    this.timing.duration = this.timing.completedAt.getTime() - this.timing.startedAt.getTime();
  }
  
  this.result.messageId = messageId;
  this.result.deliveryTime = this.timing.completedAt;
  this.result.responseTime = responseTime;
  
  if (rawResponse) {
    this.result.rawResponse = rawResponse;
  }
  
  return this.save();
};

// 标记推送失败
pushRecordSchema.methods.markAsFailed = function(errorCode, errorMessage, rawResponse = null) {
  this.status = 'failed';
  this.timing.completedAt = new Date();
  
  if (this.timing.startedAt) {
    this.timing.duration = this.timing.completedAt.getTime() - this.timing.startedAt.getTime();
  }
  
  this.result.errorCode = errorCode;
  this.result.errorMessage = errorMessage;
  
  if (rawResponse) {
    this.result.rawResponse = rawResponse;
  }
  
  return this.save();
};

// 添加重试记录
pushRecordSchema.methods.addRetryAttempt = function(error, duration = 0) {
  this.pushConfig.retryCount += 1;
  
  this.retryHistory.push({
    attempt: this.pushConfig.retryCount,
    timestamp: new Date(),
    error: error,
    duration: duration
  });
  
  return this.save();
};

// 检查是否可以重试
pushRecordSchema.methods.canRetry = function() {
  return this.pushConfig.retryCount < this.pushConfig.maxRetries && 
         this.status === 'failed';
};

// 计算下次重试时间
pushRecordSchema.methods.getNextRetryTime = function() {
  if (!this.canRetry()) return null;
  
  // 指数退避策略
  const baseDelay = this.pushConfig.retryDelay * 1000; // 转换为毫秒
  const exponentialDelay = baseDelay * Math.pow(2, this.pushConfig.retryCount - 1);
  const jitter = Math.random() * 1000; // 添加随机抖动
  
  return new Date(Date.now() + exponentialDelay + jitter);
};

// 更新用户交互
pushRecordSchema.methods.updateInteraction = function(type, data = {}) {
  const now = new Date();
  
  switch (type) {
    case 'read':
      this.interaction.isRead = true;
      this.interaction.readAt = now;
      break;
    case 'click':
      this.interaction.isClicked = true;
      this.interaction.clickedAt = now;
      this.interaction.clickCount += 1;
      break;
    case 'feedback':
      this.interaction.feedback = data.feedback;
      this.interaction.feedbackAt = now;
      break;
  }
  
  return this.save();
};

// 获取推送摘要
pushRecordSchema.methods.getSummary = function() {
  return {
    id: this._id,
    channel: this.channel,
    status: this.status,
    content: {
      title: this.content.title,
      summary: this.content.summary
    },
    timing: {
      scheduledAt: this.timing.scheduledAt,
      completedAt: this.timing.completedAt,
      duration: this.timing.duration
    },
    result: {
      messageId: this.result.messageId,
      errorMessage: this.result.errorMessage
    },
    retryCount: this.pushConfig.retryCount
  };
};

// 静态方法：获取推送统计
pushRecordSchema.statics.getStats = function(userId, timeRange = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          channel: '$channel',
          status: '$status'
        },
        count: { $sum: 1 },
        avgResponseTime: { $avg: '$result.responseTime' }
      }
    },
    {
      $group: {
        _id: '$_id.channel',
        stats: {
          $push: {
            status: '$_id.status',
            count: '$count',
            avgResponseTime: '$avgResponseTime'
          }
        },
        totalCount: { $sum: '$count' }
      }
    }
  ]);
};

// 索引
pushRecordSchema.index({ userId: 1, createdAt: -1 });
pushRecordSchema.index({ subscriptionId: 1, createdAt: -1 });
pushRecordSchema.index({ tweetId: 1 });
pushRecordSchema.index({ channel: 1, status: 1 });
pushRecordSchema.index({ status: 1, 'timing.scheduledAt': 1 });
pushRecordSchema.index({ 'batchInfo.batchId': 1 });
pushRecordSchema.index({ createdAt: -1 });

// 复合索引
pushRecordSchema.index({ 
  userId: 1, 
  channel: 1, 
  status: 1, 
  createdAt: -1 
});

module.exports = mongoose.model('PushRecord', pushRecordSchema);