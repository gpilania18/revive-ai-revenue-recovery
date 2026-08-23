import type { Express } from "express";
import { baselineStrategy } from "./baseline";
import { DEFAULT_SEED } from "./constants";
import { evaluateStrategy } from "./evaluate";
import { generateDataset } from "./generate-dataset";
import { toPublicTransaction } from "./public-transaction";

export function registerSimulatorDevRoutes(app: Express): void {
  app.get("/simulator/baseline-evaluation", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0 ? Number(rawSeed) : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({ error: "seed must be an integer" });
      return;
    }

    const transactions = generateDataset(seed);
    const { metrics } = evaluateStrategy(transactions, baselineStrategy);
    const sample = transactions[0];

    res.status(200).json({
      seed,
      metrics,
      samplePublicTransaction: sample ? toPublicTransaction(sample) : null,
    });
  });
}
