@echo off
chcp 65001 >nul
REM ============================================
REM 修仙问答 - Git 仓库初始化脚本
REM 重新建立本地 git 仓库并配置远程（可选推送）
REM 远程: GitHub mazhenzhou1996/xiuixian-app, Gitee ma-zhenzhou/xiuxian
REM ============================================
cd /d %~dp0..

echo [1/3] 初始化 git 仓库...
if exist .git (
  echo   已存在 .git，跳过 init
) else (
  git init
)

echo [2/3] 配置远程仓库...
git remote remove github 2>nul
git remote remove gitee 2>nul
git remote add github https://github.com/mazhenzhou1996/xiuixian-app.git
git remote add gitee https://gitee.com/ma-zhenzhou/xiuxian.git
echo   github: https://github.com/mazhenzhou1996/xiuixian-app.git
echo   gitee : https://gitee.com/ma-zhenzhou/xiuxian.git

echo [3/3] 首次提交（如需推送请去掉 echo 前的注释）...
git add -A
git -c user.name="mazhenzhou1996" -c user.email="mazhenzhou1996@users.noreply.github.com" commit -m "xiuixian: full project snapshot" 2>nul
REM 推送示例（GitHub 需已登录/凭据；Gitee 可用内嵌凭据的 URL）:
REM git push github master
REM git push gitee master:master
REM git push gitee gh-pages:gh-pages   (构建产物分支)

echo.
echo 完成！推送前请确认远程凭据可用。
pause
