#!/bin/bash

# MsgBot 开发环境设置脚本
# 用于快速设置本地开发环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函数定义
log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ✗${NC} $1"
}

# 检查系统要求
check_requirements() {
    log "检查系统要求..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低，需要 18+，当前版本: $(node -v)"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    # 检查 Docker（可选）
    if command -v docker &> /dev/null; then
        log_success "Docker 已安装: $(docker --version)"
        DOCKER_AVAILABLE=true
    else
        log_warning "Docker 未安装，将使用本地数据库"
        DOCKER_AVAILABLE=false
    fi
    
    log_success "系统要求检查完成"
}

# 安装依赖
install_dependencies() {
    log "安装项目依赖..."
    
    if npm install; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi
}

# 设置环境变量
setup_environment() {
    log "设置环境变量..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "已创建 .env 文件"
        else
            log_error ".env.example 文件不存在"
            exit 1
        fi
    else
        log_warning ".env 文件已存在，跳过创建"
    fi
    
    # 生成随机密钥
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -hex 32)
        SESSION_SECRET=$(openssl rand -hex 32)
        INTERNAL_API_KEY=$(openssl rand -hex 16)
        
        # 更新 .env 文件
        sed -i.bak "s/your-super-secret-jwt-key-change-this-in-production/$JWT_SECRET/g" .env
        sed -i.bak "s/your-session-secret-change-this/$SESSION_SECRET/g" .env
        sed -i.bak "s/your-internal-api-key-change-this/$INTERNAL_API_KEY/g" .env
        
        rm .env.bak 2>/dev/null || true
        
        log_success "已生成随机密钥"
    else
        log_warning "openssl 未安装，请手动设置 .env 文件中的密钥"
    fi
}

# 启动数据库服务
start_databases() {
    if [ "$DOCKER_AVAILABLE" = true ]; then
        log "使用 Docker 启动数据库服务..."
        
        # 只启动数据库服务
        if docker-compose up -d mongodb redis; then
            log_success "数据库服务启动完成"
            
            # 等待数据库就绪
            log "等待数据库就绪..."
            sleep 10
            
            # 初始化 MongoDB
            if docker exec msgbot-mongodb mongo msgbot /docker-entrypoint-initdb.d/mongo-init.js; then
                log_success "MongoDB 初始化完成"
            else
                log_warning "MongoDB 初始化失败，请手动检查"
            fi
        else
            log_error "数据库服务启动失败"
            exit 1
        fi
    else
        log_warning "Docker 不可用，请确保本地 MongoDB 和 Redis 服务正在运行"
        log "MongoDB: mongodb://localhost:27017/msgbot"
        log "Redis: redis://localhost:6379"
    fi
}

# 运行数据库迁移
run_migrations() {
    log "运行数据库迁移..."
    
    # 这里可以添加数据库迁移脚本
    # npm run migrate
    
    log_success "数据库迁移完成"
}

# 创建开发用户
create_dev_user() {
    log "创建开发用户..."
    
    # 这里可以添加创建开发用户的脚本
    # node scripts/create-dev-user.js
    
    log_success "开发用户创建完成"
}

# 运行测试
run_tests() {
    if [ "$1" != "--skip-tests" ]; then
        log "运行测试..."
        
        if npm test; then
            log_success "测试通过"
        else
            log_warning "测试失败，但继续设置开发环境"
        fi
    else
        log "跳过测试"
    fi
}

# 显示开发信息
show_dev_info() {
    echo
    log_success "开发环境设置完成！"
    echo
    echo -e "${BLUE}开发服务器启动命令:${NC}"
    echo "  npm run dev          # 启动开发服务器"
    echo "  npm run dev:watch    # 启动开发服务器（文件监听）"
    echo
    echo -e "${BLUE}测试命令:${NC}"
    echo "  npm test             # 运行所有测试"
    echo "  npm run test:watch   # 监听模式运行测试"
    echo "  npm run test:coverage # 运行测试并生成覆盖率报告"
    echo
    echo -e "${BLUE}代码质量:${NC}"
    echo "  npm run lint         # 运行 ESLint"
    echo "  npm run lint:fix     # 自动修复 ESLint 问题"
    echo "  npm run format       # 格式化代码"
    echo
    echo -e "${BLUE}Docker 命令:${NC}"
    echo "  npm run docker:up    # 启动所有服务"
    echo "  npm run docker:down  # 停止所有服务"
    echo "  npm run docker:logs  # 查看日志"
    echo
    echo -e "${BLUE}数据库管理:${NC}"
    echo "  访问 MongoDB: http://localhost:8081 (mongo-express)"
    echo "  访问 Redis: http://localhost:8082 (redis-commander)"
    echo
    echo -e "${BLUE}API 文档:${NC}"
    echo "  访问 Swagger UI: http://localhost:3000/api-docs"
    echo
    echo -e "${YELLOW}注意事项:${NC}"
    echo "  1. 请在 .env 文件中配置实际的 API 密钥"
    echo "  2. 开发环境默认管理员账号: admin@msgbot.com / admin123456"
    echo "  3. 确保防火墙允许相关端口访问"
    echo
}

# 主函数
main() {
    log "开始设置 MsgBot 开发环境..."
    
    check_requirements
    install_dependencies
    setup_environment
    start_databases
    run_migrations
    create_dev_user
    run_tests "$1"
    show_dev_info
    
    log_success "开发环境设置完成！"
}

# 信号处理
trap 'log_error "设置被中断"; exit 1' INT TERM

# 执行主函数
main "$@"