#!/bin/bash
# Script to initialize the Git repository and prepare it for GitHub

# Change to the current directory
cd "$(dirname "$0")"

# Initialize Git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: FYTA integration for Remote Two"

# Instructions for pushing to GitHub
echo ""
echo "Repository initialized. To push to GitHub:"
echo ""
echo "  git remote add origin https://github.com/Schalex01/uc-integration-fyta.git"
echo "  git push -f -u origin master"
echo ""
echo "IMPORTANT: This will completely replace the existing repository content!"
echo "Make sure you have any important files backed up if needed."
echo ""
echo "Note: You may need to authenticate with GitHub first." 