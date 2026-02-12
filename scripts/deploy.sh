#!/bin/bash
# Shopme MCP 一键部署脚本
# 用法: ./scripts/deploy.sh [commit message]
# 示例: ./scripts/deploy.sh "feat: add new tracking carrier"
#       ./scripts/deploy.sh  (不传参数则自动生成 commit message)

set -e

cd "$(dirname "$0")/.."

echo "📦 Shopme MCP Deploy"
echo "===================="
echo ""

# 1. 构建所有包
echo "🔨 Building all packages..."
pnpm build
echo "✅ Build passed"
echo ""

# 2. 检查是否有变更
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "ℹ️  No changes to commit. Everything is up to date."
  exit 0
fi

# 3. 显示变更摘要
echo "📝 Changes:"
git status --short
echo ""

# 4. 暂存所有变更
git add -A

# 5. 生成 commit message
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  # 自动生成：统计变更文件
  CHANGED=$(git diff --cached --name-only | head -20)
  PKG_CHANGES=""
  SKILL_CHANGES=""

  for f in $CHANGED; do
    case "$f" in
      packages/*/src/*) PKG_CHANGES="$PKG_CHANGES $(echo $f | cut -d/ -f2)" ;;
      skills/*) SKILL_CHANGES="$SKILL_CHANGES $(echo $f | cut -d/ -f2)" ;;
    esac
  done

  PKG_CHANGES=$(echo "$PKG_CHANGES" | tr ' ' '\n' | sort -u | tr '\n' ', ' | sed 's/,$//' | sed 's/^,//')
  SKILL_CHANGES=$(echo "$SKILL_CHANGES" | tr ' ' '\n' | sort -u | tr '\n' ', ' | sed 's/,$//' | sed 's/^,//')

  if [ -n "$PKG_CHANGES" ] && [ -n "$SKILL_CHANGES" ]; then
    COMMIT_MSG="update: $PKG_CHANGES + skills"
  elif [ -n "$PKG_CHANGES" ]; then
    COMMIT_MSG="update: $PKG_CHANGES"
  elif [ -n "$SKILL_CHANGES" ]; then
    COMMIT_MSG="update skills: $SKILL_CHANGES"
  else
    COMMIT_MSG="chore: update $(date +%Y-%m-%d)"
  fi
fi

# 6. 提交
echo "💬 Commit: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"
echo ""

# 7. 推送（使用 token 认证 shopmeskills 组织）
echo "🚀 Pushing to origin..."
TOKEN_FILE="$(git rev-parse --show-toplevel)/.git-token"
if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
  git -c "http.https://github.com/.extraheader=Authorization: basic $(echo -n "shopmeskills:$TOKEN" | base64)" push origin main
else
  git push origin main
fi
echo ""

echo "✅ Deploy complete!"
echo "🔗 https://github.com/shopmeskills/mcp"
