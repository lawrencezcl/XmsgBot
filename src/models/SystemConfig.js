const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  // 配置键名
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100
  },
  
  // 配置值（支持多种数据类型）
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // 配置描述
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  
  // 配置分类
  category: {
    type: String,
    enum: [
      'twitter', 'wechat', 'telegram', 'discord',
      'system', 'push', 'security', 'performance',
      'monitoring', 'notification', 'cache', 'queue'
    ],
    default: 'system'
  },
  
  // 数据类型
  dataType: {
    type: String,
    enum: ['string', 'number', 'boolean', 'array', 'object', 'date'],
    required: true
  },
  
  // 是否为敏感配置
  isSensitive: {
    type: Boolean,
    default: false
  },
  
  // 是否可以通过API修改
  isEditable: {
    type: Boolean,
    default: true
  },
  
  // 是否需要重启服务生效
  requiresRestart: {
    type: Boolean,
    default: false
  },
  
  // 配置验证规则
  validation: {
    required: { type: Boolean, default: false },
    min: { type: Number },
    max: { type: Number },
    minLength: { type: Number },
    maxLength: { type: Number },
    pattern: { type: String }, // 正则表达式
    enum: [{ type: String }], // 枚举值
    customValidator: { type: String } // 自定义验证函数名
  },
  
  // 默认值
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // 配置历史记录
  history: [{
    value: { type: mongoose.Schema.Types.Mixed },
    changedBy: { type: String }, // 操作者
    changedAt: { type: Date, default: Date.now },
    reason: { type: String }, // 修改原因
    version: { type: String } // 版本号
  }],
  
  // 配置状态
  status: {
    type: String,
    enum: ['active', 'inactive', 'deprecated'],
    default: 'active'
  },
  
  // 环境配置
  environment: {
    type: String,
    enum: ['development', 'testing', 'staging', 'production', 'all'],
    default: 'all'
  },
  
  // 配置标签
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // 最后更新信息
  lastUpdatedBy: {
    type: String,
    default: 'system'
  },
  
  // 访问统计
  accessStats: {
    readCount: { type: Number, default: 0 },
    writeCount: { type: Number, default: 0 },
    lastReadAt: { type: Date },
    lastWriteAt: { type: Date }
  }
}, {
  timestamps: true
});

// 验证配置值
systemConfigSchema.methods.validateValue = function(newValue) {
  const validation = this.validation;
  
  // 必填验证
  if (validation.required && (newValue === null || newValue === undefined)) {
    throw new Error(`配置 ${this.key} 是必填项`);
  }
  
  // 数据类型验证
  const expectedType = this.dataType;
  const actualType = Array.isArray(newValue) ? 'array' : typeof newValue;
  
  if (actualType !== expectedType && newValue !== null) {
    throw new Error(`配置 ${this.key} 期望类型为 ${expectedType}，实际类型为 ${actualType}`);
  }
  
  // 数值范围验证
  if (expectedType === 'number' && typeof newValue === 'number') {
    if (validation.min !== undefined && newValue < validation.min) {
      throw new Error(`配置 ${this.key} 的值不能小于 ${validation.min}`);
    }
    if (validation.max !== undefined && newValue > validation.max) {
      throw new Error(`配置 ${this.key} 的值不能大于 ${validation.max}`);
    }
  }
  
  // 字符串长度验证
  if (expectedType === 'string' && typeof newValue === 'string') {
    if (validation.minLength !== undefined && newValue.length < validation.minLength) {
      throw new Error(`配置 ${this.key} 的长度不能小于 ${validation.minLength}`);
    }
    if (validation.maxLength !== undefined && newValue.length > validation.maxLength) {
      throw new Error(`配置 ${this.key} 的长度不能大于 ${validation.maxLength}`);
    }
    
    // 正则表达式验证
    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(newValue)) {
        throw new Error(`配置 ${this.key} 的值不符合格式要求`);
      }
    }
  }
  
  // 枚举值验证
  if (validation.enum && validation.enum.length > 0) {
    if (!validation.enum.includes(newValue)) {
      throw new Error(`配置 ${this.key} 的值必须是以下之一: ${validation.enum.join(', ')}`);
    }
  }
  
  return true;
};

// 更新配置值
systemConfigSchema.methods.updateValue = function(newValue, changedBy = 'system', reason = '') {
  // 验证新值
  this.validateValue(newValue);
  
  // 保存历史记录
  this.history.push({
    value: this.value,
    changedBy: changedBy,
    changedAt: new Date(),
    reason: reason,
    version: this.history.length + 1
  });
  
  // 更新值
  this.value = newValue;
  this.lastUpdatedBy = changedBy;
  this.accessStats.writeCount += 1;
  this.accessStats.lastWriteAt = new Date();
  
  return this.save();
};

// 获取配置值（带访问统计）
systemConfigSchema.methods.getValue = function() {
  this.accessStats.readCount += 1;
  this.accessStats.lastReadAt = new Date();
  this.save();
  
  return this.value;
};

// 重置为默认值
systemConfigSchema.methods.resetToDefault = function(changedBy = 'system') {
  if (this.defaultValue !== undefined) {
    return this.updateValue(this.defaultValue, changedBy, '重置为默认值');
  }
  throw new Error(`配置 ${this.key} 没有设置默认值`);
};

// 获取配置历史
systemConfigSchema.methods.getHistory = function(limit = 10) {
  return this.history
    .sort((a, b) => b.changedAt - a.changedAt)
    .slice(0, limit);
};

// 静态方法：批量获取配置
systemConfigSchema.statics.getConfigs = function(keys, category = null) {
  const query = {};
  
  if (keys && keys.length > 0) {
    query.key = { $in: keys };
  }
  
  if (category) {
    query.category = category;
  }
  
  query.status = 'active';
  
  return this.find(query).select('key value dataType description');
};

// 静态方法：获取配置映射
systemConfigSchema.statics.getConfigMap = async function(category = null) {
  const configs = await this.getConfigs(null, category);
  const configMap = {};
  
  configs.forEach(config => {
    configMap[config.key] = config.value;
  });
  
  return configMap;
};

// 静态方法：批量更新配置
systemConfigSchema.statics.batchUpdate = async function(updates, changedBy = 'system') {
  const results = [];
  
  for (const update of updates) {
    try {
      const config = await this.findOne({ key: update.key });
      if (config) {
        await config.updateValue(update.value, changedBy, update.reason || '');
        results.push({ key: update.key, success: true });
      } else {
        results.push({ key: update.key, success: false, error: '配置不存在' });
      }
    } catch (error) {
      results.push({ key: update.key, success: false, error: error.message });
    }
  }
  
  return results;
};

// 预保存中间件：验证配置值
systemConfigSchema.pre('save', function(next) {
  if (this.isModified('value')) {
    try {
      this.validateValue(this.value);
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// 索引
systemConfigSchema.index({ key: 1 }, { unique: true });
systemConfigSchema.index({ category: 1 });
systemConfigSchema.index({ status: 1 });
systemConfigSchema.index({ environment: 1 });
systemConfigSchema.index({ tags: 1 });
systemConfigSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);