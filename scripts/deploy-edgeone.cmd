@echo off
chcp 65001 >nul
REM ============================================
REM 修仙问答 - EdgeOne Pages 一键部署
REM 前置: edgeone CLI 已登录 (edgeone login --site china)
REM ============================================
cd /d %~dp0..

echo [1/3] 检查 edgeone CLI...
where edgeone.cmd >nul 2>nul
if errorlevel 1 (
  echo   未找到 edgeone CLI，尝试 npx 安装...
  call npm install -g edgeone --registry=https://registry.npmmirror.com
)

echo [2/3] 检查构建产物...
if not exist dist\client\index.html (
  echo   未找到 dist\client，请先执行 npm run build
  exit /b 1
)

echo [3/3] 部署到 EdgeOne Pages (project: xiuixian-app)...
call edgeone.cmd pages deploy dist/client -n xiuixian-app -e production --json

echo.
echo 完成！输出的 url 参数即为访问地址（带 eo_token，过期后重新部署生成新的）
pause
