import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = '/Users/igorgurbamov/ai-marketing-platform';

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

const scenarioA = read('apps/workflows/local_5678_igor_g/personal/scenario-a.workflow.ts');
const scenarioB = read('apps/workflows/local_5678_igor_g/personal/scenario-b.workflow.ts');
const scenarioC = read('apps/workflows/local_5678_igor_g/personal/scenario-c.workflow.ts');
const scenarioD = read('apps/workflows/local_5678_igor_g/personal/scenario-d.workflow.ts');
const callbackRoute = read('apps/api/src/routes/callback.ts');
const scoringService = read('apps/api/src/services/scoring.ts');
const claude = read('packages/ai-engine/src/claude.ts');
const tokenMonitor = read('packages/ai-engine/src/token-monitor.ts');
const knowledgeRoute = read('apps/api/src/routes/knowledge.ts');
const ragPack = read('packages/ai-engine/src/rag-pack.ts');
const orchestrationSpec = read('specs/agent-orchestration.md');
const ragSpec = read('specs/knowledge-rag.md');
const tokenMonitoringSpec = read('specs/token-monitoring.md');
const architectureDoc = read('docs/ARCHITECTURE.md');
const envExample = read('.env.example');
const envSetup = read('docs/ENV_SETUP.md');
const tasksRoute = read('apps/api/src/routes/tasks.ts');
const sharedSchemas = read('packages/shared/src/schemas.ts');

assert.equal(
  (scenarioB.match(/knowledge\/search\?q=/g) || []).length,
  1,
  'Scenario B should fetch knowledge/search only once per execution'
);
assert.equal(
  (scenarioD.match(/knowledge\/search\?q=/g) || []).length,
  1,
  'Scenario D should fetch knowledge/search only once per execution'
);

assert.match(
  scenarioB,
  /briefDigest/,
  'Scenario B should pass a brief digest instead of the full repeated RAG context'
);
assert.match(
  scenarioB,
  /ragPromptPack/,
  'Scenario B should pass a compact ragPromptPack'
);
assert.doesNotMatch(
  scenarioB,
  /function buildRagArtifacts/,
  'Scenario B should not build rag prompt packs locally in the workflow'
);
assert.doesNotMatch(
  scenarioD,
  /function buildRagArtifacts/,
  'Scenario D should not build rag prompt packs locally in the workflow'
);

assert.match(
  scenarioD,
  /Delta-only revision context/,
  'Scenario D should use delta-only revision context'
);
assert.match(
  scenarioD,
  /const evaluationTarget = buildEvaluationTarget\(contentOutput\);/,
  'Scenario D evaluator should derive a compact evaluation target'
);
assert.match(
  scenarioD,
  /## Content Fragment to Evaluate/,
  'Scenario D evaluator prompt should use a content fragment instead of the full content'
);
assert.match(
  scenarioD,
  /const MIN_REVISION_FEEDBACK_CHARS = Number\(\$env\.MIN_REVISION_FEEDBACK_CHARS \|\| 40\);/,
  'Scenario D should allow configuring the minimum actionable revision feedback size'
);
assert.match(
  scenarioD,
  /function hasMeaningfulRevisionFeedback\(feedback\)/,
  'Scenario D should detect whether evaluator feedback is actionable before another revision'
);
assert.match(
  scenarioD,
  /shouldIterate: !\(evalResult\.passed \|\| false\) && hasMeaningfulRevisionFeedback\(evalResult\.feedback \|\| ''\)/,
  'Scenario D should only iterate when evaluation failed and evaluator feedback is actionable'
);
assert.doesNotMatch(
  scenarioD,
  /Run Content Maker[\s\S]*knowledge\/search\?q=/,
  'Scenario D content-maker step must not repeat knowledge/search'
);

assert.match(
  callbackRoute,
  /semanticCacheKey/,
  'Internal agent-completion route should accept semantic cache keys'
);
assert.match(
  scoringService,
  /makeSemanticCacheKey/,
  'Scoring should use semantic cache keys'
);
assert.match(
  claude,
  /semanticCacheKey/,
  'Claude runner should support semantic cache keys'
);
assert.match(
  claude,
  /const earlyCache = await getCachedResponse\(cacheKey\)/,
  'Claude runner should check exact cache before provider calls'
);
assert.match(
  orchestrationSpec,
  /fetch RAG once per execution/i,
  'Agent orchestration spec should document single-execution RAG reuse'
);
assert.match(
  ragSpec,
  /Two-stage RAG is used/i,
  'RAG spec should document two-stage RAG packing'
);
assert.match(
  knowledgeRoute,
  /buildRagPack/,
  'Knowledge route should build rag packs with the shared helper'
);
assert.match(
  ragPack,
  /export function buildRagPack/,
  'Shared rag pack helper should exist'
);
assert.match(
  tokenMonitor,
  /ai_tokens_used_by_operation_total/,
  'Prometheus metrics should expose token usage by operation'
);
assert.match(
  tokenMonitor,
  /token_usage:\$\{provider\}:by_operation/,
  'Token monitor should read by-operation Redis counters'
);
assert.match(
  tokenMonitoringSpec,
  /ai_tokens_used_by_operation_total/,
  'Token monitoring spec should document operation-level metrics'
);
assert.match(
  architectureDoc,
  /ai_tokens_used_by_operation_total/,
  'Architecture doc should document operation-level metrics'
);

// ── Fix A: Scenario C — single RAG fetch before fan-out ──────────────────────
assert.equal(
  (scenarioC.match(/knowledge\/search\?q=/g) || []).length,
  1,
  'Scenario C should fetch knowledge/search only once (in FetchRAG node before SplitInput)'
);
assert.match(
  scenarioC,
  /Fetch RAG/,
  'Scenario C should have a FetchRAG node before SplitInput'
);
assert.match(
  scenarioC,
  /ragPromptPack/,
  'Scenario C should pass ragPromptPack through payload to agent branches'
);

// ── Fix B: Scenario C — semanticCacheKey in both agent calls ─────────────────
assert.match(
  scenarioC,
  /scenario-c\.marketer.*semanticCacheKey|semanticCacheKey.*scenario-c\.marketer/s,
  'Scenario C RunMarketer should include semanticCacheKey in agent-completion call'
);
assert.match(
  scenarioC,
  /scenario-c\.content_maker.*semanticCacheKey|semanticCacheKey.*scenario-c\.content_maker/s,
  'Scenario C RunContentMaker should include semanticCacheKey in agent-completion call'
);

// ── Fix C: Token counter rolling window ──────────────────────────────────────
assert.match(
  tokenMonitor,
  /TOKEN_LIMIT_WINDOW_SECONDS/,
  'token-monitor should support TOKEN_LIMIT_WINDOW_SECONDS for rolling window limits'
);
assert.match(
  tokenMonitor,
  /client\.expire\(counterKey\(provider\), TOKEN_LIMIT_WINDOW_SECONDS\)/,
  'token-monitor should set Redis EXPIRE on counter when TOKEN_LIMIT_WINDOW_SECONDS > 0'
);

// ── Fix D: Evaluator uses Haiku, not Sonnet ───────────────────────────────────
assert.doesNotMatch(
  scenarioD.slice(scenarioD.indexOf("'scenario-d.evaluator'")),
  /claude-sonnet/,
  'Scenario D evaluator should not use Sonnet (use Haiku for compact JSON evaluation)'
);
// model appears before operation in JSON.stringify, so check both orderings within 400 chars
assert.ok(
  /claude-haiku[\s\S]{0,400}scenario-d\.evaluator|scenario-d\.evaluator[\s\S]{0,400}claude-haiku/.test(scenarioD),
  'Scenario D evaluator should use claude-haiku model'
);

// ── Fix 1: TOKEN_LIMIT_WINDOW_SECONDS documented ─────────────────────────────
assert.match(
  envExample,
  /TOKEN_LIMIT_WINDOW_SECONDS/,
  '.env.example should document TOKEN_LIMIT_WINDOW_SECONDS'
);
assert.match(
  envSetup,
  /TOKEN_LIMIT_WINDOW_SECONDS/,
  'ENV_SETUP.md should document TOKEN_LIMIT_WINDOW_SECONDS'
);

// ── Fix 2: Scenario C FetchRAG reads promptPack from API, not local buildRagArtifacts ──
assert.doesNotMatch(
  scenarioC,
  /function buildRagArtifacts/,
  'Scenario C FetchRAG should not define buildRagArtifacts locally — use d.promptPack from API'
);
assert.match(
  scenarioC,
  /d\.promptPack/,
  'Scenario C FetchRAG should read promptPack from the knowledge API response'
);

// ── Fix 3: Scenario A has semanticCacheKey ────────────────────────────────────
assert.match(
  scenarioA,
  /semanticCacheKey/,
  'Scenario A should include semanticCacheKey in agent-completion call'
);
assert.match(
  scenarioA,
  /ragPromptPack/,
  'Scenario A should use ragPromptPack from knowledge API (not raw ragData.data)'
);
assert.doesNotMatch(
  scenarioA,
  /ragData\.data/,
  'Scenario A should not manually map ragData.data — use promptPack from API'
);

// ── Fix 4: Scenario D buildProfileContext called once per node ────────────────
// Each node must not call buildProfileContext more than once in its template literal
const runMarketerNode = scenarioD.match(/RunMarketer\s*=\s*\{[\s\S]*?RunContentMaker/)?.[0] ?? '';
const runContentMakerNode = scenarioD.match(/RunContentMaker\s*=\s*\{[\s\S]*?RunEvaluator/)?.[0] ?? '';
assert.ok(
  (runMarketerNode.match(/buildProfileContext\(projectProfile\)/g) || []).length <= 1,
  'Scenario D RunMarketer should call buildProfileContext at most once (store in variable)'
);
assert.ok(
  (runContentMakerNode.match(/buildProfileContext\(projectProfile\)/g) || []).length <= 1,
  'Scenario D RunContentMaker should call buildProfileContext at most once (store in variable)'
);

// ── Fix 5: Scenario A model selection by task score ──────────────────────────
assert.match(
  scenarioA,
  /taskScore/,
  'Scenario A should read taskScore from payload for model selection'
);
assert.match(
  scenarioA,
  /claude-haiku/,
  'Scenario A should use claude-haiku for low-score tasks'
);
assert.match(
  sharedSchemas,
  /taskScore/,
  'OrchestratorWebhookPayload schema should include taskScore field'
);
assert.match(
  tasksRoute,
  /taskScore/,
  'tasks.ts should include taskScore in orchestrator payload'
);
assert.match(
  envExample,
  /HAIKU_SCORE_THRESHOLD/,
  '.env.example should document HAIKU_SCORE_THRESHOLD'
);

// ── Fix 6: In-flight deduplication in claude.ts ──────────────────────────────
assert.match(
  claude,
  /acquireInflightLock/,
  'claude.ts should acquire an in-flight lock before making API calls'
);
assert.match(
  claude,
  /releaseInflightLock/,
  'claude.ts should release the in-flight lock in a finally block'
);
assert.match(
  claude,
  /pollCacheUntilAvailable/,
  'claude.ts should poll cache when in-flight lock is held by another request'
);
assert.match(
  tokenMonitor,
  /acquireInflightLock/,
  'token-monitor should export acquireInflightLock'
);
assert.match(
  tokenMonitor,
  /NX.*true|NX: true/,
  'token-monitor in-flight lock should use Redis SET NX for atomicity'
);

console.log('token-economy validation passed');
