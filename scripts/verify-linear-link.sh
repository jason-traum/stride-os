#!/bin/bash
#
# verify-linear-link.sh
#
# Verifies that branch names and commit messages follow Linear conventions.
# Exit codes:
#   0 = all checks pass
#   1 = warnings only (non-strict mode, default)
#   2 = errors (strict mode)
#
# Usage:
#   ./scripts/verify-linear-link.sh          # warn mode (default)
#   ./scripts/verify-linear-link.sh --strict # fail on violations
#
# Environment:
#   CI=true          - enables PR title check (requires GITHUB_EVENT_PATH)
#   STRICT=true      - same as --strict flag
#

set -e

STRICT=false
WARNINGS=0
ERRORS=0

# Parse arguments
for arg in "$@"; do
  case $arg in
    --strict)
      STRICT=true
      shift
      ;;
  esac
done

# Also check environment variable
if [[ "${STRICT_LINEAR:-}" == "true" ]]; then
  STRICT=true
fi

echo "🔗 Verifying Linear linkage..."
echo ""

# --- Check 1: Branch name ---
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$BRANCH" ]]; then
  echo "⚠️  Could not determine current branch"
  ((WARNINGS++))
elif [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "ℹ️  On $BRANCH branch - skipping branch name check"
elif [[ "$BRANCH" =~ ^dre-[0-9]+-[a-z0-9-]+$ ]]; then
  echo "✅ Branch name: $BRANCH"
else
  echo "⚠️  Branch name '$BRANCH' doesn't match pattern: dre-<number>-<slug>"
  echo "   Expected: dre-123-your-feature-slug"
  ((WARNINGS++))
fi

# --- Check 2: Latest commit message ---
COMMIT_MSG=$(git log -1 --pretty=%s 2>/dev/null || echo "")

if [[ -z "$COMMIT_MSG" ]]; then
  echo "⚠️  Could not get latest commit message"
  ((WARNINGS++))
elif [[ "$COMMIT_MSG" =~ ^DRE-[0-9]+: ]]; then
  echo "✅ Commit message: $COMMIT_MSG"
elif [[ "$COMMIT_MSG" =~ ^(Merge|chore|docs|ci|test): ]]; then
  echo "ℹ️  Commit appears to be maintenance: $COMMIT_MSG"
else
  echo "⚠️  Commit message doesn't start with 'DRE-###:'"
  echo "   Got: $COMMIT_MSG"
  echo "   Expected: DRE-123: your message"
  ((WARNINGS++))
fi

# --- Check 3: PR title (CI only) ---
if [[ "${CI:-}" == "true" && -n "${GITHUB_EVENT_PATH:-}" ]]; then
  if command -v jq &> /dev/null && [[ -f "$GITHUB_EVENT_PATH" ]]; then
    PR_TITLE=$(jq -r '.pull_request.title // empty' "$GITHUB_EVENT_PATH" 2>/dev/null || echo "")

    if [[ -n "$PR_TITLE" ]]; then
      if [[ "$PR_TITLE" =~ DRE-[0-9]+ ]]; then
        echo "✅ PR title: $PR_TITLE"
      else
        echo "⚠️  PR title doesn't contain 'DRE-###'"
        echo "   Got: $PR_TITLE"
        echo "   Expected: DRE-123 Your title here"
        ((WARNINGS++))
      fi
    fi
  fi
fi

# --- Summary ---
echo ""
if [[ $WARNINGS -eq 0 ]]; then
  echo "✅ All Linear linkage checks passed!"
  exit 0
else
  echo "⚠️  $WARNINGS warning(s) found"

  if [[ "$STRICT" == "true" ]]; then
    echo ""
    echo "❌ Strict mode enabled - failing build"
    echo "   To disable strict mode, remove --strict flag or set STRICT_LINEAR=false"
    exit 2
  else
    echo ""
    echo "ℹ️  Running in warn mode - build will continue"
    echo "   To enable strict mode: npm run verify:linear:strict"
    exit 0
  fi
fi
