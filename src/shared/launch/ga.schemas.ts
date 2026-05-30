import { z } from 'zod';

export const gaLaunchPhaseSchema = z.enum([
  'PRE_GA',
  'SOFT_LAUNCH',
  'GRADUAL_ROLLOUT',
  'FULL_LAUNCH',
  'PAUSED',
]);

export const goNoGoVerdictSchema = z.enum(['NO_GO', 'GO_WITH_CONDITIONS', 'GO']);

export const gaChecklistItemPatchSchema = z.object({
  id: z.string().trim().min(1).max(32),
  status: z.enum(['open', 'pass', 'fail', 'waived']),
  owner: z.string().trim().max(120).optional(),
  evidence: z.string().trim().max(500).optional(),
});

export const gaLaunchConfigPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    phase: gaLaunchPhaseSchema.optional(),
    goNoGoVerdict: goNoGoVerdictSchema.optional(),
    playRolloutPct: z.number().int().min(0).max(100).optional(),
    weeklyRegistrationCap: z.number().int().min(0).max(1_000_000).nullable().optional(),
    minDoctorsForPhase: z.number().int().min(1).max(500).optional(),
    targetDistrictIds: z.array(z.string().trim().min(1)).optional(),
    closedBetaDisabled: z.boolean().optional(),
    ownership: z
      .object({
        launchLead: z.string().trim().max(120).optional(),
        sreOnCall: z.string().trim().max(120).optional(),
        rollbackAuthority: z.string().trim().max(120).optional(),
        incidentCommander: z.string().trim().max(120).optional(),
        aiSafetyOwner: z.string().trim().max(120).optional(),
        legalLiaison: z.string().trim().max(120).optional(),
        productOps: z.string().trim().max(120).optional(),
      })
      .optional(),
    monitoringLinks: z
      .object({
        grafana: z.string().url().optional(),
        sentry: z.string().url().optional(),
        uptime: z.string().url().optional(),
        statusPage: z.string().url().optional(),
        launchOps: z.string().url().optional(),
        warRoom: z.string().url().optional(),
      })
      .optional(),
    gateChecklist: z.array(gaChecklistItemPatchSchema).optional(),
    lastGateReviewAt: z.string().datetime().nullable().optional(),
    lastGateReviewBy: z.string().trim().max(120).nullable().optional(),
    contentVersion: z.string().trim().max(32).optional(),
  })
  .strict();

export const gaGateReviewBodySchema = z.object({
  reviewer: z.string().trim().min(1).max(120),
  verdict: goNoGoVerdictSchema.optional(),
  checklistUpdates: z.array(gaChecklistItemPatchSchema).optional(),
});
