# PRD-001 Technical API Contracts

## Status

Draft (implementation contract for PRD-001)

## Purpose

Defines concrete API contracts for:

- Internal config API
- Model metadata endpoints
- External dependency integration behavior

## 1) Internal Config API (v1)

Protocol:

- Primary: REST/JSON over HTTPS
- Secondary: gRPC parity planned for v2 (same schema semantics)

Auth:

- Service-to-service: Bearer token (JWT)
- User-driven admin calls: RBAC-scoped JWT with `forge.config.write`

### 1.1 GET /api/forge/config/mappings

Purpose: list effective agent-model mappings.

Response - 200:

```json
{
  "version": "2026.03",
  "generatedAt": "2026-03-10T08:00:00Z",
  "mappings": [
    {
      "agentId": "backend.api-refactor",
      "team": "backend",
      "modelId": "gpt-5.3-codex-high",
      "weights": {
        "code": 30,
        "reasoning": 25,
        "cost": 10,
        "context": 25,
        "speed": 5,
        "compatibility": 5
      },
      "updatedAt": "2026-03-09T11:44:00Z",
      "updatedByRef": "usr_7f3c9a2e"
    }
  ]
}
```

### 1.2 PUT /api/forge/config/mappings/{agentId}

Purpose: upsert one mapping.

Request:

```json
{
  "team": "backend",
  "modelId": "claude-opus-4-6",
  "weights": {
    "code": 30,
    "reasoning": 25,
    "cost": 10,
    "context": 25,
    "speed": 5,
    "compatibility": 5
  },
  "reason": "High-context refactor sprint"
}
```

Validation rules:

- `agentId`, `team`, `modelId` required
- all weights required, integer range `0-100`
- sum of weights must equal `100`
- `reason` required for updates to existing agent mapping (when agentId already exists). Optional for initial creation.
- API determines create vs update by checking existence of agentId in datastore.

Examples:

Create (no reason required):
```json
{
  "agentId": "backend.api-refactor",
  "modelId": "claude-opus-4-6",
  "team": "backend",
  "weights": {
    "quality": 5,
    "reasoning": 4,
    "cost": 3,
    "context": 3,
    "speed": 2,
    "compatibility": 1,
    "lock_in": 1,
    "quirks": 1
  }
}
```

Update (reason required):
```json
{
  "agentId": "backend.api-refactor",
  "modelId": "claude-opus-4-6",
  "team": "backend",
  "weights": {
    "quality": 5,
    "reasoning": 4,
    "cost": 3,
    "context": 3,
    "speed": 2,
    "compatibility": 1,
    "lock_in": 1,
    "quirks": 1
  },
  "reason": "Updated to improve code generation quality"
}
```

Error when reason missing on update: `400 Bad Request - reason field required for updates`

Response - 200:

```json
{
  "ok": true,
  "agentId": "backend.api-refactor",
  "modelId": "claude-opus-4-6",
  "updatedAt": "2026-03-10T08:13:00Z",
  "auditEventId": "evt_01J2..."
}
```

### 1.3 POST /api/forge/config/validate

Purpose: dry-run validate mapping payload without persisting.

Request:

```json
{
  "mappings": [
    {
      "agentId": "backend.api-refactor",
      "team": "backend",
      "modelId": "gpt-5.2-codex-high",
      "weights": {
        "code": 30,
        "reasoning": 25,
        "cost": 10,
        "context": 25,
        "speed": 5,
        "compatibility": 5
      }
    }
  ]
}
```

Response - 200:

```json
{
  "valid": true,
  "errors": [],
  "warnings": []
}
```

### 1.4 Error Codes

- `400` invalid schema/weights
- `401` unauthenticated
- `403` insufficient RBAC scope
- `404` unknown agent/model/team
- `409` optimistic concurrency conflict
- `422` policy validation failed
- `429` rate limited
- `500` internal error
- `503` downstream provider unavailable

## 2) Model Metadata Endpoints (v1)

Supported providers:

- OpenAI
- Anthropic
- Google
- DeepSeek
- Mistral
- Cohere
- xAI
- OSS catalogs (Hugging Face model cards)

### 2.1 GET /api/forge/models/list

Returns normalized model catalog.

Response fields:

- `modelId`
- `provider`
- `family`
- `contextWindow`
- `maxOutput`
- `pricing` (`inputPer1M`, `outputPer1M`, `currency`)
- `capabilities` (`toolUse`, `vision`, `jsonMode`, `reasoningMode`)
- `reliabilityTier`
- `sourceQuality` (`vendor-claim`, `independent-benchmark`, `internal-telemetry`)
- `sourceUpdatedAt`

### 2.2 GET /api/forge/models/{modelId}/metrics

Returns benchmark and telemetry rollup.

The response must always include these metric keys. Each metric is an object with:

- `value` (number or null): The metric value, null indicates not available
- `status` ("current" | "stale" | "not-evaluated"): Data availability indicator

Required keys (always present, value may be null):

- `sweBenchVerified`
- `aiderPassAt1`
- `aiderPassAt2`
- `costPerSuccess`
- `p95LatencyMs`
- `lastEvaluatedAt`

```json
{
  "sweBenchVerified": { "value": null, "status": "not-evaluated" },
  "aiderPassAt1": { "value": 45.2, "status": "current" },
  "aiderPassAt2": { "value": null, "status": "not-evaluated" },
  "costPerSuccess": { "value": 0.85, "status": "current" },
  "p95LatencyMs": { "value": 1250, "status": "current" },
  "lastEvaluatedAt": { "value": "2026-02-15T10:30:00Z", "status": "current" }
}
```

Each metric object contains:

- `value`: numeric value or null if unavailable
- `status`: "current", "stale", or "not-evaluated"

### 2.3 Polling and Cache Policy

- Provider polling cadence: every 6 hours
- Benchmark refresh cadence: weekly
- Metadata cache TTL: 24 hours
- Hard refresh trigger: provider release webhook or manual override

## 3) External Dependency Integration Pattern

### Authentication

- Store provider keys in secret manager only
- No plaintext keys in config files or logs

### Rate Limiting

- Provider-specific token bucket guardrails
- Global per-provider budget caps

### Retry and Backoff

- Retryable statuses: `429`, `500`, `502`, `503`, `504`
- Backoff: exponential with jitter - delays before each retry: `250ms`, `500ms`, `1s`, `2s`, capped at `5s`
- Max retries: 4 (4 retry attempts = 5 total attempts including initial request)

### Fallback Behavior

On repeated provider failure:

1. mark primary model unhealthy
2. route to next compatible model in same score band where possible
3. write audit event (`fallback_triggered`)
4. surface warning in orchestrator state and events log

## 4) Data Contracts and Compatibility Notes

- All timestamps are ISO-8601 UTC
- All IDs are stable lowercase alphanumeric allowing dots (.), dashes (-), and underscores (_), except `updatedByRef` pseudonymous refs (examples: agentId, modelId, auditEventId)
- Backward compatible additions allowed; breaking changes require version bump
- v1 uses REST contract as source of truth; gRPC parity must preserve field names and semantics
