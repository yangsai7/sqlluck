#!/bin/bash

# sqlluck应用构建脚本

set -e

echo "🚀 开始构建sqlluck应用..."

# 检查Node.js版本
node_version=$(node -v)
echo "Node.js版本: $node_version"

# 1. 安装根目录依赖
echo "📦 安装根目录依赖..."
npm install

# 2. 构建后端
echo "🔧 构建后端服务..."
cd backend
npm install
npm run build
cd ..

# 3. 构建前端
echo "🎨 构建前端界面..."
cd frontend
npm install
npm run build
cd ..

# 4. 构建Electron应用
echo "⚡构建Electron应用..."
cd electron
npm install

# 创建必要的目录
mkdir -p temp
mkdir -p logs

# 开发环境启动
if [ "$1" == "dev" ]; then
    echo "🔥 启动开发环境..."
    cd ..
    npm run dev
else
    # 生产环境打包
    echo "📦 打包生产版本..."
    npm run build
    echo "✅ 构建完成！"
    echo "📄 构建产物位置: electron/dist/"
fi