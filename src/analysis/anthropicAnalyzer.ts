import Anthropic from '@anthropic-ai/sdk';
import type {
  AnalyzerResult,
  CandidateAnalysis,
  FitAnalyzer,
  JobAnalysisInput,
} from './types.js';
import {
  FIT_TOOL_JSON_SCHEMA,
  PROMPT_VERSION,
  SCORING_VERSION,
  modelFitOutputSchema,
} from './schema.js';
import { FIT_SYSTEM_PROMPT, buildUserContent } from './prompt.js';

/** True when a runtime LLM credential is configured. */
export function hasLlmCredential(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY']?.trim());
}

/** Default model; override with ANTHROPIC_MODEL. */
export function analyzerModel(): string {
  return process.env['ANTHROPIC_MODEL']?.trim() || 'claude-opus-5';
}

/**
 * Real fit analyzer backed by the Anthropic Messages API. Credentials come only from
 * the environment (ANTHROPIC_API_KEY); nothing is hardcoded. Structured output is
 * obtained via a single strict tool and then validated with zod — malformed output
 * throws (fails safe) rather than being persisted.
 */
export class AnthropicFitAnalyzer implements FitAnalyzer {
  readonly provider = 'anthropic';
  readonly model: string;
  readonly promptVersion = PROMPT_VERSION;
  readonly scoringVersion = SCORING_VERSION;
  private readonly client: Anthropic;

  constructor(opts: { model?: string } = {}) {
    this.model = opts.model ?? analyzerModel();
    this.client = new Anthropic(); // resolves ANTHROPIC_API_KEY from env
  }

  async analyze(
    candidate: CandidateAnalysis,
    job: JobAnalysisInput,
  ): Promise<AnalyzerResult> {
    const tool = {
      name: 'record_fit_analysis',
      description: 'Record the structured fit analysis for this job.',
      input_schema: FIT_TOOL_JSON_SCHEMA,
      strict: true,
    } as unknown as Anthropic.Tool;

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: FIT_SYSTEM_PROMPT,
      tools: [tool],
      tool_choice: { type: 'auto' },
      messages: [{ role: 'user', content: buildUserContent(candidate, job) }],
    });

    const toolUse = res.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'record_fit_analysis',
    );
    if (!toolUse) {
      throw new Error(
        `Analyzer returned no fit-analysis tool call (stop_reason=${res.stop_reason}).`,
      );
    }

    // zod validation — throws on malformed output (caller treats as a failed analysis).
    const output = modelFitOutputSchema.parse(toolUse.input);

    return {
      output,
      usage: {
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
      },
    };
  }
}
