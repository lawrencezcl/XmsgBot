# 使用官方Node.js运行时作为基础镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装项目依赖
RUN npm ci --only=production && npm cache clean --force

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S msgbot -u 1001

# 复制项目文件
COPY --chown=msgbot:nodejs . .

# 创建必要的目录
RUN mkdir -p logs temp uploads && \
    chown -R msgbot:nodejs logs temp uploads

# 切换到非root用户
USER msgbot

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 启动应用
CMD ["node", "src/server.js"]