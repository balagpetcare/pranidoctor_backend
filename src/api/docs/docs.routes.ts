import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Router, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const SPEC_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../openapi.json');

function loadOpenApiSpec(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as Record<string, unknown>;
  } catch {
    return {
      openapi: '3.0.3',
      info: { title: 'Prani Doctor API', version: '1.0.0' },
      paths: {},
    };
  }
}

export function createDocsRouter(): Router {
  const router = Router();
  const spec = loadOpenApiSpec();

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(spec);
  });

  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(spec, { customSiteTitle: 'Prani Doctor API' }));

  return router;
}
