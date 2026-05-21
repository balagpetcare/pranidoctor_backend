import {
  AiServiceRequestStatus,
  ReviewStatus,
} from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import {
  getTechnicianModuleReviewBundle,
  mergeLegacyAndModuleRating,
} from "@/lib/mobile-ai-services/ai-quality-service";
import { requireMobileAiTechnicianActor } from "@/lib/mobile-ai-technician/mobile-module-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireMobileAiTechnicianActor(request);
  if (!auth.ok) return auth.response;

  const tid = auth.ctx.technicianProfileId;

  try {
    const [completed, legacyAgg, bundle] = await Promise.all([
      prisma.aiServiceRequest.count({
        where: {
          technicianProfileId: tid,
          status: AiServiceRequestStatus.COMPLETED,
        },
      }),
      prisma.review.aggregate({
        where: { aiTechnicianId: tid, status: ReviewStatus.APPROVED },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      getTechnicianModuleReviewBundle(tid),
    ]);

    const merged = mergeLegacyAndModuleRating(
      legacyAgg._count._all > 0
        ? {
            avg: legacyAgg._avg.rating ?? 0,
            count: legacyAgg._count._all,
          }
        : undefined,
      bundle.ratingCount > 0 && bundle.ratingAverage != null
        ? { avg: bundle.ratingAverage, count: bundle.ratingCount }
        : undefined,
    );

    return jsonOk({
      ratingAverage: merged.count > 0 ? merged.avg : null,
      ratingCount: merged.count,
      completedServicesCount: completed,
      recentReviews: bundle.recentReviews,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "লোড করা যায়নি", 500);
  }
}
