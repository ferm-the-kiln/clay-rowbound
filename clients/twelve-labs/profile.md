# Twelve Labs

## Company
- **Domain:** twelvelabs.io
- **Industry:** AI / Video Intelligence / Developer Tools
- **Size:** ~150+ employees (doubled headcount in 2025)
- **Stage:** Series A ($30M led by NEA + NVIDIA NVentures, Dec 2024). ~$110-130M total raised across all rounds.
- **HQ:** San Francisco, CA
- **Founded:** 2021

## Key People
- **CEO:** Jae Lee (founder)
- **President & CSO:** Yoon Kim (ex-Apple Siri architect, ex-SK Telecom CTO — joined Dec 2025)
- **Co-founders:** Soyoung Lee, Dave Chung, Aiden Lee, SJ Kim

## Sales Motion
- **Model:** Product-led growth (free tier → developer adoption → enterprise deal)
- **Free tier:** 600 minutes, no credit card required
- **Typical cycle:** Developer tries API → builds POC → eng manager approves budget → enterprise deal
- **Enterprise cycle:** 2-4 months (security review, procurement)
- **Champions:** Individual developers who tried the API and loved it
- **Blockers:** Security review, vendor approval, "build vs buy" debates

## Sequence Strategy
Developer-tool sales require technical credibility, not sales pressure.

### Cadence
- **Touches:** 5-7 over 3 weeks
- **Channels:** Email (primary), LinkedIn (secondary). No cold calls for developers.
- **Spacing:** Day 1 → Day 3 → Day 7 → Day 10 → Day 14 → Day 21

### Touch Sequence
| Touch | Channel | Purpose | Content |
|-------|---------|---------|---------|
| 1 | Email | Pain-based opener | Lead with their specific video challenge, no product pitch |
| 2 | LinkedIn | Connect + note | Short, reference the email topic, add a technical insight |
| 3 | Email | Value-add | Case study or technical comparison relevant to their stack |
| 4 | Email | Direct ask | "Would it be useful to see how [similar company] solved this?" |
| 5 | Email | Break-up or new angle | Either close the loop or pivot to a different pain point |

### Rules for Developer Audiences
- Never open with "I hope this email finds you well" — developers hate that
- Lead with a technical observation about their product/stack, not a pitch
- Link to docs or technical content, not marketing pages
- Keep emails under 100 words — developers skim aggressively
- PS line with free tier link: "PS — 600 free minutes, no credit card: twelvelabs.io"

## What They Sell

Twelve Labs builds a **video understanding platform** — an API that lets developers
search, analyze, summarize, and embed video content using multimodal AI models.

Think of it as "Google for video" — instead of tagging videos manually, developers
use natural language queries to find exact moments inside videos. Their models
(Marengo for search, Pegasus for generation) understand visual frames, audio,
speech, and temporal relationships simultaneously.

**Key products:**
- **Semantic Video Search** — find the exact moment in a video using natural language
- **Video-to-Text Generation** — summaries, reports, captions, chapter splits
- **Multimodal Embeddings (Embed API)** — vector representations for RAG, similarity search
- **Classification & Clustering** — auto-categorize video content at scale
- **Image-to-Video Search** — find similar scenes using an image as query

**Models:**
- Marengo 3.0 (Dec 2025) — search + indexing. New: composed text+image search in a single query, Embed API v2 with async/sync endpoints, supports text/images/audio/video embeddings. Auto-reindexing rolling out March 2026.
- Pegasus 1.2 — generation (summaries, captions, Q&A from video). Supports long videos up to 1 hour. 36,000x cheaper than Google Gemini 1.5 Pro. Timestamp grounding. Available in 7 regions.
- Both available on AWS Bedrock as fully managed services (since July 2025)

**Pricing:** Usage-based. Free tier = 600 minutes. Indexed storage ~$0.09/video-hour/month.
SDKs for Python and Node.js.

## Positioning
For engineering teams building video-powered products, Twelve Labs is the
video understanding API that lets you search, analyze, and generate from
video using purpose-built multimodal models — unlike general-purpose LLMs
that treat video as a series of image frames.

## Target ICP — Who Twelve Labs Sells To

### Primary Buyers
| Title | Why They Buy | What They Care About |
|-------|-------------|---------------------|
| VP/Head of Engineering | Build video features without training own models | API reliability, latency, accuracy, cost per minute |
| CTO / Technical Co-founder | Need video intelligence as a core product capability | Model quality, embedding flexibility, scalability |
| Product Manager (AI/ML) | Add video search/analysis to existing product | Time-to-integration, SDK quality, use case fit |
| Head of Data / ML Engineer | Video understanding in data pipelines | Embeddings quality, vector DB integrations, batch processing |

### Secondary Buyers
| Title | Why They Buy | What They Care About |
|-------|-------------|---------------------|
| VP Content / Media Ops | Search massive video archives, automate tagging | Accuracy on their content type, workflow integrations |
| Head of Security | Automated surveillance analysis at scale | Detection accuracy, real-time processing, compliance |
| Director of Sports Analytics | Auto-generate highlights, search game footage | Sport-specific accuracy, speed, highlight generation |

### ICP Firmographics
- **Company size:** 50-5,000 employees (mid-market to enterprise)
- **Verticals:** Media & Entertainment, Security/Surveillance, Sports, E-learning, AdTech, Healthcare (surgical video)
- **Technical signal:** Has engineering team, builds products (not just buys SaaS)
- **Video signal:** Company creates, hosts, or processes significant video content

### ICP Tech Stack Signals
- **Cloud:** AWS, GCP, Azure
- **Vector DBs:** Pinecone, Milvus, Weaviate, Qdrant
- **Data platforms:** Databricks, Snowflake, BigQuery
- **Video platforms:** Mux, Cloudflare Stream, AWS MediaConvert
- **ML/AI signals:** Uses embeddings, runs ML pipelines, has ML engineers

### Negative ICP (Don't Target)
- Non-technical buyers with no engineering team
- Companies with < 100 hours of video content
- Pure consumer plays with no API integration need
- Companies already building in-house video ML (Google, Meta, etc.)

## Vertical Messaging

### Media & Entertainment
- **Pain:** Thousands of hours of content, manual tagging, can't find the clip they need
- **Hook:** "From 10,000 hours to the exact moment — no more manual tagging"
- **Use case:** Asset search, auto-chaptering, content repurposing

### Security & Surveillance
- **Pain:** Human monitoring doesn't scale, reviewing footage is slow
- **Hook:** "Search every camera feed by description, not timestamp"
- **Use case:** Incident search, anomaly detection, automated alerts

### Sports Analytics
- **Pain:** Manual highlight clipping, slow game film review
- **Hook:** "Auto-generate highlights and search game footage by play type"
- **Use case:** Highlight generation, play-by-play search, performance analysis

### E-learning / EdTech
- **Pain:** Students can't find the right moment in lecture videos
- **Hook:** "Let students search inside lectures like they search Google"
- **Use case:** Lecture search, auto-chaptering, quiz generation from video

### AdTech
- **Pain:** Brand safety, ad placement verification, creative analysis at scale
- **Hook:** "Understand what's IN the video before your ad runs next to it"
- **Use case:** Content classification, brand safety, creative analysis

### Healthcare (Surgical Video)
- **Pain:** Surgical video libraries are unsearchable, training is manual
- **Hook:** "Search surgical video archives by procedure, technique, or outcome"
- **Use case:** Surgical training, procedure documentation, research

## Competitive Landscape
- **Direct:** Moments Lab, Mantis AI, LiveLink AI, Azure Video Indexer
- **Adjacent:** OpenAI (GPT-4V for video), Google (Gemini multimodal), Amazon Rekognition
- **Twelve Labs' edge:** Video-FIRST foundation models (not image models applied to video frames).
  Purpose-built for temporal relationships + multimodal understanding. Better accuracy
  on actual video comprehension benchmarks (not just frame-by-frame analysis).
- **Cost advantage:** Pegasus 1.2 is 36,000x cheaper than Google Gemini 1.5 Pro — powerful ammo for build-vs-buy and competitive conversations.

## Recent News & Signals (good for personalization)
- VAST Data partnership for unified video intelligence (Feb 2026)
- Marengo 3.0 launched with composed text+image search, Embed API v2 (Dec 2025)
- Yoon Kim hired as President & CSO — ex-Apple Siri architect, ex-SK Telecom CTO (Dec 2025)
- Firstman Studio (Squid Game creator Hwang Dong-hyuk) strategic investment (Oct 2025)
- LG CNS partnership for enterprise video intelligence (July 2025)
- AWS Bedrock: fully managed Marengo + Pegasus (July 2025)
- Naver Ventures strategic investment (June 2025)
- Pegasus 1.2 launched — long video (up to 1hr), 36,000x cheaper than Gemini 1.5 Pro (Feb 2025)
- Series A: $30M led by NEA + NVIDIA NVentures (Dec 2024)
- 30,000+ developers on the platform
- Partners: AWS, Databricks, Snowflake, Adobe, LG CNS, VAST Data, Naver
- Moving toward "agentic video intelligence" (autonomous video understanding agents)

## Messaging Hierarchy

### Primary (lead with this)
- "Build video intelligence into your product with a few API calls"

### Secondary (supporting proof)
- "Purpose-built video models — not image models applied to frames"
- "30,000+ developers already on the platform"

### Tertiary (use in follow-ups / PS lines)
- "One-time indexing, unlimited downstream tasks"
- "Available on AWS Bedrock as a managed service"

## Social Proof
- 30,000+ developers on the platform
- ~$110-130M total raised across all rounds
- Named customers: MLSE (Toronto sports franchise), Washington Post
- Partners: AWS, Databricks, Snowflake, Adobe, LG CNS, VAST Data, Naver
- Fully managed on AWS Bedrock (since July 2025)
- ~150+ employees, doubled headcount in 2025
- Strategic investors: NVIDIA NVentures, Naver Ventures, Firstman Studio (Squid Game creator)

## ROI Framework
Use these comparisons to make the business case concrete in outbound:

### Build vs. Buy Math
- **In-house cost:** 2-3 ML engineers × $200-300K/yr = $400-900K/yr, plus 6+ months to build, ongoing model retraining
- **Twelve Labs cost:** API usage starts at $0.033/min. Even at scale, a fraction of one ML engineer's salary
- **Time-to-value:** In-house = 6+ months. Twelve Labs = first API call in < 1 hour, production in 1-2 weeks
- **Opportunity cost:** Every month your ML team spends on video models is a month they're NOT building your core product

### ROI Triggers (when to use cost math)
- Prospect is hiring ML engineers → "That $300K hire gets you one model. This API gets you five capabilities."
- Prospect has existing video features that are slow → "How much revenue are you losing per month of delayed video search?"
- Prospect is evaluating build vs. buy → Lead with the time math, not the dollar math

## Integration Timeline
- **Free tier signup:** 5 minutes, no credit card
- **First API call:** < 1 hour with Python/Node SDK
- **POC (index + search own content):** 1-2 days
- **Production integration:** 1-2 weeks
- **Enterprise onboarding:** 2-4 weeks with dedicated support

Use in outbound to reduce perceived friction: "Most teams go from signup to working POC in a day."

## Case Study Patterns
Use these anonymized patterns in outbound. Replace with real case studies as they become available.

### Media Company (Content Search)
- **Before:** Editorial team spent 4+ hours/day manually searching 50,000+ hours of archive footage
- **After:** Natural language search across entire archive — find any moment in seconds
- **Result:** Content repurposing velocity increased, new revenue from previously buried footage

### Security Platform (Surveillance Intelligence)
- **Before:** Human operators monitoring camera feeds, reviewing incidents manually post-hoc
- **After:** API-powered search across all feeds — "show me every instance of X in the last 24 hours"
- **Result:** Incident response time dropped from hours to minutes

### EdTech Platform (In-Video Search)
- **Before:** Students scrubbed through hour-long lecture recordings to find specific topics
- **After:** Semantic search inside lectures — students type a question, jump to the exact moment
- **Result:** Student engagement with video content increased significantly

## Tone Preferences
- **Formality:** Technical but approachable. Developer-friendly.
- **Approach:** Lead with the technical capability, ground in specific use case
- **Things to avoid:** Overpromising on AI ("revolutionary"), vague claims, non-technical fluff

## Campaign Angles Worth Testing
1. **"Video is the new unstructured data"** — for data/ML leaders at companies drowning in video
2. **"Your users are searching text. Your content is video."** — for product leaders adding search
3. **"Stop building video ML in-house"** — for engineering leaders burning cycles on video models
4. **"From 10,000 hours to the exact moment"** — for media/content companies with massive archives
5. **"Video understanding, not video generation"** — differentiation from text-to-video hype

## Personas

### VP Engineering
- **Why they buy:** Team is burning cycles building video search/analysis in-house with stitched-together open-source models. Twelve Labs replaces months of ML engineering with API calls.
- **What they care about:** API reliability and latency, cost per minute of video processed, accuracy on their specific content type, not adding ML headcount
- **Opening angle:** "Stop building video ML in-house" — reference their eng team size and video-heavy product
- **Language that works:** "API-first", "ship in days not quarters", "one integration, multiple use cases", "purpose-built models"
- **Language to avoid:** "AI-powered" (too generic), "revolutionary" (overpromise), "end-to-end platform" (they want focused tools)

### CTO
- **Why they buy:** Needs video intelligence as a core product capability without the risk of training and maintaining foundation models in-house.
- **What they care about:** Model quality benchmarks, embedding flexibility for their architecture, vendor lock-in risk, scalability under load
- **Opening angle:** "Video understanding, not video generation" — differentiate from the GPT-4V / Gemini noise
- **Language that works:** "Foundation models purpose-built for video", "temporal understanding", "multimodal embeddings", "AWS Bedrock managed"
- **Language to avoid:** "Black box AI", anything that implies they can't evaluate the models themselves

### Data Leader
- **Why they buy:** Video is the largest unstructured data type they can't query. Twelve Labs makes video searchable and embeddable like text.
- **What they care about:** Embedding quality for RAG pipelines, vector DB integrations (Pinecone, Milvus), batch processing throughput, cost per inference
- **Opening angle:** "Video is the new unstructured data" — reference their data stack (Databricks, Snowflake)
- **Language that works:** "Multimodal embeddings", "video-to-vector", "batch indexing", "integrate with your existing data stack"
- **Language to avoid:** "Simple drag-and-drop" (they want technical depth), consumer-grade language

### Product Leader
- **Why they buy:** Users want to search and navigate video content, but current search is text-metadata only. Twelve Labs enables true semantic video search.
- **What they care about:** Time-to-integration, SDK quality, use case fit for their specific content type, user experience impact
- **Opening angle:** "Your users are searching text. Your content is video." — reference a specific feature gap in their product
- **Language that works:** "Semantic search", "natural language queries over video", "find the exact moment", "user engagement"
- **Language to avoid:** Infrastructure jargon (they care about user outcomes, not model architecture)

## Battle Cards

### vs OpenAI (GPT-4V for video)
- **Their pitch:** General-purpose multimodal AI that can understand images and video frames
- **Our edge:** Twelve Labs models are video-FIRST — they understand temporal relationships, audio-visual alignment, and scene progression. GPT-4V analyzes individual frames, missing what happens between them.
- **When they win:** Customer just needs basic frame-level description or already uses OpenAI for everything
- **When we win:** Customer needs actual video comprehension — searching for moments, understanding sequences, analyzing temporal patterns
- **Trap question:** "How does your current approach handle temporal relationships — like finding the moment someone says X while doing Y?"

### vs Google (Gemini multimodal)
- **Their pitch:** Massive multimodal model that handles text, images, audio, and video
- **Our edge:** Twelve Labs is purpose-built for video with dedicated search and generation APIs. Gemini is a generalist — good at many things, best-in-class at none for video-specific tasks. Pegasus 1.2 is **36,000x cheaper** than Gemini 1.5 Pro for video generation tasks.
- **When they win:** Customer is already deep in Google Cloud ecosystem and needs "good enough" video analysis
- **When we win:** Customer needs best-in-class video search accuracy, dedicated video APIs, cost efficiency, or runs on AWS/multi-cloud
- **Trap question:** "Have you benchmarked video search accuracy specifically, or are you evaluating general multimodal capabilities? And have you compared cost per video-hour?"

### vs Amazon Rekognition
- **Their pitch:** AWS-native video analysis — object detection, face recognition, content moderation
- **Our edge:** Rekognition does label-based analysis (objects, faces). Twelve Labs does semantic understanding (find the moment where the CEO discusses revenue growth). Completely different capability layer.
- **When they win:** Customer only needs basic object/face detection and is locked into AWS
- **When we win:** Customer needs semantic search, natural language queries, video summarization, or multimodal embeddings
- **Trap question:** "Can you search your video archive using a natural language question — like 'show me every scene where a customer complaint is discussed'?"

## Common Objections

### "We'll just use GPT-4V / Gemini for video"
General-purpose models analyze frames individually — they miss temporal
relationships. Ask: "Can your current approach find the moment where
someone says X while doing Y?" That requires understanding time, not
just pixels.

### "We can build this in-house with open-source models"
You can — and it'll take 6+ months of ML eng time, plus ongoing model
maintenance. Twelve Labs gives you production-grade video understanding
via API, so your team ships features instead of training models.

### "The cost per minute seems high"
Index once, query unlimited times. Compare: the cost of one ML engineer
for one month vs. a year of Twelve Labs API usage. Also: free tier =
600 minutes to prove ROI before committing.

### "We don't have enough video content to justify this"
If you have 100+ hours and growing, the ROI compounds. But if video isn't
core to your product, this probably isn't the right fit. (Negative ICP
honesty builds trust.)

### "How accurate is it on our specific content type?"
Best answer: "Let's test it." Free tier lets them index their own content
and evaluate. Benchmarks are public, but nothing beats testing on their
own data.

## Signal Playbook
| Signal | What It Means | Messaging Angle | Urgency |
|--------|--------------|-----------------|---------|
| Funding round | Scaling pressure, new budget | "Building video features post-raise" | High — 30 day window |
| Hiring ML/AI engineers | Building video/AI capabilities in-house | "Ship video intelligence without the ML hiring cycle" | High — they're spending now |
| Video product launch | Already investing in video, may need better tooling | "Level up your video features" | Medium |
| Partnership with video platform | Expanding video ecosystem | "Adding intelligence to your video pipeline" | Medium |
| Content library growth | More video = more need for search/analysis | "From 10,000 hours to the exact moment" | Medium |
| Competitor using Twelve Labs | Social proof / FOMO | "[Competitor] just shipped video search — here's how" | High |
| Tech stack includes vector DBs | Ready for embeddings-based approach | "Add video to your RAG pipeline" | Low — nurture |

## Discovery Questions
- "How does your team currently search or navigate video content?"
- "What happens when someone needs to find a specific moment in a video today?"
- "How much engineering time are you spending on video-related ML?"
- "What would change if your users could search inside video like they search text?"
- "How many hours of video content are you processing per month?"
- "Are you building video features in-house, or evaluating third-party APIs?"

## Champion Enablement
When the champion is a developer who tried the API and wants to sell internally:
- **No-approval entry:** Free tier (600 min, no credit card) — they can POC without asking anyone
- **Internal pitch points to arm them with:**
  - "We replaced 3 months of ML eng work with 2 days of API integration"
  - "One-time indexing, then unlimited search/summarize/classify on the same content"
  - "Already on AWS Bedrock — passes infra review automatically"
- **Assets to share:** API docs, public benchmarks, architecture diagram showing integration points
- **Key ask:** "Can you introduce me to whoever owns the video roadmap?"

## Multi-Threading Guide
Developer-tool enterprise deals rarely close single-threaded. Engage multiple stakeholders:

| Stage | Who to Engage | What They Need |
|-------|--------------|----------------|
| POC | Developer champion | API docs, free tier, SDK quickstart |
| Internal buy-in | Eng manager | ROI math, build-vs-buy comparison, integration timeline |
| Technical review | Staff/principal engineer | Architecture docs, latency benchmarks, security posture |
| Security review | InfoSec / compliance | SOC 2 status, data handling policy, AWS Bedrock managed option |
| Budget approval | VP Eng / CTO | Business case, competitor analysis, contract terms |

**Timing:** Start multi-threading after the champion confirms a successful POC — not before.
**Signal to escalate:** Champion says "I need to get buy-in from my manager" or "we'd need security to review this."

## Proven Responses
(Empty — populate as campaigns generate results)

## Active Campaigns
| Campaign | Angle | Status | Pipeline | Notes |
|----------|-------|--------|----------|-------|
