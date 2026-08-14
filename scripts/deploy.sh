#!/bin/bash
# ============================================
# 修仙问答 - 一键构建+部署脚本
# WorkBuddy 和 AutoClaw 通用
# ============================================
set -e

echo "=========================================="
echo "  修仙问答 - 构建 & 部署"
echo "=========================================="

# 确定项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "[1/4] 检查环境..."
if ! command -v node &> /dev/null; then
  echo "错误: 未找到 node，请先安装 Node.js 18+"
  exit 1
fi
echo "  Node: $(node --version)"

# 检查 npm
NPM_CMD="npm"
if command -v npx &> /dev/null; then
  NPM_CMD="npx"
fi

echo ""
echo "[2/4] 安装依赖..."
# 如果 npm 有权限问题，使用 --cache 指定缓存目录
npm install --cache "${PROJECT_DIR}/.npm-cache" 2>&1 || {
  echo "npm install 失败，尝试用临时缓存目录..."
  npm install --cache "/tmp/npm-cache-xiuixian" 2>&1
}
echo "  依赖安装完成"

echo ""
echo "[3/4] 构建前端..."
# Windows 上 vite 的 emptyOutDir/safe-delete 有兼容问题，用新目录名绕过
BUILD_DIR="dist/build-$(date +%s)"
npx vite build --outDir "$BUILD_DIR" 2>&1 || {
  echo "vite build 失败，尝试直接构建..."
  npx vite build --outDir dist/client --emptyOutDir 2>&1
}

# 复制到 dist/client
mkdir -p dist/client
if [ -d "$BUILD_DIR" ]; then
  cp -r "$BUILD_DIR"/* dist/client/
  echo "  构建产物已复制到 dist/client/"
fi

echo ""
echo "[4/4] 部署..."
echo ""
echo "请选择部署方式:"
echo "  1. Netlify CLI  (推荐, 永久免费, 自动 HTTPS)"
echo "  2. Vercel CLI   (永久免费, 自动 HTTPS)"
echo "  3. 手动上传      (上传 dist/client/ 到任意静态托管)"
echo "  4. CloudStudio   (WorkBuddy 专用)"
echo "  5. 仅构建，不部署"
echo ""
read -p "输入选择 (1-5): " choice

case $choice in
  1)
    echo ">>> Netlify 部署..."
    npx netlify-cli deploy --prod --dir=dist/client 2>&1 || {
      echo "如果 netlify-cli 未安装，运行: npm install -g netlify-cli"
      echo "首次使用需要: netlify login"
    }
    ;;
  2)
    echo ">>> Vercel 部署..."
    npx vercel --prod 2>&1 || {
      echo "如果 vercel 未安装，运行: npm install -g vercel"
      echo "首次使用需要: vercel login"
    }
    ;;
  3)
    echo ">>> 手动部署..."
    echo "构建产物在: ${PROJECT_DIR}/dist/client/"
    echo "将此目录上传到任意静态托管平台即可"
    echo "推荐平台:"
    echo "  - Netlify Drop: https://app.netlify.com/drop (直接拖拽上传)"
    echo "  - Vercel: https://vercel.com/new"
    echo "  - GitHub Pages: 上传 dist/client/ 到 gh-pages 分支"
    echo "  - 腾讯云 COS / 七牛云 / 阿里云 OSS"
    ;;
  4)
    echo ">>> CloudStudio 部署..."
    echo "此方式需要使用 WorkBuddy 的 cloudstudio-deploy 功能"
    echo "在 WorkBuddy 中告诉 AI: '部署 dist/client/ 到 CloudStudio'"
    ;;
  5)
    echo ">>> 仅构建完成"
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac

echo ""
echo "=========================================="
echo "  完成!"
echo "=========================================="
