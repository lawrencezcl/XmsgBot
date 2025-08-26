/**
 * Jest 配置文件
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // 忽略的文件和目录
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // 覆盖率收集
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js', // 排除启动文件
    '!src/config/**/*.js', // 排除配置文件
    '!src/**/*.test.js',
    '!src/**/*.spec.js'
  ],
  
  // 覆盖率报告格式
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: 'coverage',
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // 测试设置文件
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 模块路径映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // 全局变量
  globals: {
    'NODE_ENV': 'test'
  },
  
  // 测试超时时间（毫秒）
  testTimeout: 30000,
  
  // 详细输出
  verbose: true,
  
  // 在测试失败时显示完整的差异
  expand: true,
  
  // 强制退出
  forceExit: true,
  
  // 检测打开的句柄
  detectOpenHandles: true,
  
  // 清理模拟
  clearMocks: true,
  restoreMocks: true,
  
  // 转换配置
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // 模块文件扩展名
  moduleFileExtensions: [
    'js',
    'json',
    'node'
  ],
  
  // 测试结果处理器
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        suiteName: 'MsgBot API Tests'
      }
    ]
  ],
  
  // 错误时不退出
  bail: false,
  
  // 并行测试
  maxWorkers: '50%',
  
  // 缓存目录
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 监听模式下忽略的文件
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/logs/',
    '/dist/'
  ],
  
  // 测试序列化器
  snapshotSerializers: [],
  
  // 模拟配置
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ],
  
  // 环境变量
  setupFiles: [
    '<rootDir>/tests/env.js'
  ]
};