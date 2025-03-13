#!/bin/bash
# Script to replace the existing repository with the clean one

# Define source and destination directories
SRC_DIR="$(dirname "$0")"
DEST_DIR="/Users/alex/GIT/FYTA Circle API /HomeassistentFYTA/uc-integration-fyta"

echo "Replacing existing repository with clean Node.js implementation..."

# Remove the existing repository content
rm -rf "$DEST_DIR"/*
rm -rf "$DEST_DIR"/.*
mkdir -p "$DEST_DIR"

# Copy the clean repository content
cp -r "$SRC_DIR"/* "$DEST_DIR"/
cp -r "$SRC_DIR"/.gitignore "$DEST_DIR"/

echo "Repository replaced successfully!"
echo ""
echo "You can now navigate to the repository and initialize Git:"
echo ""
echo "  cd \"$DEST_DIR\""
echo "  ./setup-repo.sh"
echo "" 