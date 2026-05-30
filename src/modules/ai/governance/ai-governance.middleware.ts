import type { Request, Response, NextFunction } from 'express';

import { logWarn } from '../../../shared/logger/logger.js';

import { mapRouteToGovernanceFeature } from './ai-governance.enforcement.js';
import { getAiGovernanceService } from './ai-governance.service.js';

/**
 * Ensures governance mirror is consulted on LLM-capable routes.
 * Does not block requests — orchestrator enforces rules-only degradation.
 */
export function aiGovernanceRouteObserver(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const gov = getAiGovernanceService();
  if (!gov.isHydrated()) {
    logWarn('AI governance not hydrated — fail-closed for LLM on this request', {
      path: req.path,
      method: req.method,
    });
  }

  const feature = mapRouteToGovernanceFeature(req.path);
  if (feature && gov.shouldUseRulesOnlyForFeature(feature)) {
    req.aiGovernanceRulesOnly = true;
  }

  next();
}

declare module 'express-serve-static-core' {
  interface Request {
    aiGovernanceRulesOnly?: boolean;
  }
}
