#!/bin/bash
# Publish skills
# Usage: ./scripts/publish-skills.sh
#
# Skills.sh auto-discovers SKILL.md files from GitHub.
# Users install via: npx skills add shopmeskills/mcp

set -e

echo "Skills are auto-published via GitHub."
echo "Users can install with:"
echo "  npx skills add shopmeskills/mcp"
echo ""
echo "Available skills:"

for skill_dir in skills/*/; do
  if [ -f "$skill_dir/SKILL.md" ]; then
    SKILL_NAME=$(basename "$skill_dir")
    echo "  - $SKILL_NAME"
  fi
done
