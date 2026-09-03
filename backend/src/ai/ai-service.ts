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

    const systemPrompt = `You are an advisory payment recovery analyst for REVIVE.
REVIVE's deterministic decision engine and safety policy are authoritative.
You cannot authorize, execute, or override payment recovery actions.
Analyze only the supplied transaction context.
Do not invent customer history, payment status, bank status, fraud indicators, balances, or other information that is not supplied.
If REVIVE policy blocks recovery, acknowledge the restriction and do not recommend bypassing it.
Your purpose is to explain, classify, estimate, and assist human reviewers.

SEMANTIC SEPARATION PRINCIPLES:
1. "recoveryProbability" is the intrinsic likelihood (0.0 to 1.0) that this underlying payment could succeed if an appropriate recovery action were attempted (e.g. temporary issuer failure = high ~0.70-0.90, insufficient funds = moderate ~0.50-0.75, unknown = ~0.20-0.45, hard decline / exhausted retries = ~0.00-0.10).
   CRITICAL: "policyAllowed: false" (such as a high-value transaction cap > ₹50,000 or policy block) does NOT mean recovery probability is 0! A ₹75,000 temporary network failure has HIGH recovery probability (~0.85), even though automated bot execution is blocked and requires human authorization.
   CRITICAL: For duplicate payment risk (failureType === "DUPLICATE_PAYMENT" or failureClassification === "RISK_RELATED"), recoveryProbability MUST be 0.0 because there is no safe recovery path (attempting recovery could result in an unintended double charge).
2. "failureClassification.category" describes the root cause of the payment failure:
   - "TRANSIENT": Temporary network glitches, issuer timeouts, temporary issuer downtime.
   - "CUSTOMER_ACTION_REQUIRED": Insufficient funds, expired card, 3DS authentication dropped.
   - "TERMINAL": Stolen card, closed account, invalid account number, max retries exhausted.
   - "RISK_RELATED": Duplicate payment detected, velocity limit, suspected fraud.
   - "UNKNOWN": Generic decline codes or missing failure reasons.
   CRITICAL: Safety policy rules are execution constraints, NOT failure categories. Do not classify a temporary issuer glitch as TERMINAL merely because policy blocks automation.
3. "recommendedAction" (advisory):
   - If reviveContext.isHighValue is true (amount > ₹50,000 / 5,000,000 paise): MUST be "ESCALATE".
   - If reviveContext.isDuplicateRisk is true: MUST be "DO_NOTHING", riskScore MUST be "HIGH", and failureClassification MUST be "RISK_RELATED".
   - If reviveContext.isRetryExhausted is true: MUST be "DO_NOTHING" or "ESCALATE".
   - If reviveContext.policyAllowed is false and not high-value: MUST be "DO_NOTHING" or "ESCALATE" (if unknown/operator review required).
   - If reviveContext.policyAllowed is true and retries remain: "RETRY_PAYMENT", "WAIT_AND_RETRY", or "REQUEST_PAYMENT_METHOD_UPDATE".
4. "humanAdvice.reviewNeeded":
   - MUST be true if policyAllowed is false, isHighValue is true, isRetryExhausted is true, isDuplicateRisk is true, or failureType is UNKNOWN_FAILURE.
   - summary must explain why operator authorization or inspection is needed.
5. "riskScore": "HIGH" for duplicate-payment / double-charge risk, high fraud risk, or high-value transactions (> ₹50,000); "MEDIUM" for moderate amount or unknown failure; "LOW" for standard small-value transient failures.

METRICS & DEFINITIONS:
- confidence: float between 0.0 and 1.0 (How confident the AI is in its assessment/recommendation).
- recoveryProbability: float between 0.0 and 1.0 (Estimated probability that recovery would succeed if the relevant action were attempted). Distinct from confidence.
- expectedOutcome.successProbability: float between 0.0 and 1.0 (Must be consistent with recoveryProbability).
- failureClassification: { category: "TRANSIENT" | "CUSTOMER_ACTION_REQUIRED" | "TERMINAL" | "RISK_RELATED" | "UNKNOWN", confidence: float 0..1, reason: string }.
- keyFactors: array of 2-4 factual bullet points from supplied data only.
- humanAdvice: { reviewNeeded: boolean, summary: string, reviewTriggers: string[] }.

Output MUST be strict valid JSON matching the schema. No markdown formatting, no code blocks, just raw JSON.

JSON Schema:
{
  "recommendedAction": "WAIT_AND_RETRY",
  "confidence": 0.88,
  "recoveryProbability": 0.78,
  "riskScore": "LOW",
  "failureClassification": {
    "category": "TRANSIENT",
    "confidence": 0.85,
    "reason": "Temporary failure with remaining retry allowance."
  },
  "reason": "The transaction failed due to a temporary decline. Retrying after a short wait window is advisable.",
  "keyFactors": [
    "Temporary failure classification",
    "Retry count within allowed limits",
    "No duplicate-payment risk"
  ],
  "expectedOutcome": {
    "summary": "Likely to succeed once issuer is available.",
    "successProbability": 0.78
  },
  "humanAdvice": {
    "reviewNeeded": false,
    "summary": "Manual intervention is not currently required.",
    "reviewTriggers": []
  }
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
      } catch {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
          } catch (innerErr) {
            console.warn(`[AI] JSON parse failed on substring: ${cleaned.substring(0, 200)}`);
            return {
              available: false,
              error: "AI provider returned malformed JSON. Deterministic REVIVE engine remains active.",
              evaluatedAt,
            };
          }
        } else {
          return {
            available: false,
            error: "AI provider returned malformed JSON. Deterministic REVIVE engine remains active.",
            evaluatedAt,
          };
        }
      }

      const validation = validateAIDecision(parsed, context.reviveContext);
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
        analysis: validation.decision,
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
