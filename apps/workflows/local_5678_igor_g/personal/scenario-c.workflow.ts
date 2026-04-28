import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Scenario C — Parallel Orchestration
// Nodes   : 7  |  Connections: 7
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook
// FetchRag                           code
// SplitInput                         code
// RunMarketer                        code
// RunContentMaker                    code
// MergeResults                       code
// SendFinalCallback                  httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → FetchRag
//      → SplitInput
//        → RunMarketer
//          → MergeResults
//            → SendFinalCallback
//        → RunContentMaker
//          → MergeResults (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'FHQ2xQ3gPviFJLrF',
    name: 'Scenario C — Parallel Orchestration',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class ScenarioCParallelOrchestrationWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '5fca9abc-aae9-400b-8ed0-76df04144084',
        webhookId: 'd97fbdd9-fa83-482d-ba8a-9b2628b41dd9',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 0],
    })
    WebhookTrigger = {
        responseBinaryPropertyName: 'data',
        httpMethod: 'POST',
        path: 'scenario-c',
        responseMode: 'onReceived',
        responseCode: 202,
    };

    @node({
        id: 'c78276da-87e4-4890-a8bf-d2213fc62d90',
        name: 'Fetch RAG',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [220, 0],
    })
    FetchRag = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const payload = $input.first().json.body;
const { projectId, input } = payload;
const API_BASE_URL = $env.API_BASE_URL;
const RAG_MAX_CHARS_PER_CHUNK = Number($env.RAG_MAX_CHARS_PER_CHUNK || 1200);
const RAG_MAX_TOTAL_CHARS = Number($env.RAG_MAX_TOTAL_CHARS || 4000);
const RAG_MIN_SIMILARITY = Number($env.RAG_MIN_SIMILARITY || 0.15);

// knowledge API already builds the prompt pack via buildRagPack helper — read it directly
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

// Spread all payload fields + RAG artifacts for downstream nodes
return [{ json: { ...payload, ragShortlist, ragPromptPack } }];
`,
    };

    @node({
        id: '012d6d84-9d55-4faa-b383-253cf2135f1e',
        name: 'Split Input',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [440, 0],
    })
    SplitInput = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const payload = $input.first().json;
// Return two copies — one for each agent branch; RAG artifacts already in payload
return [
  { json: { ...payload, branch: 'MARKETER' } },
  { json: { ...payload, branch: 'CONTENT_MAKER' } },
];
`,
    };

    @node({
        id: '7a26b5d0-1104-427d-a6ea-53f991de2097',
        name: 'Run Marketer',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [660, -80],
    })
    RunMarketer = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
if (item.branch !== 'MARKETER') return [];

const { executionId, taskId, projectId, input, callbackUrl, projectProfile, ragPromptPack } = item;
const scenario = item.scenario || 'C';
const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_MARKETER_BRIEF = Number($env.MAX_TOKENS_MARKETER_BRIEF || 2400);
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
    \`**Компания:** \${profile.companyName} | **Ниша:** \${profile.niche}\`,
    profile.usp ? \`**УТП:** \${profile.usp}\` : null,
    profile.tov ? \`**TOV:** \${profile.tov}\` : null,
    profile.audience?.length
      ? \`**Аудитория:** \${profile.audience.map(a => a.segment).join(', ')}\`
      : null,
  ].filter(Boolean).join('\\n');
}

// RAG context passed from FetchRAG node — no duplicate fetch
const ragChars = (ragPromptPack || '').length;
const ragTokens = estimateTokens(ragPromptPack || '');
const profileContext = buildProfileContext(projectProfile);

const systemPrompt = \`You are a Senior Marketing Strategist. Provide strategic analysis and recommendations.
Use Russian language unless specified.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}\`;

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: MAX_TOKENS_MARKETER_BRIEF,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-c.marketer',
    semanticCacheKey: \`scenario-c.marketer:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(JSON.stringify(projectProfile || {})))}:\${hashString(normalizeForCache(ragPromptPack || ''))}\`,
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
const output = result.data?.output || '';

return { json: { executionId, taskId, projectId, callbackUrl, agentType: 'MARKETER', output } };
`,
    };

    @node({
        id: '6d7a9c7e-ab21-4eef-ba53-052c8644fafe',
        name: 'Run Content Maker',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [660, 80],
    })
    RunContentMaker = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `
const item = $input.item.json;
if (item.branch !== 'CONTENT_MAKER') return [];

const { executionId, taskId, projectId, input, callbackUrl, projectProfile, ragPromptPack } = item;
const scenario = item.scenario || 'C';
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
  return [
    '## Параметры бренда',
    profile.tov ? \`**TOV:** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Обязательные слова:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**Запрещено:** \${profile.forbidden.join(', ')}\` : null,
  ].filter(Boolean).join('\\n');
}

// RAG context passed from FetchRAG node — no duplicate fetch
const ragChars = (ragPromptPack || '').length;
const ragTokens = estimateTokens(ragPromptPack || '');
const profileContext = buildProfileContext(projectProfile);

const systemPrompt = \`You are a Senior Content Strategist & Copywriter. Create ready-to-publish content.
Use Russian language unless specified.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}\`;

const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN, 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-6',
    maxTokens: MAX_TOKENS_CONTENT_GENERATION,
    systemPrompt,
    userMessage: input,
    operation: 'scenario-c.content_maker',
    semanticCacheKey: \`scenario-c.content_maker:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(JSON.stringify(projectProfile || {})))}:\${hashString(normalizeForCache(ragPromptPack || ''))}\`,
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
const output = result.data?.output || '';

return { json: { executionId, taskId, projectId, callbackUrl, agentType: 'CONTENT_MAKER', output } };
`,
    };

    @node({
        id: '99c69831-50b5-46e2-a985-5e69c39554ed',
        name: 'Merge Results',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [880, 0],
    })
    MergeResults = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const items = $input.all().map(i => i.json);
const first = items[0];

const marketerItem = items.find(i => i.agentType === 'MARKETER');
const contentItem = items.find(i => i.agentType === 'CONTENT_MAKER');

return [{
  json: {
    executionId: first.executionId,
    taskId: first.taskId,
    projectId: first.projectId,
    callbackUrl: first.callbackUrl,
    mergedOutput: JSON.stringify({
      marketer: marketerItem?.output || '',
      contentMaker: contentItem?.output || '',
    }),
  }
}];
`,
    };

    @node({
        id: '059788b3-1625-4cb9-96b1-b63f966bd960',
        name: 'Send Final Callback',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [1100, 0],
    })
    SendFinalCallback = {
        url: '={{ $json.callbackUrl.replace("/callback", "/execution-complete") }}',
        method: 'POST',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Content-Type',
                    value: 'application/json',
                },
                {
                    name: 'Authorization',
                    value: '={{ "Bearer " + $env.INTERNAL_API_TOKEN }}',
                },
            ],
        },
        sendBody: true,
        contentType: 'json',
        specifyBody: 'json',
        jsonBody: {
            executionId: '={{ $json.executionId }}',
            agentType: 'CONTENT_MAKER',
            output: '={{ $json.mergedOutput }}',
            iteration: 1,
            status: 'completed',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookTrigger.out(0).to(this.FetchRag.in(0));
        this.FetchRag.out(0).to(this.SplitInput.in(0));
        this.SplitInput.out(0).to(this.RunMarketer.in(0));
        this.SplitInput.out(0).to(this.RunContentMaker.in(0));
        this.RunMarketer.out(0).to(this.MergeResults.in(0));
        this.RunContentMaker.out(0).to(this.MergeResults.in(0));
        this.MergeResults.out(0).to(this.SendFinalCallback.in(0));
    }
}
