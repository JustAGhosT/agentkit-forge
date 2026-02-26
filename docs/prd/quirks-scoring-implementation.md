# Quirks Scoring Implementation Guide

**Last Updated:** 2026-02-26  
**Purpose:** Implement numerical scoring for model quirks in the AgentKit decision engine  
**Scope:** Integration with PRD-001 weighted decision matrix

## Overview

This document provides a concrete implementation plan for adding numerical quirk scoring to the decision engine. The current "quirks" dimension uses weight=1 but lacks specific scoring methodology.

## Scoring Framework

### Base Quirk Score Calculation

```
Base Quirk Score = (Positive Quirks × 0.1) - (Negative Quirks × 0.1) - (Operational Quirks × 0.05)
```

### Final Score Integration

```
Final Score = Weighted Score - lock_in_penalty - quirks_penalty
```

Where:
- `quirks_penalty = max(0, -Base Quirk Score)` (only negative scores become penalties)
- Positive quirk scores are added as bonuses

## Model-Specific Quirk Scores

### Anthropic Claude

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Native MCP Support | +0.3 | Unique competitive advantage |
| Positive | Consistent Output Quality | +0.2 | Reduces need for retries/validation |
| Positive | Strong Agentic Performance | +0.2 | Better for multi-step workflows |
| Negative | Verbose Near High Context | -0.2 | Increases token costs |
| Negative | Premium Pricing | -0.1 | Budget impact |
| Negative | Rate Limiting | -0.2 | Can block workflows |
| Operational | Context Window Inconsistency | -0.05 | Beta vs production confusion |
| **Net Score** | | **+0.15** | Slight positive overall |

### OpenAI GPT/Codex

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Token Efficiency (Codex) | +0.2 | Cost savings |
| Positive | Strong Tool Integration | +0.2 | Mature ecosystem |
| Positive | Extensive Profile Variants | +0.1 | Flexibility |
| Negative | Rate Limit Spikes | -0.3 | Major workflow disruption |
| Negative | Profile Complexity | -0.1 | Decision paralysis |
| Negative | Cost Volatility | -0.2 | Budget unpredictability |
| Operational | API Inconsistencies | -0.1 | Integration complexity |
| **Net Score** | | **-0.2** | Moderate negative overall |

### Google Gemini

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Massive Context (1M+) | +0.3 | Unique capability |
| Positive | Native Multimodal | +0.2 | Future-proofing |
| Positive | Speed Advantage (Flash) | +0.2 | Performance |
| Negative | Performance Inversion | -0.2 | Counterintuitive behavior |
| Negative | Preview Model Availability | -0.1 | Reliability concerns |
| Negative | Regional Variability | -0.1 | Inconsistent performance |
| Operational | API Evolution | -0.1 | Integration maintenance |
| **Net Score** | | **+0.1** | Slight positive overall |

### DeepSeek

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Open-Weight Breakthrough | +0.2 | No vendor lock-in |
| Positive | Cost-Effective Training | +0.1 | Efficient architecture |
| Positive | High Token Efficiency | +0.3 | Significant cost savings |
| Positive | Dual Mode Operation | +0.1 | Flexibility |
| Negative | Limited Transformers Support | -0.2 | Integration overhead |
| Negative | Vendor Documentation Only | -0.2 | Validation needed |
| Operational | API Model Mapping | -0.1 | Confusing endpoints |
| **Net Score** | | **+0.1** | Slight positive overall |

### xAI Grok

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | "Max Fun" Mode | +0.1 | Unique personality |
| Positive | Open Weights Available | +0.2 | No vendor lock-in |
| Positive | Tool-Use Training | +0.2 | Workflow optimization |
| Negative | Vendor-Reported Only | -0.3 | Validation needed |
| Negative | Limited Model Range | -0.1 | Fewer options |
| Operational | API Maturity | -0.1 | Stability concerns |
| **Net Score** | | **-0.1** | Slight negative overall |

### Zhipu AI GLM

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Token Efficiency Leader | +0.3 | Best in class |
| Positive | Cheapest API Pricing | +0.3 | Significant cost savings |
| Positive | Strong Multilingual | +0.2 | APAC advantage |
| Positive | Massive Scale | +0.1 | Capability |
| Negative | Limited Western Documentation | -0.1 | Integration barrier |
| Negative | APAC Region Focus | -0.1 | Latency elsewhere |
| Operational | Multiple Cost Tiers | -0.05 | Confusing pricing |
| **Net Score** | | **+0.65** | Strong positive overall |

### Mistral (Codestral)

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | European AI Champion | +0.1 | GDPR compliance |
| Positive | Strong FIM Support | +0.3 | Code completion excellence |
| Positive | Low-Latency Focus | +0.2 | Performance |
| Positive | Open Weights Available | +0.1 | No vendor lock-in |
| Negative | Limited Independent Data | -0.2 | Validation needed |
| Operational | Mamba Architecture | -0.05 | Integration complexity |
| **Net Score** | | **+0.35** | Moderate positive overall |

### Cohere Command

| Quirk Category | Specific Quirks | Score | Rationale |
| -------------- | ---------------- | ----- | --------- |
| Positive | Enterprise RAG Specialist | +0.3 | Domain excellence |
| Positive | Platform Coverage | +0.2 | Deployment flexibility |
| Positive | Strong Embeddings | +0.2 | Ecosystem strength |
| Positive | Tool-Using Agents | +0.1 | Workflow optimization |
| Negative | Limited Coding Data | -0.2 | Unknown performance |
| Negative | Enterprise Focus | -0.1 | Over-engineering risk |
| Operational | Platform Dependencies | -0.05 | Vendor lock-in |
| **Net Score** | | **+0.25** | Moderate positive overall |

## Implementation Steps

### Step 1: Update Data Model

Add to `.agentkit.yaml` schema:

```yaml
agents:
  backend:
    default_model: claude-3-5-sonnet
    quirks:
      positive: ["native_mcp", "consistent_quality", "strong_agentic"]
      negative: ["verbose_high_context", "premium_pricing", "rate_limiting"]
      operational: ["context_inconsistency"]
      scores:
        base: 0.15
        penalty: 0.0
        bonus: 0.15
```

### Step 2: Update Decision Engine

Modify scoring logic in `llm-decision-engine`:

```javascript
function calculateQuirksScore(agentConfig) {
  const { quirks } = agentConfig;
  let baseScore = 0;
  
  // Calculate positive contributions
  quirks.positive.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });
  
  // Calculate negative contributions
  quirks.negative.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });
  
  // Calculate operational contributions
  quirks.operational.forEach(quirk => {
    baseScore += QUIRK_SCORES[quirk] || 0;
  });
  
  return {
    base: baseScore,
    penalty: Math.max(0, -baseScore),
    bonus: Math.max(0, baseScore)
  };
}
```

### Step 3: Update Team Guides

Add quirks section to each `model-guide-*.md`:

```markdown
### Quirks Assessment

| Model | Base Score | Penalty | Bonus | Net Impact |
|-------|-------------|----------|--------|------------|
| Claude 3.5 Sonnet | +0.15 | 0.0 | +0.15 | Positive |
| GPT-4o | -0.20 | 0.20 | 0.0 | Negative |
| GLM-5 | +0.65 | 0.0 | +0.65 | Strong Positive |
```

### Step 4: Validation Process

1. **Team Feedback**: Collect real-world quirk observations
2. **Performance Monitoring**: Track quirk impact on workflows
3. **Regular Updates**: Quarterly quirk score reviews
4. **A/B Testing**: Compare quirk-adjusted vs baseline selections

## Configuration Examples

### Backend Team Configuration

```yaml
backend:
  model_preferences:
    primary: claude-3-5-sonnet
    fallback: deepseek-v3.2
  quirks_weighting:
    native_mcp: 0.4      # High value for backend
    token_efficiency: 0.3 # Cost sensitivity
    rate_limiting: -0.4   # Low tolerance
```

### Frontend Team Configuration

```yaml
frontend:
  model_preferences:
    primary: gemini-3-flash
    fallback: gpt-4o
  quirks_weighting:
    multimodal: 0.3      # UI/UX advantage
    speed_advantage: 0.4 # Fast iteration
    api_evolution: -0.2   # Stability preference
```

## Monitoring Metrics

### Quirk Impact Tracking

1. **Workflow Success Rate**: By model and quirk profile
2. **Cost Variance**: Actual vs expected by quirk adjustments
3. **User Satisfaction**: Quirk-related feedback scores
4. **Integration Issues**: Quirk-related technical problems

### Review Cadence

- **Weekly**: Monitor quirk impact metrics
- **Monthly**: Review quirk score adjustments
- **Quarterly**: Comprehensive quirk reassessment
- **As Needed**: Emergency quirk updates for major model changes

## Next Steps

1. **Validate Quirk Scores**: Review with each team for accuracy
2. **Prototype Implementation**: Test with one team first
3. **Refine Scoring**: Adjust based on real-world feedback
4. **Full Rollout**: Implement across all teams
5. **Continuous Improvement**: Establish monitoring and update process

---

**Owner**: Product Lead  
**Review Date**: 2026-03-31  
**Next Review**: 2026-06-30
