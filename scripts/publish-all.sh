#!/bin/bash
# Publish all @shopme MCP packages to npm
# Usage: ./scripts/publish-all.sh
#
# Prerequisites:
#   1. npm login (or set NPM_TOKEN)
#   2. Build all packages: pnpm build

set -e

echo "Building all packages..."
pnpm build

echo ""
echo "Publishing packages to npm..."
echo ""

PACKAGES=(
  "packages/logistics-tracking-mcp"
  "packages/us-domestic-tracking-mcp"
)

for pkg in "${PACKAGES[@]}"; do
  if [ ! -f "$pkg/package.json" ]; then
    echo "  Skipping $pkg (not found)"
    continue
  fi

  PKG_NAME=$(node -e "console.log(require('./$pkg/package.json').name)")
  PKG_VERSION=$(node -e "console.log(require('./$pkg/package.json').version)")

  echo "Publishing $PKG_NAME@$PKG_VERSION..."

  cd "$pkg"
  npm publish --access public 2>&1 || echo "  Failed or already published: $PKG_NAME@$PKG_VERSION"
  cd - > /dev/null

  echo ""
done

echo "Done!"
