# Overnight Agent Execution Guide

This document describes how to run Claude Code in batch mode for overnight or unattended work sessions.

## Overview

Overnight agent runs are useful for:
- Bulk refactoring tasks
- Migration scripts
- Documentation generation
- Code cleanup and linting fixes
- Test coverage improvements

**Key principle:** Agents work on a dedicated branch, never merge directly, and always produce a reviewable PR.

---

## Setup

### 1. Create a Linear Issue

Before starting an overnight batch:
1. Create a Linear issue describing the work (e.g., "DRE-456 Overnight: fix lint warnings")
2. Note the issue number for branch naming

### 2. Create the Working Branch

```bash
git checkout main
git pull origin main
git checkout -b dre-456-overnight-batch
```

Or for recurring maintenance:
```bash
git checkout -b overnight-gap-fixes
```

### 3. Initialize the Report

Copy the template:
```bash
cp OVERNIGHT_REPORT_TEMPLATE.md OVERNIGHT_REPORT_$(date +%Y%m%d).md
```

---

## Running the Agent

### Batch Instructions Template

When starting Claude Code for overnight work, provide clear boundaries:

```
You are working on branch: dre-456-overnight-batch

SCOPE:
- [List specific tasks]
- [List files/directories to focus on]

CONSTRAINTS:
- Do NOT modify: [list protected files]
- Do NOT merge to main
- Do NOT deploy

AFTER EACH SIGNIFICANT CHANGE:
1. Run: npm run lint
2. Run: npm run build
3. Commit with: DRE-456: <description>
4. Update OVERNIGHT_REPORT.md

WHEN FINISHED:
1. Final npm run lint && npm run build
2. Update OVERNIGHT_REPORT.md with summary
3. Push branch: git push -u origin dre-456-overnight-batch
4. Output: "BATCH COMPLETE - Ready for PR review"
```

### Example: Lint Fix Batch

```
TASK: Fix all ESLint warnings in src/actions/

SCOPE:
- src/actions/*.ts files only
- Fix unused imports
- Fix any type issues
- Fix unused variables

CONSTRAINTS:
- Do NOT change business logic
- Do NOT modify function signatures
- Do NOT add new dependencies

PROCESS:
1. Run npm run lint, capture warnings
2. Fix warnings file by file
3. After each file: npm run lint && npm run build
4. Commit: DRE-456: fix lint warnings in <filename>
5. Update OVERNIGHT_REPORT.md
```

---

## Report Structure

Every batch must maintain `OVERNIGHT_REPORT.md` with:

```markdown
# Overnight Batch Report

## Session Info
- Date: YYYY-MM-DD
- Branch: dre-XXX-description
- Linear Issue: DRE-XXX

## Summary
Brief description of what was accomplished.

## Files Changed
- path/to/file1.ts - description
- path/to/file2.ts - description

## Commands Run
- npm run lint (pass/fail)
- npm run build (pass/fail)
- [other commands]

## Verification
- [ ] All lint checks pass
- [ ] Build succeeds
- [ ] No regressions introduced

## Commits Made
1. abc1234 - DRE-XXX: first change
2. def5678 - DRE-XXX: second change

## Issues Encountered
- [Any problems or blockers]

## Next Steps
- [Follow-up work needed]
- [Items for human review]
```

---

## Safety Rules

### DO:
- Work on a dedicated branch
- Commit frequently with descriptive messages
- Run lint and build after each change
- Update the report continuously
- Push to remote before stopping

### DON'T:
- Merge to main directly
- Deploy to production
- Modify environment variables
- Delete or overwrite data
- Make breaking API changes

---

## Post-Batch Review

After the overnight run:

1. **Review the report**
   ```bash
   cat OVERNIGHT_REPORT_*.md
   ```

2. **Check the diff**
   ```bash
   git log main..HEAD --oneline
   git diff main --stat
   ```

3. **Run verification**
   ```bash
   npm run lint
   npm run build
   npm run verify:linear
   ```

4. **Open PR**
   ```bash
   gh pr create --title "DRE-456 Overnight batch: fix lint warnings" \
     --body "See OVERNIGHT_REPORT.md for details"
   ```

5. **Review and merge** (human step)

---

## Troubleshooting

### Agent stopped mid-batch
1. Check the report for last known state
2. Run `git status` and `git log`
3. Decide: continue or reset

### Build failures
1. Check specific error in report
2. May need human intervention
3. Can `git stash` and retry

### Merge conflicts
1. Agent should NOT resolve conflicts with main
2. Rebase after human review
3. Or create fresh branch from updated main

---

## Quick Start Checklist

- [ ] Linear issue created
- [ ] Branch created from main
- [ ] Report template copied
- [ ] Clear scope defined
- [ ] Constraints listed
- [ ] Agent started with instructions
- [ ] Report updated during run
- [ ] Final verification passed
- [ ] Branch pushed
- [ ] PR opened for review
