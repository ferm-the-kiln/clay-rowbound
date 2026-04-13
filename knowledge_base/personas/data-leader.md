---
name: DATA_LEADER_PERSONA
description: Head of Data / VP Data / CDO buyer archetype for GTM outbound
domain: personas
node_type: archetype
status: validated
last_updated: 2026-03-03
tags:
  - persona
  - buyer-archetype
  - outbound
topics:
  - data-engineering
  - machine-learning
  - data-quality
  - analytics
related_concepts:
  - "[[cto]]"
  - "[[vp-engineering]]"
  - "[[josh-braun-pvc]]"
---

# Head of Data / VP Data / Chief Data Officer

## Role

Owns the data platform, analytics, and ML/AI capabilities. Reports to CTO,
CEO, or COO depending on org structure. Responsible for turning raw data
into reliable decisions, predictions, and products. Straddles engineering
rigor and business impact — must prove ROI on every data investment.

## What They Own

- Data infrastructure: pipelines, warehouses, lakes, orchestration
- Data quality, governance, and lineage
- Analytics and BI: dashboards, self-serve reporting, data democratization
- ML/AI: model development, deployment, monitoring, and cost management
- Data team hiring, structure, and utilization
- Vendor selection for the data stack (often 8-15 tools)
- Data privacy and regulatory compliance (GDPR, CCPA, industry-specific)
- Cross-functional data enablement for Product, Marketing, Sales, Finance

## How They're Measured

- **Pipeline reliability**: uptime, freshness SLAs, data incident frequency
- **Data quality**: accuracy, completeness, consistency scores
- **Model performance**: accuracy, latency, drift detection, false positive rates
- **Cost efficiency**: cost per query, cost per inference, warehouse spend
- **Team utilization**: % time on strategic work vs maintenance and ad-hoc requests
- **Stakeholder adoption**: self-serve analytics usage, dashboard engagement
- **ROI on ML investments**: revenue or cost savings attributable to models

## What Keeps Them Up at Night

- Pipeline failures that break downstream dashboards and models silently
- Data quality issues that erode stakeholder trust in analytics
- ML model drift that degrades predictions without anyone noticing
- Spiraling cloud and warehouse costs (Snowflake/Databricks bills)
- Team buried in ad-hoc requests instead of strategic platform work
- Proving ROI on data/ML investments to justify headcount and budget
- Vendor sprawl: too many tools, too many integration points
- Regulatory exposure from poor data governance or lineage gaps

## Buying Triggers

- Data warehouse costs cross a threshold that triggers CFO scrutiny
- A production model fails visibly and causes a business impact
- New regulatory requirement demands better data governance or lineage
- Company decides to "become AI-first" and data team must scale capabilities
- Key data engineer or ML engineer leaves, exposing fragile pipelines
- Self-serve analytics initiative stalls because data isn't trustworthy
- Board or exec team asks for metrics the current stack can't reliably produce
- Evaluating consolidation after years of tool sprawl

## Language That Resonates

- "Reduce pipeline maintenance burden" / "fewer 2am alerts"
- "Reliable data, not just more data"
- "Cost per query reduction" / "warehouse spend optimization"
- "Works with your existing stack" (Snowflake, dbt, Airflow, etc.)
- "We helped [similar company] cut their data infra costs by X%"
- "Free your team from maintenance to focus on ML and analytics"
- "Observable and auditable" / "built-in lineage"

## Language to Avoid

- "Single pane of glass" (they've heard it from every vendor)
- "Replace your data stack" (terrifying — they built it carefully)
- "No-code" as the primary pitch (data leaders value engineering rigor)
- "AI-powered insights" without explaining the actual methodology
- "Democratize data" without acknowledging governance complexity
- Implying their current pipelines are bad (they know the problems)

## Best Outreach Channels

1. **Email** — technical and specific; reference their stack if visible
2. **LinkedIn** — engage on data engineering or ML content they share
3. **Data communities** (dbt Community, Data Engineering Weekly, MLOps Community)
4. **Meetups and conferences** (Data Council, dbt Coalesce, MLOps World)

## Best Opening Angles

1. **The cost optimization angle** — Reference visible signals of data
   scale (job postings for data engineers, public mentions of their
   data stack) and connect to specific cost reduction. Data leaders
   are always fighting the cost conversation with finance.

2. **The reliability angle** — Point to the operational burden of
   maintaining pipelines at their scale. Share a concrete metric from
   a peer company: incidents reduced, hours saved, freshness SLA
   improvements. Reliability is a universal pain.

3. **The team leverage angle** — Frame around the ratio of strategic
   work vs maintenance. Data leaders know their team spends 60-70%
   on maintenance. Show how you shift that ratio toward high-value
   ML and analytics work.

## Common Objections

- **"We already have [dbt/Airflow/Spark/etc.] for this."** — Position
  as complementary, not competitive. Show specifically how you integrate
  with their existing tool and what gap you fill.
- **"My team can build this."** — Acknowledge it. Then quantify: how
  many engineer-months, what's the maintenance cost, what do they
  deprioritize. Share a case study of a team that built then bought.
- **"We're mid-migration to [new warehouse/platform]."** — Ask about
  their timeline. Offer to help with the migration or position as
  something to evaluate post-migration. Stay in orbit.
- **"Data quality is our problem, not tooling."** — Agree — then show
  how your tooling makes data quality measurable, observable, and
  enforceable rather than aspirational.
- **"I can't add another tool to the stack."** — Reframe around
  consolidation. Show how you replace 2-3 existing tools or reduce
  total integration surface area.
