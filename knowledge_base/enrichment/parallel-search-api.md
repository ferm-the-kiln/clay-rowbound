# Parallel AI — API Reference

> Source: parallel.ai docs (Context7, April 2026)

## Authentication

- **Header**: `x-api-key: $PARALLEL_API_KEY`
- **Base URL**: `https://api.parallel.ai`
- **Python SDK**: `from parallel import Parallel`

---

## 1. Task API — Structured Enrichment

**Endpoint**: `POST /v1/tasks/runs`

The primary enrichment engine. Send natural language + structured schemas, get back structured JSON with citations and confidence scores.

### Processors

| Processor | Use Case | Tradeoff |
|-----------|----------|----------|
| `base` | Quick lookups | Fastest, cheapest |
| `core` | Standard enrichment | Balanced cost/quality |
| `ultra` | Deep research reports | Highest quality, slowest |

### Company Enrichment Example

```python
from parallel import Parallel
import os

client = Parallel(api_key=os.environ["PARALLEL_API_KEY"])

task_run = client.task_run.create(
    input={"company_name": "Stripe", "website": "stripe.com"},
    task_spec={
        "input_schema": {
            "type": "json",
            "json_schema": {
                "type": "object",
                "properties": {
                    "company_name": {"type": "string"},
                    "website": {"type": "string"}
                }
            }
        },
        "output_schema": {
            "type": "json",
            "json_schema": {
                "type": "object",
                "properties": {
                    "founding_year": {"type": "string"},
                    "employee_count": {"type": "string"},
                    "total_funding": {"type": "string"}
                },
                "required": ["founding_year", "employee_count", "total_funding"],
                "additionalProperties": False
            }
        }
    },
    processor="core"
)

run_result = client.task_run.result(task_run.run_id)
print(run_result.output.content)
```

### Deep Research (Text Output)

```bash
curl -X POST "https://api.parallel.ai/v1/tasks/runs" \
  -H "x-api-key: $PARALLEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "processor": "ultra",
    "input": "Create a comprehensive market research report on the HVAC industry...",
    "task_spec": {
      "output_schema": { "type": "text" }
    }
  }'
```

### Output Metadata

Each task run returns:
- `citations` — source URLs for each field
- `excerpts` — relevant text passages
- `reasoning` — how the answer was derived
- `confidence` — per-field confidence score (calibrated per processor)

### Retrieving Results

```python
run_result = client.task_run.result(task_run.run_id)
print(run_result.output.content)  # structured JSON or text
```

---

## 2. Search API — Web Search

**Endpoint**: `POST /v1beta/search`
**Required Header**: `parallel-beta: search-extract-2025-10-10`

AI-agent-optimized web search. Returns ranked URLs with extended excerpts suitable for LLM consumption.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objective` | string | Yes | What you're looking for |
| `search_queries` | array[string] | Yes | Keyword queries to execute |
| `max_results` | int | No | Max number of results |
| `excerpts.max_chars_per_result` | int | No | Chars per result excerpt |

### Example

```python
from parallel import Parallel
import os

client = Parallel(api_key=os.environ["PARALLEL_API_KEY"])

search = client.beta.search(
    objective="Find the current CEO of OpenAI and any recent leadership changes",
    search_queries=["OpenAI CEO", "OpenAI leadership 2026"],
    max_results=5,
    excerpts={"max_chars_per_result": 5000},
)

print(search.results)
```

### cURL

```bash
curl https://api.parallel.ai/v1beta/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PARALLEL_API_KEY" \
  -H "parallel-beta: search-extract-2025-10-10" \
  -d '{
    "objective": "Find the current CEO of OpenAI",
    "search_queries": ["OpenAI CEO", "OpenAI leadership 2026"],
    "max_results": 5,
    "excerpts": { "max_chars_per_result": 5000 }
  }'
```

### Response Shape

```json
{
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com/page",
      "content": "Extended excerpt with dense relevant information..."
    }
  ]
}
```

---

## 3. Extract API — URL Content Extraction

**Endpoint**: `POST /v1beta/extract`
**Required Header**: `parallel-beta: search-extract-2025-10-10`

Converts any public URL into clean, LLM-optimized markdown.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | array[string] | Yes | URLs to extract from |
| `objective` | string | No | Focus the extraction |
| `excerpts` | bool | No | Return relevant excerpts |
| `full_content` | bool | No | Return full page as markdown |

### Example

```python
from parallel import Parallel
import os

client = Parallel(api_key=os.environ["PARALLEL_API_KEY"])

extract = client.beta.extract(
    urls=["https://www.example.com/about"],
    objective="Extract company leadership and founding information",
    excerpts=True,
    full_content=False,
)

print(extract.results)
```

### cURL

```bash
curl https://api.parallel.ai/v1beta/extract \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PARALLEL_API_KEY" \
  -H "parallel-beta: search-extract-2025-10-10" \
  -d '{
    "urls": ["https://www.example.com/about"],
    "objective": "Extract company leadership and founding information",
    "excerpts": true,
    "full_content": false
  }'
```

---

## 4. FindAll API — Entity Discovery

**Endpoint**: `POST /v1beta/findall/runs`

Discovers and evaluates entities matching complex criteria from natural language. Auto-generates match conditions, discovers candidates, evaluates each against criteria.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `objective` | string | Yes | What to find |
| `entity_type` | string | Yes | Type of entity (e.g. "startups") |
| `match_conditions` | array | Yes | Conditions to filter entities |
| `generator` | string | Yes | Processor: "base" or "core" |
| `match_limit` | int | No | Max number of matches |

### Example

```python
import requests

url = "https://api.parallel.ai/v1beta/findall/runs"
payload = {
    "objective": "Find all AI companies that raised Series A funding in 2024",
    "entity_type": "companies",
    "match_conditions": [
        {
            "name": "ai_focus_check",
            "description": "Company must be primarily focused on AI/ML products or services."
        },
        {
            "name": "series_a_2024_check",
            "description": "Company must have raised Series A funding in 2024."
        }
    ],
    "generator": "core",
    "match_limit": 100
}

headers = {
    "x-api-key": os.environ["PARALLEL_API_KEY"],
    "Content-Type": "application/json"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

### Ingest (Natural Language to Spec)

`POST /v1beta/findall/ingest` — transforms a natural language objective into a structured FindAll specification with auto-generated match conditions.

### Features

- Streaming events via SSE
- Webhook callbacks for completed results
- Detailed reasoning, citations, and confidence per match

---

## 5. Task Groups (Beta) — Batch Execution

**Endpoint**: `POST /v1beta/tasks/groups`

Batch hundreds or thousands of tasks as a single group.

### Features

- Group-level monitoring and progress tracking
- Real-time updates via Server-Sent Events (SSE)
- Add tasks to an existing running group
- Group-level retry and error aggregation
- Failure handling per task

---

## 6. Chat API (Beta) — Conversational

Programmatic chat-style text generation interface. Accepts message sequences, returns model responses. Supports streaming.

---

## Quick Reference

| API | Endpoint | Use Case |
|-----|----------|----------|
| Task | `POST /v1/tasks/runs` | Structured enrichment (company, people, data) |
| Search | `POST /v1beta/search` | Web search with LLM-ready excerpts |
| Extract | `POST /v1beta/extract` | URL to clean markdown |
| FindAll | `POST /v1beta/findall/runs` | Discover entities matching criteria |
| Task Groups | `POST /v1beta/tasks/groups` | Batch task execution |
| Chat | Beta | Conversational interface |
