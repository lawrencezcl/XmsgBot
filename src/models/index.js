const User = require('./User');
const Subscription = require('./Subscription');
const Tweet = require('./Tweet');
const PushRecord = require('./PushRecord');
const SystemConfig = require('./SystemConfig');

module.exports = {
  User,
  Subscription,
  Tweet,
  PushRecord,
  SystemConfig
};

// 模型名称常量
module.exports.MODEL_NAMES = {
  USER: 'User',
  SUBSCRIPTION: 'Subscription',
  TWEET: 'Tweet',
  PUSH_RECORD: 'PushRecord',
  SYSTEM_CONFIG: 'SystemConfig'
};

// 集合名称常量
module.exports.COLLECTION_NAMES = {
  USERS: 'users',
  SUBSCRIPTIONS: 'subscriptions',
  TWEETS: 'tweets',
  PUSH_RECORDS: 'pushrecords',
  SYSTEM_CONFIGS: 'systemconfigs'
};