import { WorkflowEntrypoint } from 'cloudflare:workers';

import {
  buildWafRuleFromParameters,
  formatLogRowsForLlm,
  notifyTicket,
  persistBlocksToKv,
  queryHttpLogsFromD1,
  queryLlmNextAction,
  retrieveSopContext,
  summarizeEvidenceForWaf,
} from './investigation';
import type { HttpLogRow, InvestigationWorkflowParams, LlmToolOutput, SocEnv } from './types';

export class InvestigationWorkflow extends WorkflowEntrypoint<SocEnv, InvestigationWorkflowParams> {
  async run(
    event: Readonly<CloudflareWorkersModule.WorkflowEvent<InvestigationWorkflowParams>>,
    step: CloudflareWorkersModule.WorkflowStep,
  ): Promise<Record<string, unknown> | null> {
    const { ticketId, symptom } = event.payload;
    try {

      const sopContext = (await step.do('rag_retrieve_sops', async () => {
        return (await retrieveSopContext(this.env, symptom)) as any;
      })) as string;

      await notifyTicket(this.env, ticketId, {
        step: 'workflow',
        message: 'Retrieved relevant SOP context from Vectorize.',
        meta: { sopPreview: sopContext.slice(0, 200) },
      });

    let includeLogs = false;
    let logText: string | null = null;
    let lastEvidenceJson: string | null = null;
    let lastRows: HttpLogRow[] = [];
    const maxIterations = 8;

    for (let i = 0; i < maxIterations; i++) {
      const llmStep = `llm_iteration_${i + 1}`;

      const llmOutput = (await step.do(llmStep, async () => {
        return (await queryLlmNextAction(this.env, symptom, includeLogs, logText, sopContext)) as any;
      })) as LlmToolOutput;

      await notifyTicket(this.env, ticketId, {
        step: llmStep,
        message: llmOutput.reasoning,
        action: llmOutput.action,
        parameters: llmOutput.parameters,
      });

      if (llmOutput.action === 'check_logs') {
        const d1Result = (await step.do(`d1_query_${i + 1}`, async () => {
          return (await queryHttpLogsFromD1(this.env.DB, llmOutput.parameters)) as any;
        })) as Awaited<ReturnType<typeof queryHttpLogsFromD1>>;

        const formatted = formatLogRowsForLlm(d1Result.rows);
        lastRows = d1Result.rows;
        lastEvidenceJson = JSON.stringify(d1Result.summary);
        logText = formatted;
        includeLogs = true;

        await notifyTicket(this.env, ticketId, {
          step: 'check_logs',
          message: `D1 returned ${d1Result.rows.length} rows (malicious: ${d1Result.summary.maliciousCount ?? 0}).`,
          meta: { summary: d1Result.summary },
        });

        continue;
      }

      if (llmOutput.action === 'ask_user') {
        await notifyTicket(this.env, ticketId, {
          step: 'ask_user',
          message: `LLM requested more info: ${(llmOutput.parameters as { question?: string }).question ?? 'Additional information needed.'}`,
        });
        return null;
      }

      const evidence = (await step.do(`evidence_${i + 1}`, async () => {
        if (lastRows.length > 0) {
          return summarizeEvidenceForWaf(lastRows) as any;
        }
        const d1 = await queryHttpLogsFromD1(this.env.DB, {
          timeframe: (llmOutput.parameters.timeframe as string) ?? 'last_hour',
          suspicious_keyword:
            (llmOutput.parameters.suspicious_keyword as string) ??
            (llmOutput.parameters.payload as string) ??
            'UNION',
          asn: typeof llmOutput.parameters.asn === 'number' ? llmOutput.parameters.asn : undefined,
        });
        return summarizeEvidenceForWaf(d1.rows) as any;
      })) as Awaited<ReturnType<typeof summarizeEvidenceForWaf>>;

      const wafRule = (await step.do('final_waf_rule', async () => {
        return buildWafRuleFromParameters(llmOutput.parameters as Record<string, unknown>, evidence) as any;
      })) as Record<string, unknown>;

      await step.do('kv_enforcement', async () => {
        await persistBlocksToKv(this.env, wafRule);
        return null as any;
      });

      await notifyTicket(this.env, ticketId, {
        step: 'final_waf_rule',
        message: 'Generated WAF rule and wrote enforcement keys to KV.',
        waf_rule: wafRule,
        meta: { logEvidence: lastEvidenceJson },
      });

      return wafRule;
    }

      await notifyTicket(this.env, ticketId, {
        step: 'error',
        message: 'Investigation did not converge within the iteration limit.',
      });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await notifyTicket(this.env, ticketId, {
        step: 'error',
        message: `Workflow failed: ${message}`,
      });
      throw err;
    }
  }
}
