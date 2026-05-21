/**
 * Generates openapi.json from legacy compat routes + Express module mounts.
 * Documentation only — no API or schema changes.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES_ROOT = join(ROOT, 'src/legacy/web/routes');

const EXPRESS_MODULES = [
  {
    name: 'auth',
    description:
      'Foundation auth (P1-10): delegates to IdentityAuthService + RefreshTokenService — same core as compat /api/mobile/auth/*',
  },
  { name: 'users', description: 'User management' },
  { name: 'doctors', description: 'Doctor profiles' },
  { name: 'leads', description: 'Leads' },
  { name: 'animals', description: 'Animals' },
  { name: 'clinics', description: 'Clinics' },
  { name: 'notifications', description: 'Notifications' },
  { name: 'ai', description: 'AI services' },
  { name: 'media', description: 'Media / uploads' },
];

const STANDARD_RESPONSES = {
  ApiSuccess: {
    type: 'object',
    required: ['ok', 'data'],
    properties: {
      ok: { type: 'boolean', enum: [true] },
      data: {},
    },
  },
  ApiError: {
    type: 'object',
    required: ['ok', 'error'],
    properties: {
      ok: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {},
        },
      },
    },
  },
};

function walkRouteFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkRouteFiles(full, files);
    else if (name === 'route.ts') files.push(full);
  }
  return files;
}

function fileToOpenApiPath(routeFile) {
  const rel = relative(ROUTES_ROOT, routeFile).replace(/\\/g, '/').replace(/\/route\.ts$/, '');
  const segments = rel.split('/').map((s) => {
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1);
      if (inner.startsWith('...')) return `{${inner.slice(3)}}`;
      return `{${inner}}`;
    }
    return s;
  });
  return `/api/${segments.join('/')}`;
}

function main() {
  const legacyPaths = walkRouteFiles(ROUTES_ROOT).map(fileToOpenApiPath).sort();
  const paths = {};
  const tags = new Set(['Health', 'Compat-Legacy']);

  for (const p of legacyPaths) {
    const tag = p.split('/')[2] ?? 'api';
    tags.add(tag);
    paths[p] = {
      get: {
        tags: [tag, 'Compat-Legacy'],
        summary: 'Legacy web handler (GET)',
        responses: {
          200: {
            description: 'Success envelope { ok, data }',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          401: {
            description: 'Unauthorized',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
            },
          },
        },
      },
      post: {
        tags: [tag, 'Compat-Legacy'],
        summary: 'Legacy web handler (POST)',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          200: {
            description: 'Success envelope',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
        },
      },
    };
  }

  paths['/health'] = {
    get: { tags: ['Health'], summary: 'Aggregate health (db, redis, storage, queues, memory)' },
  };
  paths['/health/db'] = { get: { tags: ['Health'], summary: 'PostgreSQL health' } };
  paths['/health/redis'] = { get: { tags: ['Health'], summary: 'Redis health' } };
  paths['/health/storage'] = { get: { tags: ['Health'], summary: 'Object storage health' } };
  paths['/health/modules'] = { get: { tags: ['Health'], summary: 'Mounted API modules' } };
  paths['/api/ping'] = {
    get: {
      tags: ['Compat-Legacy'],
      summary: 'Compat layer smoke test',
      responses: {
        200: {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { ok: { type: 'boolean' }, scope: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  };

  const FOUNDATION_AUTH_PATHS = [
    '/api/auth/otp/request',
    '/api/auth/otp/verify',
    '/api/auth/login',
    '/api/auth/token/refresh',
    '/api/auth/refresh',
    '/api/auth/logout',
  ];

  for (const mod of EXPRESS_MODULES) {
    tags.add(`Module-${mod.name}`);
    paths[`/api/${mod.name}`] = {
      get: {
        tags: [`Module-${mod.name}`],
        summary: mod.description,
        description: 'Express module router — see module source for sub-routes.',
      },
    };
    if (mod.name === 'auth') {
      for (const p of FOUNDATION_AUTH_PATHS) {
        paths[p] = {
          post: {
            tags: ['Module-auth', 'Foundation-Auth'],
            summary: p.replace('/api/auth/', ''),
            description:
              'Foundation envelope { success, data }. Delegates to IdentityAuthService (OTP) and RefreshTokenService (refresh) — P1-10.',
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
            responses: {
              200: { description: 'Success { success, data }' },
              400: { description: 'Client error { success, error }' },
              429: { description: 'Rate limit' },
            },
          },
        };
      }
      tags.add('Foundation-Auth');
    }
  }

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Prani Doctor API',
      version: '1.0.0',
      description:
        'Backend-first API. Legacy Next.js routes via compat-web; foundation modules at /api/{module}.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
    tags: [...tags].sort().map((name) => ({ name })),
    paths,
    components: { schemas: STANDARD_RESPONSES },
  };

  const outPath = join(ROOT, 'openapi.json');
  writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf8');
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'openapi.json'), JSON.stringify(spec, null, 2), 'utf8');

  const webDocs = join(ROOT, '..', 'pranidoctor-web', 'docs', 'openapi.json');
  try {
    mkdirSync(dirname(webDocs), { recursive: true });
    writeFileSync(webDocs, JSON.stringify(spec, null, 2), 'utf8');
  } catch {
    /* optional copy to web */
  }

  console.log(`OpenAPI: ${outPath} (${legacyPaths.length} legacy paths)`);
}

main();
