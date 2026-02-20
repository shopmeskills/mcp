#!/bin/bash
# Publish all @shopme MCP packages to npm
# Usage: ./scripts/publish-all.sh
#
# Prerequisites:
#   1. npm login (or set NPM_TOKEN)
#   2. Create @shopme org on npmjs.com: https://www.npmjs.com/org/create
#   3. Build all packages: pnpm build

set -e

echo "🔨 Building all packages..."
pnpm build

echo ""
echo "📦 Publishing packages to npm..."
echo ""

PACKAGES=(
  "packages/logistics-tracking-mcp"
  "packages/cn-ecommerce-search-mcp"
  "packages/visual-product-search-mcp"
  "packages/xiaohongshu-data-mcp"
  "packages/cross-border-price-compare-mcp"
  "packages/product-recommendation-mcp"
)

for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(node -e "console.log(require('./$pkg/package.json').name)")
  PKG_VERSION=$(node -e "console.log(require('./$pkg/package.json').version)")
  
  echo "Publishing $PKG_NAME@$PKG_VERSION..."
  
  cd "$pkg"
  npm publish --access public 2>&1 || echo "  ⚠️  Failed or already published: $PKG_NAME@$PKG_VERSION"
  cd - > /dev/null
  
  echo ""
done

echo "✅ Done! Published packages:"
for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(node -e "console.log(require('./$pkg/package.json').name)")
  echo "  - $PKG_NAME"
done

echo ""
echo "🔗 Users can now use these via:"
echo "  npx -y @shopmeagent/logistics-tracking-mcp"
echo "  npx -y @shopmeagent/cn-ecommerce-search-mcp"
echo "  npx -y @shopmeagent/visual-product-search-mcp"
echo "  npx -y @shopmeagent/xiaohongshu-data-mcp"
echo "  npx -y @shopmeagent/cross-border-price-compare-mcp"
echo "  npx -y @shopmeagent/product-recommendation-mcp"
