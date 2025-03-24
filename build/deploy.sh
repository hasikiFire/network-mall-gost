#!/bin/bash

# 退出时遇到任何错误
set -e

# 定义环境
ENV="prod" # 默认环境为 prod,没有测试环境了。。

# 定义 GitHub 仓库 URL 和本地路径
REPO_URL="https://github.com/hasikiFire/network-mall-gost.git"
LOCAL_PATH="$ENV"
CONFIG_PATH="$ENV/src/config"

 
echo "创建 $LOCAL_PATH 目录..."
rm -rf $LOCAL_PATH
mkdir -p $LOCAL_PATH
chmod 755 $LOCAL_PATH

echo "克隆仓库..."
git clone $REPO_URL $LOCAL_PATH

echo "复制 prod.yaml..."
cp -f prod.yaml "$CONFIG_PATH/prod.yaml"

echo "复制 .env..."
cp -f .env "$LOCAL_PATH/.env"

 
echo ">> 创建日志目录并设置权限..."
mkdir -p ./logs
chmod 777 ./logs  # 确保容器有写入权限


cd $LOCAL_PATH

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