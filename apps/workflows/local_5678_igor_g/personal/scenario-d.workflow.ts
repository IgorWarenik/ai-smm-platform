import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Scenario D — Iterative Orchestration (Core product, §11.4 ТЗ)
// Nodes   : 7  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                   webhook
// RunMarketer                      code
// RunContentMaker                  code
// RunEvaluator                     code
// CheckIterations                  if
// SendIterationCallback            httpRequest
// SendFinalCallback                httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger → RunMarketer → RunContentMaker → RunEvaluator → CheckIterations
//   CheckIterations.out(0) [score < 80 && iter < 3 && meaningful feedback exists] → SendIterationCallback → RunContentMaker
//   CheckIterations.out(1) [score >= 80 || iter >= 3 || no actionable feedback] → SendFinalCallback
// </workflow-map>

@workflow({
  id: '',
  name: 'Scenario D — Iterative Orchestration',
  active: false,
  settings: { executionOrder: 'v1' }
})
export class ScenarioDWorkflow {

  @node({
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    version: 2.1,
    position: [0, 0]
  })
  WebhookTrigger = {
    responseBinaryPropertyName: 'data',
    httpMethod: 'POST',
    path: 'scenario-d',
    responseMode: 'onReceived',
    responseCode: 202,
  };

  @node({
    name: 'Run Marketer',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [220, 0]
  })
  RunMarketer = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `
const payload = $input.first().json.body;
const { executionId, taskId, projectId, input, callbackUrl, projectProfile } = payload;
const scenario = payload.scenario || 'D';
const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_MARKETER_BRIEF = Number($env.MAX_TOKENS_MARKETER_BRIEF || 2400);
const RAG_MAX_CHARS_PER_CHUNK = Number($env.RAG_MAX_CHARS_PER_CHUNK || 1200);
const RAG_MAX_TOTAL_CHARS = Number($env.RAG_MAX_TOTAL_CHARS || 4000);
const RAG_MIN_SIMILARITY = Number($env.RAG_MIN_SIMILARITY || 0.72);
const estimateTokens = (text) => Math.max(1, Math.ceil((text || '').length / 4));
const normalizeForCache = (text) => (text || '').toLowerCase().replace(/\\s+/g, ' ').trim();
const hashString = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

function buildProfileContext(profile) {
  if (!profile) return '';
  return [
    '## Контекст проекта',
    \`**Компания:** \${profile.companyName} | **Ниша:** \${profile.niche} | **География:** \${profile.geography}\`,
    profile.usp ? \`**УТП:** \${profile.usp}\` : null,
    profile.tov ? \`**TOV:** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Ключевые слова:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**Запрещено:** \${profile.forbidden.join(', ')}\` : null,
    profile.audience?.length
      ? \`**Аудитория:**\\n\${profile.audience.map(a => \`- \${a.segment}: \${a.portrait}\`).join('\\n')}\`
      : null,
    profile.competitors?.length
      ? \`**Конкуренты:**\\n\${profile.competitors.map(c => \`- \${c.name}: \${c.positioning}\`).join('\\n')}\`
      : null,
  ].filter(Boolean).join('\\n');
}

let ragShortlist = [];
let ragPromptPack = '';
try {
  const r = await fetch(\`\${API_BASE_URL}/api/projects/\${projectId}/knowledge/search?q=\${encodeURIComponent(input)}&limit=5&maxCharsPerChunk=\${RAG_MAX_CHARS_PER_CHUNK}&maxTotalChars=\${RAG_MAX_TOTAL_CHARS}&minSimilarity=\${RAG_MIN_SIMILARITY}\`, {
    headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN }
  });
  if (r.ok) {
    const d = await r.json();
    ragShortlist = d.shortlist || [];
    ragPromptPack = d.promptPack || '';
  }
} catch(e) {}

const profileContext = buildProfileContext(projectProfile);
const systemPrompt = \`You are a Senior Marketing Strategist.
Return ONLY valid JSON matching docs/agent_protocol.md for stage "strategy_to_content".
Do not wrap the JSON in Markdown. Do not add commentary.
Required shape:
{
  "from": "marketer",
  "to": "content_maker",
  "task_id": "\${taskId}",
  "project_id": "\${projectId}",
  "stage": "strategy_to_content",
  "summary": "1-3 short sentences",
  "inputs": {
    "audience": "string",
    "offer": "string",
    "positioning": "string",
    "constraints": ["string"],
    "must_include": ["string"],
    "must_avoid": ["string"]
  },
  "expected_output": {
    "format": "markdown",
    "deliverables": ["string"],
    "acceptance_criteria": ["string"]
  },
  "open_questions": []
}
Use Russian language inside string values unless specified.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}\`;
const ragChars = ragPromptPack.length;
const ragTokens = estimateTokens(ragPromptPack);

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: MAX_TOKENS_MARKETER_BRIEF,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-d.marketer',
    semanticCacheKey: \`scenario-d.marketer:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(JSON.stringify(projectProfile || {})))}:\${hashString(normalizeForCache(ragPromptPack))}\`,
    taskId,
    projectId,
    scenario,
    ragChars,
    ragTokens,
  }),
});
if (!response.ok) {
  throw new Error(\`Monitored marketer call failed: \${response.status} \${await response.text()}\`);
}
const result = await response.json();
const marketerOutput = result.data?.output || '';
let handoff;
try {
  handoff = JSON.parse(marketerOutput);
} catch (e) {
  throw new Error('Invalid marketer handoff: expected strict JSON from docs/agent_protocol.md');
}

const briefDigest = JSON.stringify({
  summary: handoff.summary,
  audience: handoff.inputs?.audience || '',
  offer: handoff.inputs?.offer || '',
  positioning: handoff.inputs?.positioning || '',
  constraints: handoff.inputs?.constraints || [],
  mustInclude: handoff.inputs?.must_include || [],
  mustAvoid: handoff.inputs?.must_avoid || [],
  deliverables: handoff.expected_output?.deliverables || [],
  acceptanceCriteria: handoff.expected_output?.acceptance_criteria || [],
});
const briefRef = \`\${taskId}:strategy:v1\`;

return [{ json: {
  executionId, taskId, projectId, input, callbackUrl, projectProfile, scenario,
  marketerOutput,
  briefDigest,
  briefRef,
  ragShortlist,
  ragPromptPack,
  contentOutput: '',
  evalFeedback: '',
  iteration: 1,
} }];
`,
  };

  @node({
    name: 'Run Content Maker',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [440, 0]
  })
  RunContentMaker = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `
const item = $input.first().json;
const { executionId, taskId, projectId, input, callbackUrl, projectProfile, marketerOutput, briefDigest, briefRef, ragPromptPack, evalFeedback, iteration, scenario } = item;
const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_CONTENT_GENERATION = Number($env.MAX_TOKENS_CONTENT_GENERATION || 4096);
const MAX_TOKENS_REVISION_DELTA = Number($env.MAX_TOKENS_REVISION_DELTA || 1500);
const estimateTokens = (text) => Math.max(1, Math.ceil((text || '').length / 4));
const normalizeForCache = (text) => (text || '').toLowerCase().replace(/\\s+/g, ' ').trim();
const hashString = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

function buildProfileContext(profile) {
  if (!profile) return '';
  return [
    '## Параметры бренда',
    profile.tov ? \`**TOV:** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Обязательные слова:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**Запрещено:** \${profile.forbidden.join(', ')}\` : null,
  ].filter(Boolean).join('\\n');
}

const profileContext = buildProfileContext(projectProfile);

// On revision iterations, include evaluator feedback (docs/agent_protocol.md — review_to_revision stage)
const revisionSection = evalFeedback && iteration > 1
  ? \`\\n\\n## Правки от Evaluator (итерация \${iteration - 1})\\n\${evalFeedback}\`
  : '';
const isRevision = iteration > 1;
const ragChars = isRevision ? 0 : (ragPromptPack || '').length;
const ragTokens = isRevision ? 0 : estimateTokens(ragPromptPack || '');

let handoff;
try {
  handoff = JSON.parse(marketerOutput);
} catch (e) {
  throw new Error('Invalid marketer handoff: expected strict JSON from docs/agent_protocol.md');
}
if (handoff?.from !== 'marketer' || handoff?.to !== 'content_maker' || handoff?.stage !== 'strategy_to_content') {
  throw new Error('Invalid marketer handoff: wrong from/to/stage');
}

const systemPrompt = \`You are a Senior Content Strategist & Copywriter. Create professional, ready-to-publish content.
Iteration: \${iteration}/3. If this is a revision, address ALL evaluator feedback precisely.
Use Russian language unless specified.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${!isRevision && ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}

\${isRevision
  ? \`## Delta-only revision context\\nBrief ref: \${briefRef}\\nBrief digest: \${briefDigest}\\nCurrent draft:\\n\${item.contentOutput}\${revisionSection}\`
  : \`## Brief digest\\n\${briefDigest}\`}\`;

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: iteration > 1 ? MAX_TOKENS_REVISION_DELTA : MAX_TOKENS_CONTENT_GENERATION,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-d.content_maker',
    semanticCacheKey: isRevision
      ? \`scenario-d.revision:\${hashString(normalizeForCache(briefDigest || ''))}:\${hashString(normalizeForCache(evalFeedback || ''))}:\${hashString(normalizeForCache(item.contentOutput || ''))}\`
      : \`scenario-d.content_maker:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(briefDigest || ''))}:\${hashString(normalizeForCache(ragPromptPack || ''))}\`,
    taskId,
    projectId,
    scenario,
    ragChars,
    ragTokens,
  }),
});
if (!response.ok) {
  throw new Error(\`Monitored content maker call failed: \${response.status} \${await response.text()}\`);
}
const result = await response.json();
const contentOutput = result.data?.output || '';

return [{ json: { ...item, contentOutput } }];
`,
  };

  @node({
    name: 'Run Evaluator',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [660, 0]
  })
  RunEvaluator = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `
const item = $input.first().json;
const { executionId, taskId, projectId, input, callbackUrl, marketerOutput, briefDigest, contentOutput, projectProfile, iteration, scenario } = item;
const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_EVALUATOR_JSON = Number($env.MAX_TOKENS_EVALUATOR_JSON || 1024);
const MAX_EVALUATOR_CONTENT_CHARS = Number($env.MAX_EVALUATOR_CONTENT_CHARS || 1800);
const MIN_REVISION_FEEDBACK_CHARS = Number($env.MIN_REVISION_FEEDBACK_CHARS || 40);
const normalizeForCache = (text) => (text || '').toLowerCase().replace(/\\s+/g, ' ').trim();
const hashString = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

function buildEvaluationTarget(text) {
  const source = String(text || '').trim();
  if (!source) return '';
  if (source.length <= MAX_EVALUATOR_CONTENT_CHARS) return source;

  const sections = source
    .split(/\\n\\s*\\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const picked = [];
  const pushUnique = (value) => {
    if (!value || picked.includes(value)) return;
    picked.push(value);
  };

  pushUnique(sections[0]);
  pushUnique(sections[Math.floor(sections.length / 2)]);
  pushUnique(sections[sections.length - 1]);

  let compact = picked.filter(Boolean).join('\\n\\n---\\n\\n');
  if (compact.length > MAX_EVALUATOR_CONTENT_CHARS) {
    compact = compact.slice(0, MAX_EVALUATOR_CONTENT_CHARS);
  }

  return compact;
}

function hasMeaningfulRevisionFeedback(feedback) {
  const normalized = String(feedback || '')
    .replace(/\\s+/g, ' ')
    .trim();

  if (!normalized) return false;
  if (normalized.length < MIN_REVISION_FEEDBACK_CHARS) return false;

  const genericOnly = [
    'ok',
    'looks good',
    'все хорошо',
    'всё хорошо',
    'нормально',
    'good',
    'pass',
  ];

  return !genericOnly.includes(normalized.toLowerCase());
}

// Send intermediate iteration callback so SSE can stream progress
try {
  const callbackResponse = await fetch(callbackUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executionId, agentType: 'CONTENT_MAKER', output: contentOutput,
      iteration, status: 'completed',
    }),
  });
  if (!callbackResponse.ok) {
    throw new Error(\`Content callback failed: \${callbackResponse.status} \${await callbackResponse.text()}\`);
  }
} catch(e) {
  throw new Error(\`Content callback failed: \${e instanceof Error ? e.message : String(e)}\`);
}

const evaluationTarget = buildEvaluationTarget(contentOutput);
const evalPrompt = \`You are a Quality Evaluator for marketing content. Evaluate the content against the brief.

## Strategic Brief
\${briefDigest || marketerOutput}

## Content Fragment to Evaluate
\${evaluationTarget}

Respond in JSON only:
{
  "score": <0-100>,
  "passed": <true if score >= 80>,
  "feedback": "<specific, actionable improvements if not passed, else empty string>"
}\`;

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    maxTokens: MAX_TOKENS_EVALUATOR_JSON,
    systemPrompt: 'You are a strict evaluator. Return JSON only.',
    userMessage: evalPrompt,
    operation: 'scenario-d.evaluator',
    semanticCacheKey: \`scenario-d.evaluator:\${hashString(normalizeForCache(briefDigest || marketerOutput || ''))}:\${hashString(normalizeForCache(evaluationTarget || ''))}\`,
    taskId,
    projectId,
    scenario,
    ragChars: 0,
    ragTokens: 0,
  }),
});
if (!response.ok) {
  throw new Error(\`Monitored evaluator call failed: \${response.status} \${await response.text()}\`);
}
const result = await response.json();
const rawText = result.data?.output || '{}';

let evalResult = { score: 0, passed: false, feedback: '' };
try {
  const jsonMatch = rawText.match(/\\{[\\s\\S]*\\}/);
  evalResult = JSON.parse(jsonMatch?.[0] || '{}');
} catch(e) {}

return [{ json: {
  ...item,
  evalScore: evalResult.score || 0,
  evalPassed: evalResult.passed || false,
  evalFeedback: evalResult.feedback || '',
  shouldIterate: !(evalResult.passed || false) && hasMeaningfulRevisionFeedback(evalResult.feedback || ''),
} }];
`,
  };

  // Decide: iterate or finalize (max 3 iterations per §11.4 ТЗ)
  @node({
    name: 'Check Iterations',
    type: 'n8n-nodes-base.if',
    version: 2.3,
    position: [880, 0]
  })
  CheckIterations = {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [
        {
          // Continue only when evaluation failed and there is actionable feedback.
          id: 'needs-revision',
          leftValue: '={{ $json.shouldIterate }}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'equals' }
        },
        {
          id: 'under-limit',
          leftValue: '={{ $json.iteration }}',
          rightValue: 3,
          operator: { type: 'number', operation: 'lt' }
        }
      ],
      combinator: 'and'
    },
    looseTypeValidation: false,
  };

  // Intermediate iteration: send eval output, bump iteration counter, loop back
  @node({
    name: 'Send Iteration Callback',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [1100, -80]
  })
  SendIterationCallback = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `
const item = $input.first().json;
// Evaluator's feedback posted as EVALUATOR agent output in iteration callback
try {
  const callbackResponse = await fetch(item.callbackUrl, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      executionId: item.executionId,
      agentType: 'EVALUATOR',
      output: item.evalFeedback,
      evalScore: item.evalScore,
      iteration: item.iteration,
      status: 'completed',
    }),
  });
  if (!callbackResponse.ok) {
    throw new Error(\`Evaluator callback failed: \${callbackResponse.status} \${await callbackResponse.text()}\`);
  }
} catch(e) {
  throw new Error(\`Evaluator callback failed: \${e instanceof Error ? e.message : String(e)}\`);
}

// Increment iteration and loop back to RunContentMaker
return [{ json: { ...item, iteration: item.iteration + 1 } }];
`,
  };

  @node({
    name: 'Send Final Callback',
    type: 'n8n-nodes-base.httpRequest',
    version: 4.4,
    position: [1100, 80]
  })
  SendFinalCallback = {
    url: '={{ $json.callbackUrl.replace("/callback", "/execution-complete") }}',
    method: 'POST',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Authorization', value: '={{ "Bearer " + $env.INTERNAL_API_TOKEN }}' },
      ]
    },
    sendBody: true,
    contentType: 'json',
    specifyBody: 'json',
    jsonBody: {
      executionId: '={{ $json.executionId }}',
      agentType: 'CONTENT_MAKER',
      output: '={{ $json.contentOutput }}',
      evalScore: '={{ $json.evalScore }}',
      iteration: '={{ $json.iteration }}',
      status: 'completed',
      // true when quality gate never passed — signals task.requiresReview = true
      iterationsFailed: '={{ !$json.evalPassed && $json.iteration >= 3 }}',
    },
  };

  @links()
  defineRouting() {
    this.WebhookTrigger.out(0).to(this.RunMarketer.in(0));
    this.RunMarketer.out(0).to(this.RunContentMaker.in(0));
    this.RunContentMaker.out(0).to(this.RunEvaluator.in(0));
    this.RunEvaluator.out(0).to(this.CheckIterations.in(0));
    // out(0) = needs revision: send intermediate result, then loop back
    this.CheckIterations.out(0).to(this.SendIterationCallback.in(0));
    this.SendIterationCallback.out(0).to(this.RunContentMaker.in(0));
    // out(1) = passed or max iterations reached: finalize
    this.CheckIterations.out(1).to(this.SendFinalCallback.in(0));
  }
}
