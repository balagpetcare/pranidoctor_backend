import { Router, type Request, type Response } from 'express';

import { getCompatRouteCount } from '../../modules/compat-web/index.js';
import { isProduction } from '../../shared/config/config.loader.js';

function metricsAuthorized(req: Request): boolean {
  const token = process.env['METRICS_TOKEN']?.trim();
  if (!token) {
    return !isProduction();
  }
  const header = req.headers.authorization;
  if (header === `Bearer ${token}`) return true;
  return req.query['token'] === token;
}

export function createMetricsRouter(): Router {
  const router = Router();

  router.get('/metrics', (req: Request, res: Response) => {
    if (!metricsAuthorized(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const mem = process.memoryUsage();
    const lines = [
      '# HELP pranidoctor_process_uptime_seconds Process uptime',
      '# TYPE pranidoctor_process_uptime_seconds gauge',
      `pranidoctor_process_uptime_seconds ${process.uptime()}`,
      '# HELP pranidoctor_heap_used_bytes Heap used',
      '# TYPE pranidoctor_heap_used_bytes gauge',
      `pranidoctor_heap_used_bytes ${mem.heapUsed}`,
      '# HELP pranidoctor_compat_routes Legacy compat route count',
      '# TYPE pranidoctor_compat_routes gauge',
      `pranidoctor_compat_routes ${getCompatRouteCount()}`,
    ];

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(`${lines.join('\n')}\n`);
  });

  router.get('/metrics/json', (req: Request, res: Response) => {
    if (!metricsAuthorized(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const mem = process.memoryUsage();
    res.json({
      uptimeSeconds: process.uptime(),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss: mem.rss,
      },
      compatRoutes: getCompatRouteCount(),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
