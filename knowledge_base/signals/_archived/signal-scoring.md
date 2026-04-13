---
name: SIGNAL_SCORING
description: Signal weighting, decay rules, and stacking logic for ICP scoring
domain: methodology
node_type: framework
status: validated
last_updated: 2026-03-07
tags:
  - methodology
  - signals
  - scoring
  - icp
topics:
  - lead-scoring
  - signal-analysis
  - account-prioritization
related_concepts:
  - "[[signal-taxonomy]]"
  - "[[signal-openers]]"
  - "[[icp-scorer]]"
---

# Signal Scoring Framework

Signals tell you WHEN to reach out. ICP tells you WHO to reach out to. This
framework combines both — weighting signals by strength, applying time decay,
and stacking multiple signals for compound scoring.

## Signal Strength Tiers

### Strong Signals (Base: 25-30 points)

| Signal | Points | Why Strong |
|--------|--------|------------|
| Funding round (Series A+) | 30 | Confirmed budget + growth mandate |
| Leadership change (VP+) | 28 | New decision-maker, open to vendors |
| Acquisition (acquirer side) | 25 | Stack consolidation, new budget |
| Tech stack change (your category) | 25 | Actively evaluating alternatives |

A single strong signal is enough to trigger outreach.

### Moderate Signals (Base: 15-20 points)

| Signal | Points | Why Moderate |
|--------|--------|--------------|
| Hiring surge (3+ roles) | 20 | Investing in function, pain is real |
| Product launch | 18 | New demand gen needs |
| Geographic expansion | 18 | Net-new pipeline requirements |
| Partnership announcement | 15 | Adjacent needs emerge |
| Tech stack change (adjacent) | 15 | Evaluating workflows broadly |

Best when combined with a second signal or strong ICP fit.

### Weak Signals (Base: 5-10 points)

| Signal | Points | Why Weak |
|--------|--------|----------|
| Single job posting | 10 | Could be backfill, not growth |
| Press/media mention | 8 | Awareness, not intent |
| Conference speaking | 7 | Industry engagement |
| Social media activity | 5 | Interest, not action |
| Website traffic increase | 5 | Noisy, many false positives |

Weak signals add context but should never drive outreach alone.

## Time Decay Rules

| Days Since Signal | Multiplier | Effective Range |
|-------------------|------------|-----------------|
| 0-7 days | 1.0x | Full strength |
| 8-14 days | 0.9x | Still hot |
| 15-30 days | 0.7x | Warm, act now |
| 31-60 days | 0.4x | Cooling fast |
| 61-90 days | 0.2x | Stale — reference carefully |
| 90+ days | 0.0x | Dead signal — do not reference |

**Exceptions:** Leadership changes decay slower (0.7x at 60 days) — new exec
evaluation window extends 90-120 days. Acquisitions decay slower (0.5x at 90
days) — integration runs 6-12 months. Hiring surges refresh with new postings.

## Stacking Rules

Multiple signals on the same account compound.

### Compound Scoring Formula

```
account_signal_score = sum(signal_base * decay_multiplier) * stack_bonus
```

| Active Signals | Stack Bonus | Logic |
|----------------|-------------|-------|
| 1 signal | 1.0x | No bonus |
| 2 signals | 1.3x | Two signals confirm intent |
| 3 signals | 1.6x | High-confidence account |
| 4+ signals | 2.0x (cap) | Maximum compound — diminishing returns |

### High-Value Combinations

| Combination | Extra Bonus | Interpretation |
|-------------|-------------|----------------|
| Funding + Hiring | +10 | Deploying capital into growth |
| Leadership change + Tech change | +10 | New leader evaluating stack |
| Funding + Leadership change | +8 | New money + new decision-maker |
| Product launch + Hiring (mktg) | +8 | Building demand gen muscle |
| Expansion + Hiring (sales) | +8 | Building pipeline in new market |

## Combining with ICP Score

```
priority_score = (icp_score * 0.5) + (signal_score * 0.5)
```

| Priority Tier | Score Range | Action |
|---------------|-------------|--------|
| Tier 1 — Now | 75-100 | Immediate personalized outreach |
| Tier 2 — Soon | 50-74 | Outreach within 7 days |
| Tier 3 — Watch | 25-49 | Add to nurture sequence |
| Tier 4 — Pass | 0-24 | Do not contact — wait for signals |

For signal-first campaigns, shift to 0.4 ICP / 0.6 signal. For ICP-first
campaigns, shift to 0.6 ICP / 0.4 signal.

## Implementation Notes

- Data sources: Clay, Bombora, Builtwith, LinkedIn Sales Nav, Crunchbase.
- Refresh signal data weekly. Stale data produces stale scores.
- Log signal-to-meeting conversion rates by type. After 90 days, re-calibrate
  base points using actual performance data.

## Evidence

[VERIFIED: Scoring model derived from Predictable Revenue, TOPO, and Forrester research]
[VALIDATED: Calibrated across signal-triggered campaigns at The Kiln]
