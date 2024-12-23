#!/bin/bash

# 退出时遇到任何错误
set -e

# 定义环境
ENV=${1:-main} # 默认环境为 main

# 定义分支
BRANCH_NAME=$ENV

# 定义 GitHub 仓库 URL 和本地路径
REPO_URL="https://github.com/hasikiFire/network-mall-gost.git"
LOCAL_PATH="$ENV"
CONFIG_PATH="$ENV/src/config"

# 检查环境参数是否有效
if [[ "$ENV" != "test" && "$ENV" != "main" ]]; then
  echo "无效的环境参数。请使用 'test' 或 'main'."
  exit 1
fi

echo "创建 $LOCAL_PATH 目录..."
rm -rf $LOCAL_PATH
mkdir -p $LOCAL_PATH
chmod 755 $LOCAL_PATH

echo "克隆仓库..."
git clone $REPO_URL $LOCAL_PATH

 
echo "复制 prod.yaml "
cp -f prod.yaml "$CONFIG_PATH/prod.yaml"

 
echo "复制 .env "
cp -f .env "$LOCAL_PATH/.env"

cd $LOCAL_PATH
# 切换到指定分支
echo "切换到 $BRANCH_NAME 分支..."
git checkout $BRANCH_NAME

# Step 3: 构建 Docker 镜像
echo "构建 Docker 镜像..."
docker compose build

# Step 4: 停止并删除现有的 Docker 容器
echo "停止并删除现有的容器..."
docker compose down

# Step 5: 启动新的 Docker 容器
echo "启动新的容器..."
docker compose up -d

echo "部署完成。"