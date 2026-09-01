import dotenv from "dotenv";
import type { AITransactionContext, AIAnalysisResponse, AIDecision } from "./ai-types";
import { validateAIDecision } from "./ai-schema";

export class AIService {
  private getConfig() {
    dotenv.config({ override: true });
    const apiKey = process.env.AI_PROVIDER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const baseUrl = (process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    return {
      apiKey: apiKey?.trim(),
      model: model.trim(),
      baseUrl,
      isConfigured: Boolean(apiKey && apiKey.trim().length > 0),
    };
  }

  public isConfigured(): boolean {
    return this.getConfig().isConfigured;
  }

  public async analyzeTransaction(context: AITransactionContext): Promise<AIAnalysisResponse> {
    const evaluatedAt = new Date().toISOString();
    const config = this.getConfig();

    console.log(`[AI] Analysis started for ${context.transaction.id}`);
    console.log(`[AI] Model: ${config.model}`);
    console.log(`[AI] Provider Base URL: ${config.baseUrl}`);
    console.log(`[AI] Configured: ${config.isConfigured}`);

    if (!config.isConfigured || !config.apiKey) {
      console.log(`[AI] Aborted: AI API key not configured.`);
      return {
        available: false,
        error: "AI API key not configured. Deterministic REVIVE engine remains active.",
        evaluatedAt,
      };
    }

    const systemPrompt = `You are the REVIVE Payment Recovery AI Assistant. Your role is contextual decision support for failed fintech payments.
You analyze failed payment transactions and recommend recovery strategies with strict adherence to fintech safety rules.

CRITICAL RULES:
1. Output MUST be strict valid JSON matching the schema. No markdown formatting, no code blocks, just raw JSON.
2. recommendedAction MUST be one of: "RETRY_PAYMENT", "WAIT_AND_RETRY", "REQUEST_PAYMENT_METHOD_UPDATE", "DO_NOTHING", "ESCALATE".
3. confidence MUST be a float between 0.0 and 1.0 (How confident you are in your recommendation).
4. recoveryProbability MUST be a float between 0.0 and 1.0 (Estimated probability that recovery succeeds if action is executed). Note: confidence and recoveryProbability are distinct values.
5. riskScore MUST be one of: "LOW", "MEDIUM", "HIGH".
6. reason MUST provide a clear, concise justification.
7. keyFactors MUST be an array of 2-4 key factual bullet points.
8. If the transaction amount exceeds ₹50,000 (5,000,000 paise), note the high-value nature and safety policy limits.

JSON Schema:
{
  "recommendedAction": "WAIT_AND_RETRY",
  "confidence": 0.87,
  "recoveryProbability": 0.78,
  "riskScore": "LOW",
  "reason": "...",
  "keyFactors": ["...", "..."]
}`;

    const userPrompt = JSON.stringify({
      transaction: context.transaction,
      reviveContext: context.reviveContext,
    });

    const startTime = Date.now();

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      const durationMs = Date.now() - startTime;
      console.log(`[AI] Request completed: HTTP ${response.status} in ${durationMs}ms`);

      if (!response.ok) {
        const errText = await response.text().catch(() => "Unknown error");
        console.warn(`[AI] Provider returned HTTP ${response.status}: ${errText.substring(0, 300)}`);
        return {
          available: false,
          error: `AI provider returned HTTP ${response.status}: ${errText.substring(0, 150)}`,
          evaluatedAt,
        };
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const rawContent = json?.choices?.[0]?.message?.content;

      if (!rawContent || typeof rawContent !== "string") {
        console.warn(`[AI] Provider returned empty choices or message content`);
        return {
          available: false,
          error: "AI provider returned empty response content. Deterministic REVIVE engine remains active.",
          evaluatedAt,
        };
      }

      // Strip potential markdown code blocks if provider wrapped JSON
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn(`[AI] JSON parse failed on content: ${cleaned.substring(0, 200)}`);
        return {
          available: false,
          error: "AI provider returned malformed JSON. Deterministic REVIVE engine remains active.",
          evaluatedAt,
        };
      }

      const validation = validateAIDecision(parsed);
      if (!validation.valid || !validation.decision) {
        console.warn(`[AI] Response validation failed: ${validation.error}`);
        return {
          available: false,
          error: `AI response validation failed: ${validation.error}`,
          evaluatedAt,
        };
      }

      console.log(`[AI] Response parsed & validated successfully for ${context.transaction.id}`);
      return {
        available: true,
        decision: validation.decision,
        source: "LLM",
        evaluatedAt,
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const msg = err instanceof Error ? err.message : "Network/connection error";
      console.warn(`[AI] Connection error after ${durationMs}ms: ${msg}`);
      return {
        available: false,
        error: `AI Assistant connection error: ${msg}. Deterministic REVIVE engine remains active.`,
        evaluatedAt,
      };
    }
  }
}

export const aiService = new AIService();
