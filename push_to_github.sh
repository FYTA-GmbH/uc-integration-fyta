#!/bin/bash
# Script to push the repository to GitHub

# Change to the repository directory
cd "$(dirname "$0")"

# Add all files
git add .

# Commit changes
git commit -m "Update documentation and metadata files"

# Add remote if it doesn't exist
if ! git remote | grep -q "origin"; then
  git remote add origin https://github.com/Schalex01/uc-integration-fyta.git
fi

# Push to GitHub
git push -f -u origin master

echo "Repository pushed to GitHub successfully!" 