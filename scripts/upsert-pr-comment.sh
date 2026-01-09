#!/bin/bash
set -e

# Usage: ./scripts/upsert-pr-comment.sh <marker> <body> <pr_number>

MARKER=$1
BODY=$2
PR_NUMBER=$3

if [ -z "$MARKER" ] || [ -z "$BODY" ] || [ -z "$PR_NUMBER" ]; then
  echo "Usage: $0 <marker> <body> <pr_number>"
  exit 1
fi

# Search for existing comment by current user with marker
# We use 'gh pr view' to get comments and filter by body containing the marker
# Note: gh pr view shows comments from both the PR and the linked issue
# We use databaseId because it's the numeric ID required by the REST API PATCH endpoint
COMMENT_ID=$(gh pr view "$PR_NUMBER" --json comments --jq ".comments[] | select(.body | contains(\"$MARKER\")) | .databaseId" | head -n 1)

if [ -n "$COMMENT_ID" ] && [ "$COMMENT_ID" != "null" ]; then
  echo "Found existing comment $COMMENT_ID, updating..."
  gh api -X PATCH "/repos/:owner/:repo/issues/comments/$COMMENT_ID" -f body="$BODY"$'\n\n'"$MARKER"
else
  echo "No existing comment found, creating new one..."
  gh pr comment "$PR_NUMBER" --body "$BODY"$'\n\n'"$MARKER"
fi
