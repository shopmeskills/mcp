#!/bin/bash
# Publish skills to ClawHub
# Usage: ./scripts/publish-skills.sh [--retry N] [--delay S]
#
# Options:
#   --retry N   Max retry attempts on rate limit (default: 3)
#   --delay S   Delay between retries in seconds (default: 60)
#
# Prerequisites:
#   1. npm i -g clawhub
#   2. clawhub login
#
# Skills.sh:
#   No action needed - Skills.sh auto-discovers SKILL.md files from GitHub.
#   Users install via: npx skills add shopmeskills/shopme-mcp

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SKILLS_DIR="$PROJECT_ROOT/skills"

# Default options
MAX_RETRIES=3
RETRY_DELAY=60

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --retry)
      MAX_RETRIES="$2"
      shift 2
      ;;
    --delay)
      RETRY_DELAY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "       Shopme Skills Publisher"
echo "========================================"
echo ""

# Check if clawhub is installed
if ! command -v clawhub &> /dev/null; then
  echo -e "${RED}Error: clawhub CLI not found${NC}"
  echo "Install with: npm i -g clawhub"
  exit 1
fi

# Check if logged in
if ! clawhub whoami &> /dev/null; then
  echo -e "${RED}Error: Not logged in to ClawHub${NC}"
  echo "Run: clawhub login"
  exit 1
fi

echo -e "${GREEN}✓${NC} Logged in as: $(clawhub whoami 2>/dev/null | grep -o '@[^ ]*' || echo 'unknown')"
echo ""

# Skills.sh info
echo "=== Skills.sh ==="
echo "Skills.sh auto-discovers from GitHub. No publish needed."
echo "Users install via:"
echo -e "  ${GREEN}npx skills add shopmeskills/shopme-mcp${NC}"
echo ""

# ClawHub publish
echo "=== ClawHub ==="
echo ""

# Auto-discover skills (directories containing SKILL.md)
SKILLS=()
if [[ -d "$SKILLS_DIR" ]]; then
  for skill_path in "$SKILLS_DIR"/*/SKILL.md; do
    if [[ -f "$skill_path" ]]; then
      skill_dir=$(dirname "$skill_path")
      SKILLS+=("$skill_dir")
    fi
  done
fi

if [[ ${#SKILLS[@]} -eq 0 ]]; then
  echo -e "${YELLOW}No skills found in $SKILLS_DIR${NC}"
  exit 0
fi

echo "Found ${#SKILLS[@]} skill(s) to publish:"
for skill_dir in "${SKILLS[@]}"; do
  echo "  - $(basename "$skill_dir")"
done
echo ""

# Extract version from SKILL.md frontmatter
get_skill_version() {
  local skill_md="$1/SKILL.md"
  local version="1.0.0"
  
  if [[ -f "$skill_md" ]]; then
    # Extract version value, handling quotes and whitespace
    version=$(grep 'version:' "$skill_md" | head -1 | sed 's/.*version:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr -d ' ')
  fi
  
  # Fallback to 1.0.0 if empty
  if [[ -z "$version" ]]; then
    version="1.0.0"
  fi
  
  echo "$version"
}

# Publish function with retry
publish_skill() {
  local skill_dir="$1"
  local skill_name=$(basename "$skill_dir")
  local skill_version=$(get_skill_version "$skill_dir")
  local attempt=1
  
  while [[ $attempt -le $MAX_RETRIES ]]; do
    echo -n "Publishing $skill_name@$skill_version (attempt $attempt/$MAX_RETRIES)... "
    
    cd "$skill_dir"
    output=$(clawhub publish . --slug "$skill_name" --version "$skill_version" 2>&1) && {
      echo -e "${GREEN}✓${NC}"
      cd - > /dev/null
      return 0
    }
    
    cd - > /dev/null
    
    # Check if rate limited
    if echo "$output" | grep -qi "rate limit"; then
      echo -e "${YELLOW}Rate limited${NC}"
      if [[ $attempt -lt $MAX_RETRIES ]]; then
        echo "  Waiting ${RETRY_DELAY}s before retry..."
        sleep "$RETRY_DELAY"
      fi
    else
      echo -e "${RED}Failed${NC}"
      echo "  Error: $output"
      return 1
    fi
    
    ((attempt++))
  done
  
  echo -e "${RED}Failed after $MAX_RETRIES attempts${NC}"
  return 1
}

# Publish all skills
SUCCESS=0
FAILED=0

for skill_dir in "${SKILLS[@]}"; do
  if publish_skill "$skill_dir"; then
    ((SUCCESS++))
  else
    ((FAILED++))
  fi
  echo ""
done

# Summary
echo "========================================"
echo "Summary"
echo "========================================"
echo -e "  ${GREEN}Success: $SUCCESS${NC}"
if [[ $FAILED -gt 0 ]]; then
  echo -e "  ${RED}Failed:  $FAILED${NC}"
fi
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ All skills published!${NC}"
  echo ""
  echo "Users can install via:"
  echo -e "  ClawHub:    ${GREEN}clawhub install <skill-name>${NC}"
  echo -e "  Skills.sh:  ${GREEN}npx skills add shopmeskills/shopme-mcp${NC}"
else
  echo -e "${YELLOW}Some skills failed. Try again later or increase --delay${NC}"
  exit 1
fi
