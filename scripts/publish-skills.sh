#!/bin/bash
# Publish skills to ClawHub
# Usage: ./scripts/publish-skills.sh
#
# Prerequisites:
#   1. npm i -g clawdhub
#   2. clawdhub login (authenticate with GitHub)
#
# Skills.sh:
#   No action needed - Skills.sh auto-discovers SKILL.md files from GitHub.
#   Users install via: npx skills add <github-user>/shopme-mcp

set -e

echo "=== Skills.sh ==="
echo "Skills.sh requires no manual publish step."
echo "Just push to GitHub and users can install via:"
echo "  npx skills add <your-github-username>/shopme-mcp"
echo ""

echo "=== ClawHub ==="
echo "Publishing skills to ClawHub..."
echo ""

SKILLS=(
  "skills/logistics-tracking"
  "skills/us-domestic-tracking"
  "skills/cn-ecommerce-search"
  "skills/visual-product-search"
  "skills/xiaohongshu-data"
  "skills/cross-border-price-compare"
  "skills/product-recommendation"
)

for skill_dir in "${SKILLS[@]}"; do
  SKILL_NAME=$(basename "$skill_dir")
  echo "Syncing $SKILL_NAME to ClawHub..."
  
  cd "$skill_dir"
  clawdhub sync 2>&1 || echo "  ⚠️  Failed to sync: $SKILL_NAME"
  cd - > /dev/null
  
  echo ""
done

echo "✅ Done!"
echo ""
echo "Users can now install skills via:"
echo "  ClawHub: npx clawhub@latest install <skill-name>"
echo "  Skills.sh: npx skills add <your-github-username>/shopme-mcp"
