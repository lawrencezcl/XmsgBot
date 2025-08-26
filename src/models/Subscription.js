const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  // 关联用户
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 订阅基本信息
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // 关键词配置
  keywords: [{
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  }],
  
  // 过滤条件
  filters: {
    // 语言过滤
    languages: [{
      type: String,
      enum: ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'pt', 'ru', 'ar'],
      default: ['zh', 'en']
    }],
    
    // 最小点赞数
    minLikes: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // 最小转发数
    minRetweets: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // 最小回复数
    minReplies: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // 是否包含媒体
    hasMedia: {
      type: String,
      enum: ['any', 'required', 'excluded'],
      default: 'any'
    },
    
    // 是否包含链接
    hasLinks: {
      type: String,
      enum: ['any', 'required', 'excluded'],
      default: 'any'
    },
    
    // 排除的关键词
    excludeKeywords: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    
    // 指定用户（可选）
    specificUsers: [{
      username: { type: String, trim: true },
      userId: { type: String, trim: true }
    }]
  },
  
  // 推送设置
  pushSettings: {
    // 推送渠道
    channels: [{
      type: String,
      enum: ['wechat', 'telegram', 'discord'],
      required: true
    }],
    
    // 推送频率
    frequency: {
      type: String,
      enum: ['realtime', 'every_5min', 'every_15min', 'hourly', 'daily'],
      default: 'hourly'
    },
    
    // 推送时间段（24小时制）
    activeHours: {
      start: { type: Number, min: 0, max: 23, default: 9 },
      end: { type: Number, min: 0, max: 23, default: 22 }
    },
    
    // 每次推送最大数量
    maxTweetsPerPush: {
      type: Number,
      default: 5,
      min: 1,
      max: 20
    },
    
    // 推送模板
    template: {
      type: String,
      enum: ['simple', 'detailed', 'custom'],
      default: 'simple'
    },
    
    // 自定义推送模板
    customTemplate: {
      type: String,
      default: ''
    }
  },
  
  // 订阅状态
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 统计信息
  stats: {
    totalMatches: { type: Number, default: 0 },
    totalPushes: { type: Number, default: 0 },
    lastMatchAt: { type: Date, default: null },
    lastPushAt: { type: Date, default: null },
    avgMatchesPerDay: { type: Number, default: 0 }
  },
  
  // 最后处理的推文ID（用于增量处理）
  lastProcessedTweetId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// 验证关键词数量
subscriptionSchema.pre('save', function(next) {
  if (this.keywords.length === 0) {
    return next(new Error('至少需要一个关键词'));
  }
  if (this.keywords.length > 20) {
    return next(new Error('关键词数量不能超过20个'));
  }
  next();
});

// 验证推送渠道
subscriptionSchema.pre('save', function(next) {
  if (this.pushSettings.channels.length === 0) {
    return next(new Error('至少需要选择一个推送渠道'));
  }
  next();
});

// 检查关键词是否匹配
subscriptionSchema.methods.matchesKeywords = function(text) {
  const lowerText = text.toLowerCase();
  
  // 检查是否包含任一关键词
  const hasKeyword = this.keywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (!hasKeyword) return false;
  
  // 检查是否包含排除关键词
  const hasExcludeKeyword = this.filters.excludeKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  return !hasExcludeKeyword;
};

// 检查推文是否符合过滤条件
subscriptionSchema.methods.matchesFilters = function(tweet) {
  const filters = this.filters;
  
  // 检查点赞数
  if (tweet.public_metrics.like_count < filters.minLikes) return false;
  
  // 检查转发数
  if (tweet.public_metrics.retweet_count < filters.minRetweets) return false;
  
  // 检查回复数
  if (tweet.public_metrics.reply_count < filters.minReplies) return false;
  
  // 检查媒体要求
  const hasMedia = tweet.attachments && tweet.attachments.media_keys && tweet.attachments.media_keys.length > 0;
  if (filters.hasMedia === 'required' && !hasMedia) return false;
  if (filters.hasMedia === 'excluded' && hasMedia) return false;
  
  // 检查链接要求
  const hasLinks = tweet.entities && tweet.entities.urls && tweet.entities.urls.length > 0;
  if (filters.hasLinks === 'required' && !hasLinks) return false;
  if (filters.hasLinks === 'excluded' && hasLinks) return false;
  
  return true;
};

// 更新统计信息
subscriptionSchema.methods.updateStats = function(type) {
  const now = new Date();
  
  if (type === 'match') {
    this.stats.totalMatches += 1;
    this.stats.lastMatchAt = now;
  } else if (type === 'push') {
    this.stats.totalPushes += 1;
    this.stats.lastPushAt = now;
  }
  
  return this.save();
};

// 检查是否在活跃时间段内
subscriptionSchema.methods.isInActiveHours = function() {
  const now = new Date();
  const currentHour = now.getHours();
  const { start, end } = this.pushSettings.activeHours;
  
  if (start <= end) {
    return currentHour >= start && currentHour <= end;
  } else {
    // 跨天的情况（如22点到次日6点）
    return currentHour >= start || currentHour <= end;
  }
};

// 索引
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ isActive: 1 });
subscriptionSchema.index({ keywords: 1 });
subscriptionSchema.index({ 'pushSettings.frequency': 1 });
subscriptionSchema.index({ createdAt: -1 });
subscriptionSchema.index({ 'stats.lastPushAt': 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);