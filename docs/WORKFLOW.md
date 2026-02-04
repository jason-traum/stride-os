# Stride-OS Development Workflow

This document describes the development workflow for stride-os, optimized for Linear automation and overnight agent execution.

## Linear Integration

**Team Key:** `DRE`
**Issue Format:** `DRE-123`

Linear's PR automations are enabled:
- PR opened → Issue moves to **In Progress**
- PR in review → Issue moves to **In Review**
- PR merged → Issue moves to **Done**

---

## Naming Conventions

### Branches

Format: `dre-<issue-number>-<short-slug>`

Examples:
```
dre-123-add-pace-zones
dre-456-fix-strava-sync
dre-789-refactor-analytics
```

### PR Titles

Format: `DRE-<issue-number> <descriptive title>`

Examples:
```
DRE-123 Add configurable pace zones to settings
DRE-456 Fix Strava sync rate limiting
DRE-789 Refactor analytics data pipeline
```

### Commit Messages

Format: `DRE-<issue-number>: <message>`

Examples:
```
DRE-123: add pace zone configuration UI
DRE-123: wire up pace zones to workout analysis
DRE-456: implement exponential backoff for Strava API
```

---

## Workflow: Creating a Feature

### 1. Create Linear Issue

1. Go to Linear → DRE project
2. Create issue with clear title and description
3. Note the issue number (e.g., `DRE-123`)

### 2. Create Branch

```bash
# From main, create a properly named branch
git checkout main
git pull origin main
git checkout -b dre-123-your-feature-slug
```

Or use Linear's "Create branch" feature which auto-generates the branch name.

### 3. Develop

```bash
# Make changes, commit with issue prefix
git add .
git commit -m "DRE-123: implement feature X"

# Run verification before pushing
npm run verify:linear
```

### 4. Open PR

```bash
# Push and create PR
git push -u origin dre-123-your-feature-slug
```

When creating the PR:
- Title must include `DRE-123`
- Fill out the PR template completely
- Link the Linear issue

### 5. Review & Merge

- Request review
- Address feedback with additional `DRE-123:` commits
- Squash merge to main

---

## Verification

Run before pushing:

```bash
npm run verify:linear
```

This checks:
- Branch name matches `dre-<number>-<slug>` pattern
- Latest commit includes `DRE-<number>:` prefix

---

## Automation Proof Test (2-minute checklist)

Use this to verify Linear automations are working:

1. [ ] Create a test issue in Linear (e.g., "Test automation")
2. [ ] Create branch: `dre-XXX-test-automation`
3. [ ] Make a small change, commit: `DRE-XXX: test commit`
4. [ ] Push and open PR with title: `DRE-XXX Test automation`
5. [ ] Verify Linear issue moved to "In Progress"
6. [ ] Request review → verify issue moved to "In Review"
7. [ ] Merge PR → verify issue moved to "Done"
8. [ ] Delete test branch

If any step fails, check:
- Linear GitHub integration settings
- Branch/PR naming conventions
- Linear automation rules

---

## Running Overnight Batches

See [OVERNIGHT_AGENT.md](./OVERNIGHT_AGENT.md) for instructions on running Claude Code in batch mode for overnight work.

---

## Quick Reference

| Item | Pattern | Example |
|------|---------|---------|
| Branch | `dre-<id>-<slug>` | `dre-123-add-feature` |
| PR Title | `DRE-<id> <title>` | `DRE-123 Add feature` |
| Commit | `DRE-<id>: <msg>` | `DRE-123: add feature` |
| Verify | `npm run verify:linear` | — |
