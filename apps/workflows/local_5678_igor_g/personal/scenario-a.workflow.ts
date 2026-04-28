import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Scenario A — Single Agent
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook
// DetectAgentType                    code
// RunAgent                           code
// SendCallback                       httpRequest
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → DetectAgentType
//      → RunAgent
//        → SendCallback
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'cpjookc84oIWGhe0',
    name: 'Scenario A — Single Agent',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class ScenarioASingleAgentWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '54cc8afd-e77e-4f85-a222-5fa0330b8fa1',
        webhookId: '5b69a828-dce5-455c-8a1e-f8e95a416a10',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 0],
    })
    WebhookTrigger = {
        responseBinaryPropertyName: 'data',
        httpMethod: 'POST',
        path: 'scenario-a',
        responseMode: 'onReceived',
        responseCode: 202,
    };

    @node({
        id: '7690a161-2588-4d30-97fc-bfa90c2c8351',
        name: 'Detect Agent Type',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [220, 0],
    })
    DetectAgentType = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const payload = $input.first().json.body;
const input = payload.input || '';

// Classify: if task is purely content-related → content_maker, else → marketer
const contentKeywords = ['напиши', 'пост', 'текст', 'контент', 'статья', 'caption', 'write', 'copy', 'script'];
const isContentTask = contentKeywords.some(kw => input.toLowerCase().includes(kw));

return [{
  json: {
    ...payload,
    agentType: isContentTask ? 'CONTENT_MAKER' : 'MARKETER',
  }
}];
`,
    };

    @node({
        id: 'e3e87787-63b8-41bc-a695-4696fb4f49fe',
        name: 'Run Agent',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [440, 0],
    })
    RunAgent = {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `
const item = $input.first().json;
const { executionId, taskId, projectId, input, agentType, callbackUrl, projectProfile } = item;
const scenario = item.scenario || 'A';
// Use Haiku for simpler tasks (score < 50) — ~20x cheaper; Sonnet for complex tasks
const taskScore = typeof item.taskScore === 'number' ? item.taskScore : 50;
const HAIKU_SCORE_THRESHOLD = Number($env.HAIKU_SCORE_THRESHOLD || 50);

const API_BASE_URL = $env.API_BASE_URL;
const MAX_TOKENS_MARKETER_BRIEF = Number($env.MAX_TOKENS_MARKETER_BRIEF || 2400);
const MAX_TOKENS_CONTENT_GENERATION = Number($env.MAX_TOKENS_CONTENT_GENERATION || 4096);
const RAG_MAX_CHARS_PER_CHUNK = Number($env.RAG_MAX_CHARS_PER_CHUNK || 1200);
const RAG_MAX_TOTAL_CHARS = Number($env.RAG_MAX_TOTAL_CHARS || 4000);
const RAG_MIN_SIMILARITY = Number($env.RAG_MIN_SIMILARITY || 0.15);
const estimateTokens = (text) => Math.max(1, Math.ceil((text || '').length / 4));
const normalizeForCache = (text) => (text || '').toLowerCase().replace(/s+/g, ' ').trim();
const hashString = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
};

// Build project context block from profile (§6.3 / §12.1 ТЗ)
function buildProfileContext(profile) {
  if (!profile) return '';
  const lines = [
    '## Контекст проекта',
    \`**Компания:** \${profile.companyName}\`,
    \`**Описание:** \${profile.description}\`,
    \`**Ниша:** \${profile.niche}\`,
    \`**География:** \${profile.geography}\`,
    profile.usp ? \`**УТП:** \${profile.usp}\` : null,
    profile.tov ? \`**Тон голоса:** \${profile.tov}\` : null,
    profile.keywords?.length ? \`**Обязательные слова:** \${profile.keywords.join(', ')}\` : null,
    profile.forbidden?.length ? \`**Запрещённые слова:** \${profile.forbidden.join(', ')}\` : null,
    profile.audience?.length
      ? \`**Аудитория:**\\n\${profile.audience.map(a => \`- \${a.segment}: \${a.portrait}\`).join('\\n')}\`
      : null,
  ].filter(Boolean);
  return lines.join('\\n');
}

// Fetch RAG context — read promptPack built by knowledge API (same as B/D)
let ragPromptPack = '';
try {
  const ragResp = await fetch(\`\${API_BASE_URL}/api/projects/\${projectId}/knowledge/search?q=\${encodeURIComponent(input)}&limit=5&maxCharsPerChunk=\${RAG_MAX_CHARS_PER_CHUNK}&maxTotalChars=\${RAG_MAX_TOTAL_CHARS}&minSimilarity=\${RAG_MIN_SIMILARITY}\`, {
    headers: { Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN }
  });
  if (ragResp.ok) {
    const ragData = await ragResp.json();
    ragPromptPack = ragData.promptPack || '';
  }
} catch(e) { /* RAG optional */ }

const profileContext = buildProfileContext(projectProfile);
const ragChars = ragPromptPack.length;
const ragTokens = estimateTokens(ragPromptPack);

// Build system prompt with profile injected
const systemPrompt = agentType === 'CONTENT_MAKER'
  ? \`You are a Senior Content Strategist & Copywriter. Create professional content for the requested task. Use Russian language unless specified. Be specific, platform-native, and ready-to-publish.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}\`
  : \`You are a Senior Marketing Strategist. Analyze and develop effective marketing recommendations. Use Russian language unless specified. Be specific and actionable.\${profileContext ? \`\\n\\n\${profileContext}\` : ''}\${ragPromptPack ? \`\\n\\nPrompt pack из базы знаний:\\n\${ragPromptPack}\` : ''}\`;
const maxTokens = agentType === 'CONTENT_MAKER' ? MAX_TOKENS_CONTENT_GENERATION : MAX_TOKENS_MARKETER_BRIEF;

// Call monitored ai-engine endpoint instead of Anthropic directly.
const response = await fetch(\`\${API_BASE_URL}/api/internal/agent-completion\`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + $env.INTERNAL_API_TOKEN,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: taskScore < HAIKU_SCORE_THRESHOLD ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6',
    maxTokens,
    systemPrompt,
    userMessage: input,
    operation: \`scenario-a.\${agentType.toLowerCase()}\`,
    semanticCacheKey: \`scenario-a.\${agentType.toLowerCase()}:\${hashString(normalizeForCache(input))}:\${hashString(normalizeForCache(JSON.stringify(projectProfile || {})))}:\${hashString(normalizeForCache(ragPromptPack))}\`,
    taskId,
    projectId,
    scenario,
    ragChars,
    ragTokens,
  }),
});

if (!response.ok) {
  throw new Error(\`Monitored agent call failed: \${response.status} \${await response.text()}\`);
}

const result = await response.json();
const output = result.data?.output || 'Agent failed to produce output';

return [{ json: { executionId, taskId, projectId, agentType, output, callbackUrl } }];
`,
    };

    @node({
        id: 'bd7c65fd-92fe-4541-9079-682e1e1be214',
        name: 'Send Callback',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.4,
        position: [660, 0],
    })
    SendCallback = {
        url: '={{ $json.callbackUrl }}',
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
            agentType: '={{ $json.agentType }}',
            output: '={{ $json.output }}',
            iteration: 1,
            status: 'completed',
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookTrigger.out(0).to(this.DetectAgentType.in(0));
        this.DetectAgentType.out(0).to(this.RunAgent.in(0));
        this.RunAgent.out(0).to(this.SendCallback.in(0));
    }
}
