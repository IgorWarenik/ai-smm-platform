import { describe, it, expect } from 'vitest'
import {
  TOKEN_BUDGETS,
  getTokenBudget,
  getTokenBudgetForOperation,
  getTokenMetricsSnapshot,
  renderTokenPrometheusMetrics,
} from '@ai-marketing/ai-engine'

// No REDIS_URL set in test env → token-monitor returns safe zero-defaults.

describe('TOKEN_BUDGETS constants', () => {
  it('has all budget kinds with positive values', () => {
    expect(TOKEN_BUDGETS.scoring).toBeGreaterThan(0)
    expect(TOKEN_BUDGETS.evaluatorJson).toBeGreaterThan(0)
    expect(TOKEN_BUDGETS.marketerBrief).toBeGreaterThan(0)
    expect(TOKEN_BUDGETS.contentGeneration).toBeGreaterThan(0)
    expect(TOKEN_BUDGETS.revisionDelta).toBeGreaterThan(0)
  })

  it('default scoring budget is 512', () => {
    expect(TOKEN_BUDGETS.scoring).toBe(512)
  })

  it('contentGeneration is larger than scoring', () => {
    expect(TOKEN_BUDGETS.contentGeneration).toBeGreaterThan(TOKEN_BUDGETS.scoring)
  })
})

describe('getTokenBudget', () => {
  it('returns budget for each known kind', () => {
    expect(getTokenBudget('scoring')).toBe(TOKEN_BUDGETS.scoring)
    expect(getTokenBudget('evaluatorJson')).toBe(TOKEN_BUDGETS.evaluatorJson)
    expect(getTokenBudget('marketerBrief')).toBe(TOKEN_BUDGETS.marketerBrief)
    expect(getTokenBudget('contentGeneration')).toBe(TOKEN_BUDGETS.contentGeneration)
    expect(getTokenBudget('revisionDelta')).toBe(TOKEN_BUDGETS.revisionDelta)
  })
})

describe('getTokenBudgetForOperation', () => {
  it('maps scoring operations', () => {
    expect(getTokenBudgetForOperation('n8n.scoring')).toBe(TOKEN_BUDGETS.scoring)
    expect(getTokenBudgetForOperation('task.scoring.check')).toBe(TOKEN_BUDGETS.scoring)
  })

  it('maps evaluator operations', () => {
    expect(getTokenBudgetForOperation('agent.evaluator')).toBe(TOKEN_BUDGETS.evaluatorJson)
  })

  it('maps revision operations', () => {
    expect(getTokenBudgetForOperation('revision.delta')).toBe(TOKEN_BUDGETS.revisionDelta)
  })

  it('maps marketer operations', () => {
    expect(getTokenBudgetForOperation('marketer.brief')).toBe(TOKEN_BUDGETS.marketerBrief)
  })

  it('falls back to contentGeneration for unknown or missing operation', () => {
    expect(getTokenBudgetForOperation('unknown.op')).toBe(TOKEN_BUDGETS.contentGeneration)
    expect(getTokenBudgetForOperation()).toBe(TOKEN_BUDGETS.contentGeneration)
  })
})

describe('getTokenMetricsSnapshot — no-Redis fallback', () => {
  it('returns snapshot with claude and voyage providers', async () => {
    const snapshot = await getTokenMetricsSnapshot()
    expect(snapshot).toHaveProperty('claude')
    expect(snapshot).toHaveProperty('voyage')
  })

  it('snapshot entries have required fields', async () => {
    const snapshot = await getTokenMetricsSnapshot()
    for (const provider of ['claude', 'voyage'] as const) {
      expect(typeof snapshot[provider].used).toBe('number')
      expect(typeof snapshot[provider].limit).toBe('number')
      expect(snapshot[provider].limit).toBeGreaterThan(0)
      expect(typeof snapshot[provider].fallbackCount).toBe('number')
      expect(typeof snapshot[provider].costEstimateUsd).toBe('number')
      expect(typeof snapshot[provider].byOperation).toBe('object')
    }
  })

  it('used is 0 when Redis is unavailable', async () => {
    const snapshot = await getTokenMetricsSnapshot()
    expect(snapshot.claude.used).toBe(0)
    expect(snapshot.voyage.used).toBe(0)
  })
})

describe('renderTokenPrometheusMetrics — no-Redis fallback', () => {
  it('returns valid Prometheus text format', async () => {
    const metrics = await renderTokenPrometheusMetrics()
    expect(typeof metrics).toBe('string')
    expect(metrics).toContain('ai_tokens_used_total')
    expect(metrics).toContain('ai_token_limit')
    expect(metrics).toContain('provider="claude"')
    expect(metrics).toContain('provider="voyage"')
  })
})
