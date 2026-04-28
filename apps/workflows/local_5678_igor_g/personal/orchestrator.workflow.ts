import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Orchestrator
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook
// CheckScore                         if
// RouteScenario                      switch
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → CheckScore
//      → RouteScenario
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'jcwYSNWGhVmM2Mbu',
    name: 'Orchestrator',
    active: false,
    isArchived: false,
    settings: { executionOrder: 'v1' },
})
export class OrchestratorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '5f9d2715-dba3-4555-8568-e022dd9c1bf7',
        webhookId: 'c6a97178-2508-4887-a022-cc4102ad0906',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 0],
    })
    WebhookTrigger = {
        responseBinaryPropertyName: 'data',
        httpMethod: 'POST',
        path: 'orchestrator',
        responseMode: 'onReceived',
        responseCode: 202,
    };

    @node({
        id: '1a379b91-8672-4a5a-8cf7-30e029d531c4',
        name: 'Check Score',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [220, 0],
    })
    CheckScore = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
            },
            conditions: [
                {
                    leftValue: '={{ $json.body.score }}',
                    rightValue: 25,
                    operator: {
                        type: 'number',
                        operation: 'gte',
                    },
                },
            ],
            combinator: 'and',
        },
        looseTypeValidation: false,
    };

    @node({
        id: 'ff82192d-c87b-4094-a840-4eb8b37e71f8',
        name: 'Route Scenario',
        type: 'n8n-nodes-base.switch',
        version: 3.4,
        position: [440, 0],
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

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookTrigger.out(0).to(this.CheckScore.in(0));
        this.CheckScore.out(0).to(this.RouteScenario.in(0));
    }
}
