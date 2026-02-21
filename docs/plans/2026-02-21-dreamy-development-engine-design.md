# Dreamy Development Engine

**Date:** 2026-02-21
**Status:** Approved

## Core Philosophy

Algorithmize everything possible. The LLM becomes a thin conversational layer on top of a deeply smart algorithmic foundation. The smarter the data models and analysis, the less expensive API calls are needed — and the better the coaching gets because it's built on real sports science, not LLM guessing.

## Target Athlete

Serious recreational runners (40-65 mpw). People training for PRs in halfs/marathons, BQ-chasers who understand training concepts. The system should scale down for beginners and up for competitive/sub-elite, but the core niche is the runner who knows enough to question bad advice but doesn't have a coach analyzing their training.

The depth target: Olympic run coach meets PhD behavioral scientist meets PhD sports scientist.

## Development Loop

Two parallel tracks in a repeating cycle:

**Grind Track (Claude autonomous):**
- Audit code quality and algorithms
- Fix bugs with TDD
- Refine models and data pipelines
- Overnight agent batch runs on independent tasks

**You Track (Interactive):**
- Flag things that feel wrong
- Test in browser, report issues
- Review PRs, approve direction
- Morning PR review

### Cycle Steps
1. **Audit** — scan a focus area (Playwright visual, code review, algorithm audit against sports science)
2. **Catalogue** — findings go into FEATURE_TRACKER.md, scored by impact
3. **Grind** — parallel agents attack independent fixes, TDD for every bug, local testing only
4. **Review** — you review PRs, test in browser, flag anything off
5. **Refine** — feedback feeds the next audit cycle

Each cycle: ~1-2 days. You steer direction, Claude grinds implementation.

## Priority Order: Algorithm-First Strategy

### Phase 1: "The Engine" (Weeks 1-2)

Perfect the algorithmic core. Highest-leverage work — everything else depends on it.

- Audit every calculation in `src/lib/` against sports science (Daniels, Pfitzinger, Seiler)
- Fix timezone bugs across all files (known `parseLocalDate()` issue)
- Harden VDOT engine, fitness/fatigue model (CTL/ATL/TSB), pace zone math
- Add training load calculations: acute/chronic ratio, monotony, strain
- Fix interval pattern recognition (8x800 problem)
- Fix scoring models to use nulls not defaults
- Write tests for every algorithm (local, no API cost)
- Create missing DB tables: `conversationSummaries`, `responseCache`, `workoutTemplates`

### Phase 2: "The Dashboard" (Weeks 3-4)

Make the data informative on every page. No LLM needed, pure algorithmic insight.

- Fix chart/visualization bugs (white-on-white, container sizing, pace formatting)
- Rich zero-state experiences
- Training load dashboard with injury risk indicators
- Performance trend analysis with actionable insights
- Race prediction refinement using real data
- Navigation/IA redesign

### Phase 3: "The Polish" (Weeks 5-6)

World-class frontend using frontend-design skill.

- Dark mode completion (47 remaining colors)
- Consistent design language across all 58 pages
- Mobile experience
- Gate debug/test pages behind `NODE_ENV === 'development'`
- Manual run entry UX (sliders)

### Phase 4: "The Coach" (Week 7+)

Thin LLM layer on top of the rich algorithmic foundation.

- Coach only synthesizes across domains (training + life + goals)
- Conversational interface to surfaced data
- Fix hardcoded `profileId: 1`
- Test coaching locally with mocked responses (no API cost)
- Custom training plan builder on top of algorithm engine

## Resource Constraints

- **Strava API**: Rate-limited, don't hit in testing. Use local SQLite data.
- **Vercel/Neon**: Minimize production deploys during development. Test locally.
- **Claude API**: Test coach features with mocked LLM responses locally. Only hit API for integration testing.
- **Claude Code**: Use parallel agents and overnight runs efficiently. Batch independent work.

## Tools & Skills Mapping

| Phase | Primary Skills/Tools |
|-------|---------------------|
| Audit | Playwright (visual), code-review, Explore agents |
| Fix | TDD, systematic-debugging, verification-before-completion |
| Improve | brainstorming, frontend-design, writing-plans |
| Ship | finishing-a-development-branch, requesting-code-review |
| Batch | dispatching-parallel-agents, subagent-driven-development, overnight agent |
