#!/bin/bash
# Shopme MCP deploy script
# Usage: ./scripts/deploy.sh [commit message]
# Example: ./scripts/deploy.sh "feat: add new tracking carrier"
#          ./scripts/deploy.sh  (auto-generates commit message if omitted)

set -e

cd "$(dirname "$0")/.."

echo "Shopme MCP Deploy"
echo "===================="
echo ""

# 1. Build all packages
echo "Building all packages..."
pnpm build
echo "Build passed"
echo ""

# 2. Check for changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes to commit. Everything is up to date."
  exit 0
fi

# 3. Show change summary
echo "Changes:"
git status --short
echo ""

# 4. Stage all changes
git add -A

# 5. Generate commit message
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  # Auto-generate: summarize changed files
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

# 6. Commit
echo "Commit: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"
echo ""

# 7. Push (uses token auth for shopmeskills org if available)
echo "Pushing to origin..."
TOKEN_FILE="$(git rev-parse --show-toplevel)/.git-token"
if [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
  git -c "http.https://github.com/.extraheader=Authorization: basic $(echo -n "shopmeskills:$TOKEN" | base64)" push origin main
else
  git push origin main
fi
echo ""

echo "Deploy complete!"
echo "https://github.com/shopmeskills/mcp"
