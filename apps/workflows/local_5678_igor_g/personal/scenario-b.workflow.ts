import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Scenario B — Sequential Orchestration
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                   webhook
// RunMarketer                      code
// SendMarketerCallback             httpRequest
// RunContentMaker                  code
// SendFinalCallback                httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger → RunMarketer → SendMarketerCallback → RunContentMaker → SendFinalCallback
// </workflow-map>

@workflow({
  id: '',
  name: 'Scenario B — Sequential Orchestration',
  active: false,
  settings: { executionOrder: 'v1' }
})
export class ScenarioBWorkflow {

  @node({
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    version: 2.1,
    position: [0, 0]
  })
  WebhookTrigger = {
    responseBinaryPropertyName: 'data',
    httpMethod: 'POST',
    path: 'scenario-b',
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
const scenario = payload.scenario || 'B';
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

// Build project context from profile (§6.3 / §12.1 ТЗ)
function buildProfileContext(profile) {
  if (!profile) return '';
  const lines = [
    '## Контекст проекта клиента',
    \`**Компания:** \${profile.companyName}\`,
    \`**Описание:** \${profile.description}\`,
    \`**Ниша:** \${profile.niche} | **География:** \${profile.geography}\`,
    profile.usp ? \`**УТП:** \${profile.usp}\` : null,
    profile.tov ? \`**Тон голоса (TOV):** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Обязательные слова:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**Запрещённые слова:** \${profile.forbidden.join(', ')}\` : null,
    profile.audience?.length
      ? \`**Целевая аудитория:**\\n\${profile.audience.map(a => \`- **\${a.segment}:** \${a.portrait}. Боли: \${(a.pain_points || []).join('; ')}\`).join('\\n')}\`
      : null,
    profile.competitors?.length
      ? \`**Конкуренты:**\\n\${profile.competitors.map(c => \`- \${c.name}: \${c.positioning}\`).join('\\n')}\`
      : null,
  ].filter(Boolean);
  return lines.join('\\n');
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
const ragChars = ragPromptPack.length;
const ragTokens = estimateTokens(ragPromptPack);

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

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: MAX_TOKENS_MARKETER_BRIEF,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-b.marketer',
    semanticCacheKey: \`scenario-b.marketer:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(JSON.stringify(projectProfile || {})))}:\${hashString(normalizeForCache(ragPromptPack))}\`,
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

// Pass compact RAG pack and brief digest through to content maker (avoids duplicate RAG fetch)
return [{ json: { executionId, taskId, projectId, input, callbackUrl, projectProfile, marketerOutput, briefDigest, ragShortlist, ragPromptPack, scenario } }];
`,
  };

  @node({
    name: 'Send Marketer Callback',
    type: 'n8n-nodes-base.httpRequest',
    version: 4.4,
    position: [440, 0]
  })
  SendMarketerCallback = {
    url: '={{ $json.callbackUrl }}',
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
      agentType: 'MARKETER',
      output: '={{ $json.marketerOutput }}',
      iteration: 1,
      status: 'completed',
    },
  };

  @node({
    name: 'Run Content Maker',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [660, 0]
  })
  RunContentMaker = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `
const item = $input.first().json;
const { executionId, taskId, projectId, input, callbackUrl, projectProfile, marketerOutput, briefDigest, ragPromptPack, scenario } = item;
const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_CONTENT_GENERATION = Number($env.MAX_TOKENS_CONTENT_GENERATION || 4096);
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
  const lines = [
    '## Параметры бренда',
    profile.tov ? \`**Тон голоса (TOV):** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Обязательные слова/фразы:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**НЕЛЬЗЯ использовать:** \${profile.forbidden.join(', ')}\` : null,
  ].filter(Boolean);
  return lines.join('\\n');
}

const profileContext = buildProfileContext(projectProfile);
const ragChars = (ragPromptPack || '').length;
const ragTokens = estimateTokens(ragPromptPack || '');

let handoff;
try {
  handoff = JSON.parse(marketerOutput);
} catch (e) {
  throw new Error('Invalid marketer handoff: expected strict JSON from docs/agent_protocol.md');
}
if (handoff?.from !== 'marketer' || handoff?.to !== 'content_maker' || handoff?.stage !== 'strategy_to_content') {
  throw new Error('Invalid marketer handoff: wrong from/to/stage');
}

// Agent handshake: content maker receives strict JSON from docs/agent_protocol.md
const systemPrompt = \`You are a Senior Content Strategist & Copywriter.
Create professional, platform-native, ready-to-publish content based on the brief digest and prompt pack.
Every deliverable must be complete — no placeholders.
Use Russian language unless specified.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}

## Brief digest
\${briefDigest}\`;

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: MAX_TOKENS_CONTENT_GENERATION,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-b.content_maker',
    semanticCacheKey: \`scenario-b.content_maker:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(briefDigest || ''))}:\${hashString(normalizeForCache(ragPromptPack || ''))}\`,
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

return [{ json: { executionId, taskId, projectId, callbackUrl, contentOutput } }];
`,
  };

  @node({
    name: 'Send Final Callback',
    type: 'n8n-nodes-base.httpRequest',
    version: 4.4,
    position: [880, 0]
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
      iteration: 1,
      status: 'completed',
    },
  };

  @links()
  defineRouting() {
    this.WebhookTrigger.out(0).to(this.RunMarketer.in(0));
    this.RunMarketer.out(0).to(this.SendMarketerCallback.in(0));
    this.SendMarketerCallback.out(0).to(this.RunContentMaker.in(0));
    this.RunContentMaker.out(0).to(this.SendFinalCallback.in(0));
  }
}
