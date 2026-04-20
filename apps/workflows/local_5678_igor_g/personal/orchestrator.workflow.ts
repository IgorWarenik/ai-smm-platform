import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Orchestrator
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                   webhook
// CheckScore                       if
// RouteScenario                    switch
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//   → CheckScore
//     .out(0) → RouteScenario  (score >= 25)
//     .out(1) → (rejected — no connection)
// RouteScenario
//   .out(0) → scenario-a (via sub-workflow or HTTP)
//   .out(1) → scenario-b
//   .out(2) → scenario-c
//   .out(3) → scenario-d
// </workflow-map>

@workflow({
  id: '',
  name: 'Orchestrator',
  active: false,
  settings: { executionOrder: 'v1' }
})
export class OrchestratorWorkflow {

  @node({
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    version: 2.1,
    position: [0, 0]
  })
  WebhookTrigger = {
    responseBinaryPropertyName: 'data',
    httpMethod: 'POST',
    path: 'orchestrator',
    responseMode: 'onReceived',
    responseCode: 202,
  };

  @node({
    name: 'Check Score',
    type: 'n8n-nodes-base.if',
    version: 2.3,
    position: [220, 0]
  })
  CheckScore = {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [
        {
          leftValue: '={{ $json.body.score }}',
          rightValue: 25,
          operator: { type: 'number', operation: 'gte' }
        }
      ],
      combinator: 'and'
    },
    looseTypeValidation: false,
  };

  @node({
    name: 'Route Scenario',
    type: 'n8n-nodes-base.switch',
    version: 3.4,
    position: [440, 0]
  })
  RouteScenario = {
    mode: 'expression',
    output: `={{ (() => {
      const s = $json.body.scenario;
      if (s === 'A') return 0;
      if (s === 'B') return 1;
      if (s === 'C') return 2;
      if (s === 'D') return 3;
      return 0;
    })() }}`,
    numberOutputs: 4,
  };

  @links()
  defineRouting() {
    this.WebhookTrigger.out(0).to(this.CheckScore.in(0));
    this.CheckScore.out(0).to(this.RouteScenario.in(0));
    // out(1) = score < 25 — rejected, no connection needed (API already rejected it)
    // RouteScenario outputs connect to scenario sub-workflows (handled by separate workflows)
  }
}
