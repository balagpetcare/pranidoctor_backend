import { createAdminAnalyticsRouteHandler } from '../../../../../../modules/admin-analytics/index.js';

export const GET = createAdminAnalyticsRouteHandler((c, q) => c.livestock(q));
