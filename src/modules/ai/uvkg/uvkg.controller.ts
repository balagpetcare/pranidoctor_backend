import type { Request, Response } from 'express';

import { getGraphCoverageService } from './services/graph-coverage.service.js';
import { getGraphPopulationService } from './services/graph-population.service.js';
import { getGraphQualityService } from './services/graph-quality.service.js';
import { getGraphSyncService } from './services/graph-sync.service.js';
import { getGovernanceValidationService } from './services/governance-validation.service.js';
import { getPhase4ValidationService } from './services/phase4-validation.service.js';
import { getPhase5ValidationService } from './services/phase5-validation.service.js';
import { getUvkgAnalyticsService } from './services/uvkg-analytics.service.js';
import { getUvkgBenchmarkService } from './services/uvkg-benchmark.service.js';
import { getUvkgDriftService } from './services/uvkg-drift.service.js';
import { getUvkgTraversalService } from './services/uvkg-traversal.service.js';

export class UvkgController {
  async driftReport(_req: Request, res: Response): Promise<void> {
    const report = await getUvkgDriftService().generateReport();
    res.json({ ok: true, report });
  }

  async syncAll(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().syncAll();
    res.json({ ok: true, result });
  }

  async syncFeed(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().syncFromFeedGraph();
    res.json({ ok: true, result });
  }

  async syncMedicine(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().syncFromMedicineGraph();
    res.json({ ok: true, result });
  }

  async syncDisease(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().syncFromDiseaseGraph();
    res.json({ ok: true, result });
  }

  async repairSync(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().repairSync();
    res.json({ ok: true, result });
  }

  async rebuildStaging(_req: Request, res: Response): Promise<void> {
    const result = await getGraphSyncService().rebuildStaging();
    res.json({ ok: true, result });
  }

  async populate(_req: Request, res: Response): Promise<void> {
    const report = await getGraphPopulationService().runFullPopulation();
    res.json({ ok: true, report });
  }

  async coverage(_req: Request, res: Response): Promise<void> {
    const report = await getGraphCoverageService().generateReport();
    res.json({ ok: true, report });
  }

  async quality(_req: Request, res: Response): Promise<void> {
    const report = await getGraphQualityService().generateReport();
    res.json({ ok: true, report });
  }

  async governance(_req: Request, res: Response): Promise<void> {
    const report = await getGovernanceValidationService().generateReport();
    res.json({ ok: true, report });
  }

  async analytics(_req: Request, res: Response): Promise<void> {
    const dashboard = await getUvkgAnalyticsService().getDashboard();
    res.json({ ok: true, dashboard });
  }

  async benchmarks(_req: Request, res: Response): Promise<void> {
    const report = await getUvkgBenchmarkService().runBenchmarks();
    res.json({ ok: true, report });
  }

  async phase4Validate(req: Request, res: Response): Promise<void> {
    const skipPopulation = req.query.skipPopulation === 'true';
    const report = await getPhase4ValidationService().runFullValidation({ skipPopulation });
    res.json({ ok: true, report });
  }

  async phase5Validate(_req: Request, res: Response): Promise<void> {
    const report = await getPhase5ValidationService().runFullValidation();
    res.json({ ok: true, report });
  }

  async neighbors(req: Request, res: Response): Promise<void> {
    const refType = String(req.query.refType ?? '');
    const refId = String(req.query.refId ?? '');
    if (!refType || !refId) {
      res.status(400).json({ ok: false, error: 'refType and refId required' });
      return;
    }
    const edgeTypes =
      typeof req.query.edgeTypes === 'string'
        ? req.query.edgeTypes.split(',').filter(Boolean)
        : undefined;
    const result = await getUvkgTraversalService().neighbors({ refType, refId, edgeTypes });
    res.json({ ok: true, ...result });
  }
}

let controller: UvkgController | undefined;

export function getUvkgController(): UvkgController {
  controller ??= new UvkgController();
  return controller;
}
