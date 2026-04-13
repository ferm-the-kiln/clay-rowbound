---
name: VP_ENGINEERING_PERSONA
description: VP/Head of Engineering buyer archetype for GTM outbound
domain: personas
node_type: archetype
status: validated
last_updated: 2026-03-03
tags:
  - persona
  - buyer-archetype
  - outbound
topics:
  - engineering-leadership
  - developer-experience
  - build-vs-buy
  - technical-debt
related_concepts:
  - "[[cto]]"
  - "[[product-leader]]"
  - "[[josh-braun-pvc]]"
---

# VP / Head of Engineering

## Role

Owns the engineering org's execution capacity. Reports to CTO or CEO.
Typically manages 20-200 engineers across multiple teams. Responsible for
translating product roadmap into shipped software while keeping the team
healthy, infrastructure stable, and costs predictable.

## What They Own

- Engineering team performance, hiring, retention, and culture
- Sprint velocity, release cadence, and deployment reliability
- Build vs buy decisions for tooling and infrastructure
- Developer experience (DX) — internal tooling, CI/CD, environments
- Technical debt prioritization and paydown scheduling
- Infrastructure cost management (cloud spend, vendor contracts)
- Incident response processes and on-call rotations
- Cross-functional delivery commitments with Product and Design

## How They're Measured

- **Shipping velocity**: features delivered per sprint, cycle time, lead time
- **System reliability**: uptime, MTTR, incident frequency
- **Engineering efficiency**: cost per engineer, cost per feature
- **Team health**: attrition rate, eNPS, hiring fill rate
- **Technical debt ratio**: % of sprints allocated to debt vs features
- **Cloud/infra spend**: month-over-month cost trends, cost per transaction

## What Keeps Them Up at Night

- Losing senior engineers to competitors (replacement cost: 6-9 months salary)
- Shipping velocity slowing as codebase complexity grows
- Build vs buy mistakes that create maintenance burdens for years
- Infrastructure costs growing faster than revenue
- Being the bottleneck between ambitious product roadmap and reality
- Security vulnerabilities or incidents that erode trust with leadership
- Context switching tax from too many concurrent initiatives

## Buying Triggers

- Team has grown 30%+ in the past year and existing tools are breaking
- A key engineer leaves and exposes single-points-of-failure
- Cloud costs cross a threshold that triggers executive scrutiny
- Post-incident review reveals systemic tooling or process gaps
- Board or CEO sets aggressive delivery timeline for a strategic initiative
- Developer satisfaction survey reveals tooling frustrations
- Build vs buy analysis shows internal tool maintenance exceeds vendor cost

## Language That Resonates

- "Reduce toil" / "eliminate undifferentiated heavy lifting"
- "Developer experience" / "developer velocity"
- "Time back to the team" / "fewer context switches"
- "Works with your existing stack" / "not another migration"
- "We've seen this pattern at [similar-stage company]"
- "Ship faster without adding headcount"
- "Measurable impact within one sprint"

## Language to Avoid

- "AI-powered" without specifics (triggers skepticism)
- "Revolutionize" / "transform" / "disrupt" (too salesy)
- "Easy to implement" (they know nothing is easy at scale)
- "Your engineers will love it" (patronizing — they know their team)
- "Enterprise-grade" (meaningless without proof)
- Feature dumps or spec sheets in cold outreach

## Best Outreach Channels

1. **Email** — primary channel; keep it short and technical
2. **LinkedIn** — works if you engage with their content first
3. **Slack communities** (Rands Leadership, CTO Craft) — warm intros
4. **GitHub / open source engagement** — credibility builder, not direct pitch

## Best Opening Angles

1. **The scaling pain angle** — Reference a specific growth signal (new
   job postings, funding round, product launch) and connect it to the
   scaling challenge your product solves. Most effective when timed to
   a visible inflection point.

2. **The developer experience angle** — Point to a specific DX friction
   (slow CI, environment drift, manual deploys) that your product
   eliminates. Works best when you can cite a comparable company that
   measured the improvement.

3. **The build vs buy angle** — Acknowledge they could build it internally,
   then quantify the hidden cost (engineer-months, maintenance burden,
   opportunity cost). Effective when their team is visibly stretched.

## Common Objections

- **"We can build this ourselves."** — Don't argue. Ask what they'd
  deprioritize to staff it, and share the maintenance cost curve from
  similar companies who built then switched.
- **"We're in the middle of a migration / replatform."** — Offer to
  help after. Ask when they expect to stabilize. Set a follow-up.
- **"I need to see it work with our stack."** — Offer a proof-of-concept
  scoped to one team or one repo. Remove the risk of a big commitment.
- **"My team is skeptical of new tools."** — Suggest a bottom-up trial
  with one willing team. Let engineers evaluate, not just leadership.
- **"We don't have budget for this right now."** — Reframe around cost
  savings or headcount efficiency. Connect to the metric they're already
  being measured on.
