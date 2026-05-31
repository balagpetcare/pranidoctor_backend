import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  assertAiAdminCan,
  requireAiAdminActor,
} from '../../../../../../modules/ai/admin/index.js';
import { getAiAuditService } from '../../../../../../modules/ai/audit/ai-audit.service.js';
import { getAiPlatformAuditService } from '../../../../../../modules/ai/audit/ai-platform-audit.service.js';
import { getAiSecurityAuditService } from '../../../../../../modules/ai/security/ai-security-audit.service.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.analytics.view');
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const sinceDays = Math.min(90, Math.max(1, Number(url.searchParams.get('sinceDays') ?? 7)));
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);

    const [unified, platformAudit, securityAudit] = await Promise.all([
      getAiPlatformAuditService().search({ since, limit: 100 }),
      getAiAuditService().search({ since, limit: 100 }),
      getAiSecurityAuditService().listRecent(since, 100),
    ]);

    return jsonOk({
      sinceDays,
      unified,
      platform: platformAudit,
      security: securityAudit,
    });
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load audit log'), 500);
  }
}
