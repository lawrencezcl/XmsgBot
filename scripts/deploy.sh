#!/bin/bash

# MsgBot 部署脚本
# 用于自动化部署到生产环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置变量
APP_NAME="msgbot"
DOCKER_IMAGE="msgbot:latest"
CONTAINER_NAME="msgbot-container"
BACKUP_DIR="/opt/backups/msgbot"
LOG_FILE="/var/log/msgbot-deploy.log"

# 函数定义
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ✗${NC} $1" | tee -a "$LOG_FILE"
}

# 检查依赖
check_dependencies() {
    log "检查系统依赖..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    log_success "依赖检查完成"
}

# 创建备份
create_backup() {
    log "创建数据备份..."
    
    # 创建备份目录
    mkdir -p "$BACKUP_DIR"
    
    # 备份数据库
    BACKUP_FILE="$BACKUP_DIR/mongodb-$(date +%Y%m%d-%H%M%S).gz"
    
    if docker exec msgbot-mongodb mongodump --archive --gzip > "$BACKUP_FILE" 2>/dev/null; then
        log_success "数据库备份完成: $BACKUP_FILE"
    else
        log_warning "数据库备份失败，继续部署..."
    fi
    
    # 清理旧备份（保留最近7天）
    find "$BACKUP_DIR" -name "mongodb-*.gz" -mtime +7 -delete 2>/dev/null || true
}

# 构建镜像
build_image() {
    log "构建 Docker 镜像..."
    
    if docker build -t "$DOCKER_IMAGE" .; then
        log_success "镜像构建完成"
    else
        log_error "镜像构建失败"
        exit 1
    fi
}

# 运行测试
run_tests() {
    log "运行测试..."
    
    if docker run --rm "$DOCKER_IMAGE" npm test; then
        log_success "测试通过"
    else
        log_error "测试失败"
        exit 1
    fi
}

# 停止旧容器
stop_old_container() {
    log "停止旧容器..."
    
    if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
        docker stop "$CONTAINER_NAME" || true
        docker rm "$CONTAINER_NAME" || true
        log_success "旧容器已停止"
    else
        log "没有运行中的容器"
    fi
}

# 启动新容器
start_new_container() {
    log "启动新容器..."
    
    if docker-compose up -d; then
        log_success "容器启动完成"
    else
        log_error "容器启动失败"
        exit 1
    fi
}

# 健康检查
health_check() {
    log "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/health > /dev/null 2>&1; then
            log_success "应用健康检查通过"
            return 0
        fi
        
        log "健康检查失败，等待重试... ($attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    log_error "健康检查失败，部署可能有问题"
    return 1
}

# 清理旧镜像
cleanup_images() {
    log "清理旧镜像..."
    
    # 删除悬空镜像
    docker image prune -f > /dev/null 2>&1 || true
    
    # 删除旧版本镜像（保留最新3个）
    docker images "$APP_NAME" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        tail -n +2 | sort -k2 -r | tail -n +4 | awk '{print $1}' | \
        xargs -r docker rmi > /dev/null 2>&1 || true
    
    log_success "镜像清理完成"
}

# 发送通知
send_notification() {
    local status=$1
    local message=$2
    
    # 这里可以集成各种通知方式
    # 例如：Slack、钉钉、邮件等
    
    if [ "$status" = "success" ]; then
        log_success "部署成功: $message"
    else
        log_error "部署失败: $message"
    fi
}

# 回滚函数
rollback() {
    log_warning "开始回滚..."
    
    # 停止当前容器
    docker-compose down || true
    
    # 恢复上一个版本（这里需要根据实际情况实现）
    # docker-compose -f docker-compose.backup.yml up -d
    
    log_warning "回滚完成，请手动检查服务状态"
}

# 主函数
main() {
    log "开始部署 $APP_NAME..."
    
    # 检查参数
    if [ "$1" = "--skip-tests" ]; then
        SKIP_TESTS=true
        log_warning "跳过测试"
    fi
    
    if [ "$1" = "--rollback" ]; then
        rollback
        exit 0
    fi
    
    # 执行部署步骤
    check_dependencies
    create_backup
    build_image
    
    if [ "$SKIP_TESTS" != "true" ]; then
        run_tests
    fi
    
    stop_old_container
    start_new_container
    
    if health_check; then
        cleanup_images
        send_notification "success" "部署完成"
        log_success "部署成功完成！"
    else
        send_notification "failed" "健康检查失败"
        log_error "部署失败，请检查日志"
        
        # 询问是否回滚
        read -p "是否回滚到上一个版本？(y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rollback
        fi
        
        exit 1
    fi
}

# 信号处理
trap 'log_error "部署被中断"; exit 1' INT TERM

# 执行主函数
main "$@"