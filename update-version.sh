#!/bin/bash

set -euo pipefail

VERSION=$1

if [[ -z "$VERSION" ]]; then
  echo "Usage: npm run update -- <version>"
  exit 1
fi

# Update package version without creating a git tag
npm version --no-git-tag-version "$VERSION"

# Rebuild project
npm run build

# Commit code changes
git add .
git commit -m "chore: bump version to v$VERSION"
git push origin main
