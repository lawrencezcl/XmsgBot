const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // 基本信息
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线']
  },
  
  // 推送渠道配置
  pushChannels: {
    wechat: {
      enabled: { type: Boolean, default: false },
      openid: { type: String, default: '' },
      unionid: { type: String, default: '' },
      nickname: { type: String, default: '' },
      avatar: { type: String, default: '' }
    },
    telegram: {
      enabled: { type: Boolean, default: false },
      chatId: { type: String, default: '' },
      username: { type: String, default: '' },
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' }
    },
    discord: {
      enabled: { type: Boolean, default: false },
      userId: { type: String, default: '' },
      username: { type: String, default: '' },
      discriminator: { type: String, default: '' },
      avatar: { type: String, default: '' },
      webhookUrl: { type: String, default: '' }
    }
  },
  
  // 用户偏好设置
  preferences: {
    language: {
      type: String,
      enum: ['zh-CN', 'zh-TW', 'en-US', 'ja-JP'],
      default: 'zh-CN'
    },
    timezone: {
      type: String,
      default: 'Asia/Shanghai'
    },
    pushFrequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      default: 'hourly'
    },
    maxPushPerDay: {
      type: Number,
      default: 50,
      min: 1,
      max: 200
    }
  },
  
  // 账户状态
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  },
  
  // 验证状态
  verification: {
    email: {
      isVerified: { type: Boolean, default: false },
      verificationToken: { type: String, default: '' },
      verifiedAt: { type: Date, default: null }
    }
  },
  
  // 统计信息
  stats: {
    totalSubscriptions: { type: Number, default: 0 },
    totalPushes: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now }
  },
  
  // 安全设置
  security: {
    lastPasswordChange: { type: Date, default: Date.now },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' }
  }
}, {
  timestamps: true
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 检查账户是否被锁定
userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

// 增加登录尝试次数
userSchema.methods.incLoginAttempts = function() {
  // 如果之前有锁定时间且已过期，重置尝试次数
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  // 如果达到最大尝试次数，锁定账户
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { 'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000 }; // 锁定2小时
  }
  
  return this.updateOne(updates);
};

// 重置登录尝试
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

// 检查推送渠道是否已配置
userSchema.methods.hasEnabledChannel = function(channel) {
  return this.pushChannels[channel] && this.pushChannels[channel].enabled;
};

// 获取已启用的推送渠道
userSchema.methods.getEnabledChannels = function() {
  const channels = [];
  Object.keys(this.pushChannels).forEach(channel => {
    if (this.pushChannels[channel].enabled) {
      channels.push(channel);
    }
  });
  return channels;
};

// 更新最后活跃时间
userSchema.methods.updateLastActive = function() {
  this.stats.lastActiveAt = new Date();
  return this.save();
};

// 索引
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ status: 1 });
userSchema.index({ 'stats.lastActiveAt': -1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);