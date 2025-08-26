const mongoose = require('mongoose');

const tweetSchema = new mongoose.Schema({
  // Twitter原始数据
  tweetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000
  },
  
  // 作者信息
  author: {
    id: { type: String, required: true },
    username: { type: String, required: true },
    name: { type: String, required: true },
    verified: { type: Boolean, default: false },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    tweet_count: { type: Number, default: 0 },
    profile_image_url: { type: String, default: '' }
  },
  
  // 推文统计数据
  public_metrics: {
    retweet_count: { type: Number, default: 0 },
    like_count: { type: Number, default: 0 },
    reply_count: { type: Number, default: 0 },
    quote_count: { type: Number, default: 0 }
  },
  
  // 推文元数据
  metadata: {
    created_at: { type: Date, required: true },
    lang: { type: String, default: 'und' },
    source: { type: String, default: '' },
    possibly_sensitive: { type: Boolean, default: false },
    reply_settings: { type: String, default: 'everyone' }
  },
  
  // 媒体附件
  attachments: {
    media_keys: [String],
    poll_ids: [String]
  },
  
  // 实体信息
  entities: {
    urls: [{
      start: Number,
      end: Number,
      url: String,
      expanded_url: String,
      display_url: String,
      unwound_url: String
    }],
    hashtags: [{
      start: Number,
      end: Number,
      tag: String
    }],
    mentions: [{
      start: Number,
      end: Number,
      username: String,
      id: String
    }],
    cashtags: [{
      start: Number,
      end: Number,
      tag: String
    }]
  },
  
  // 上下文注释
  context_annotations: [{
    domain: {
      id: String,
      name: String,
      description: String
    },
    entity: {
      id: String,
      name: String,
      description: String
    }
  }],
  
  // 对话信息
  conversation_id: String,
  in_reply_to_user_id: String,
  referenced_tweets: [{
    type: {
      type: String,
      enum: ['retweeted', 'quoted', 'replied_to']
    },
    id: String
  }],
  
  // 地理位置信息
  geo: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    },
    place_id: String,
    place_name: String
  },
  
  // 处理状态
  processing: {
    isProcessed: { type: Boolean, default: false },
    processedAt: { type: Date, default: null },
    matchedSubscriptions: [{
      subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subscription'
      },
      matchedKeywords: [String],
      matchScore: { type: Number, default: 0 }
    }],
    totalMatches: { type: Number, default: 0 }
  },
  
  // 推送状态
  pushStatus: {
    isPushed: { type: Boolean, default: false },
    pushedAt: { type: Date, default: null },
    pushChannels: [{
      channel: {
        type: String,
        enum: ['wechat', 'telegram', 'discord']
      },
      status: {
        type: String,
        enum: ['pending', 'success', 'failed'],
        default: 'pending'
      },
      pushedAt: Date,
      error: String,
      messageId: String
    }],
    totalPushes: { type: Number, default: 0 }
  },
  
  // 内容分析
  analysis: {
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      default: 'neutral'
    },
    topics: [String],
    keywords: [String],
    language: { type: String, default: 'und' },
    readability_score: { type: Number, default: 0 },
    spam_score: { type: Number, default: 0 }
  },
  
  // 热度评分
  hotness_score: {
    type: Number,
    default: 0,
    index: true
  },
  
  // 数据来源
  source_info: {
    collected_at: { type: Date, default: Date.now },
    collection_method: {
      type: String,
      enum: ['stream', 'search', 'manual'],
      default: 'stream'
    },
    collector_version: { type: String, default: '1.0.0' }
  }
}, {
  timestamps: true
});

// 计算热度评分
tweetSchema.methods.calculateHotnessScore = function() {
  const metrics = this.public_metrics;
  const ageInHours = (Date.now() - this.metadata.created_at.getTime()) / (1000 * 60 * 60);
  
  // 基础分数：互动数据加权
  let baseScore = (
    metrics.like_count * 1 +
    metrics.retweet_count * 2 +
    metrics.reply_count * 1.5 +
    metrics.quote_count * 1.8
  );
  
  // 作者影响力加权
  const authorWeight = Math.min(this.author.followers_count / 10000, 5);
  baseScore *= (1 + authorWeight * 0.1);
  
  // 认证用户加权
  if (this.author.verified) {
    baseScore *= 1.2;
  }
  
  // 时间衰减
  const timeDecay = Math.exp(-ageInHours / 24); // 24小时半衰期
  
  this.hotness_score = Math.round(baseScore * timeDecay);
  return this.hotness_score;
};

// 检查是否为高质量推文
tweetSchema.methods.isHighQuality = function() {
  const metrics = this.public_metrics;
  const totalEngagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
  
  // 基本质量标准
  if (totalEngagement < 5) return false;
  if (this.text.length < 20) return false;
  if (this.analysis.spam_score > 0.7) return false;
  
  return true;
};

// 获取推文摘要
tweetSchema.methods.getSummary = function() {
  let summary = this.text;
  if (summary.length > 100) {
    summary = summary.substring(0, 97) + '...';
  }
  
  return {
    id: this.tweetId,
    text: summary,
    author: this.author.username,
    metrics: this.public_metrics,
    created_at: this.metadata.created_at,
    hotness_score: this.hotness_score
  };
};

// 标记为已处理
tweetSchema.methods.markAsProcessed = function(matchedSubscriptions = []) {
  this.processing.isProcessed = true;
  this.processing.processedAt = new Date();
  this.processing.matchedSubscriptions = matchedSubscriptions;
  this.processing.totalMatches = matchedSubscriptions.length;
  
  return this.save();
};

// 更新推送状态
tweetSchema.methods.updatePushStatus = function(channel, status, messageId = null, error = null) {
  const channelStatus = this.pushStatus.pushChannels.find(ch => ch.channel === channel);
  
  if (channelStatus) {
    channelStatus.status = status;
    channelStatus.pushedAt = new Date();
    if (messageId) channelStatus.messageId = messageId;
    if (error) channelStatus.error = error;
  } else {
    this.pushStatus.pushChannels.push({
      channel,
      status,
      pushedAt: new Date(),
      messageId,
      error
    });
  }
  
  // 更新总体推送状态
  const allSuccess = this.pushStatus.pushChannels.every(ch => ch.status === 'success');
  const anySuccess = this.pushStatus.pushChannels.some(ch => ch.status === 'success');
  
  if (allSuccess) {
    this.pushStatus.isPushed = true;
    this.pushStatus.pushedAt = new Date();
  }
  
  if (anySuccess) {
    this.pushStatus.totalPushes += 1;
  }
  
  return this.save();
};

// 索引
tweetSchema.index({ tweetId: 1 }, { unique: true });
tweetSchema.index({ 'metadata.created_at': -1 });
tweetSchema.index({ 'processing.isProcessed': 1 });
tweetSchema.index({ 'pushStatus.isPushed': 1 });
tweetSchema.index({ hotness_score: -1 });
tweetSchema.index({ 'analysis.keywords': 1 });
tweetSchema.index({ 'author.username': 1 });
tweetSchema.index({ 'metadata.lang': 1 });

// 复合索引
tweetSchema.index({ 
  'processing.isProcessed': 1, 
  'metadata.created_at': -1 
});
tweetSchema.index({ 
  'pushStatus.isPushed': 1, 
  hotness_score: -1 
});

module.exports = mongoose.model('Tweet', tweetSchema);