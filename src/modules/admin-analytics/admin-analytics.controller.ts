import type { AdminAnalyticsDateRangeQuery } from './admin-analytics.schemas.js';
import { getAdminAnalyticsService } from './admin-analytics.service.js';

export class AdminAnalyticsController {
  constructor(private readonly service = getAdminAnalyticsService()) {}

  overview(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getOverview(query);
  }

  revenue(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getRevenue(query);
  }

  doctors(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getDoctors(query);
  }

  farmers(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getFarmers(query);
  }

  livestock(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getLivestock(query);
  }

  geography(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getGeography(query);
  }

  system(query: AdminAnalyticsDateRangeQuery) {
    return this.service.getSystem(query);
  }

  reports(query: AdminAnalyticsDateRangeQuery) {
    if (query.format === 'csv' && query.report) {
      return this.service.exportReport(query);
    }
    if (query.format === 'csv') {
      return this.service.exportReport({ ...query, report: 'overview' });
    }
    return this.service.getReportsCatalog();
  }
}

let controllerSingleton: AdminAnalyticsController | undefined;

export function getAdminAnalyticsController(): AdminAnalyticsController {
  if (!controllerSingleton) {
    controllerSingleton = new AdminAnalyticsController();
  }
  return controllerSingleton;
}
