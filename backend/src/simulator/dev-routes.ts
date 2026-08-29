import type { Express } from "express";

import { baselineStrategy } from "./baseline";
import { DEFAULT_SEED } from "./constants";
import {
  evaluateStrategy,
  incrementalRecoveryPaise,
} from "./evaluate";
import { generateDataset } from "./generate-dataset";
import { toPublicTransaction } from "./public-transaction";
import { reviveStrategy } from "../recovery/revive-strategy";

export function registerSimulatorDevRoutes(app: Express): void {
  app.get("/simulator/transactions", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    res.status(200).json({
      seed,
      transactions: transactions.map(toPublicTransaction),
    });
  });

  app.get("/simulator/baseline-evaluation", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    const { metrics } = evaluateStrategy(
      transactions,
      baselineStrategy,
    );

    const sample = transactions[0];

    res.status(200).json({
      seed,
      metrics,
      samplePublicTransaction: sample
        ? toPublicTransaction(sample)
        : null,
    });
  });

  app.get("/simulator/revive-evaluation", (req, res) => {
    const rawSeed = req.query.seed;
    const seed =
      typeof rawSeed === "string" && rawSeed.length > 0
        ? Number(rawSeed)
        : DEFAULT_SEED;

    if (!Number.isInteger(seed)) {
      res.status(400).json({
        error: "seed must be an integer",
      });
      return;
    }

    const transactions = generateDataset(seed);

    const baseline = evaluateStrategy(
      transactions,
      baselineStrategy,
    );

    const revive = evaluateStrategy(
      transactions,
      reviveStrategy,
    );

    const incrementalRevenueRecoveredPaise =
      incrementalRecoveryPaise(
        revive.metrics,
        baseline.metrics,
      );

    const sample = transactions[0];

    res.status(200).json({
      seed,
      baseline: baseline.metrics,
      revive: revive.metrics,
      comparison: {
        incrementalRecoveryPaise:
          incrementalRevenueRecoveredPaise,

        incrementalRecoveryRate:
          revive.metrics.recoveryRate -
          baseline.metrics.recoveryRate,

        additionalSuccessfulInterventions:
          revive.metrics.successfulInterventions -
          baseline.metrics.successfulInterventions,
      },

      samplePublicTransaction: sample
        ? toPublicTransaction(sample)
        : null,
    });
  });
}