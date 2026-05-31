import { getPrisma } from '../../../../shared/database/prisma.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import type { UvkgQualityIssue, UvkgQualityReport } from '../uvkg.types.js';

export class GraphQualityService {
  readonly name = 'GraphQualityService';

  async generateReport(): Promise<UvkgQualityReport> {
    const issues: UvkgQualityIssue[] = [];
    issues.push(...(await this.detectOrphans()));
    issues.push(...(await this.detectBrokenLinks()));
    issues.push(...(await this.detectDuplicates()));
    issues.push(...(await this.detectConflicts()));
    issues.push(...(await this.detectCircularDependencies()));

    const issueCounts: Record<string, number> = {};
    for (const issue of issues) {
      issueCounts[issue.kind] = (issueCounts[issue.kind] ?? 0) + 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      issues,
      issueCounts,
    };
  }

  async detectOrphans(): Promise<UvkgQualityIssue[]> {
    const issues: UvkgQualityIssue[] = [];
    const lowDegree = await getKnowledgeLinkRepository().getTopConnectedEndpoints(500);
    for (const endpoint of lowDegree) {
      if (endpoint.degree > 1) continue;
      issues.push({
        kind: 'ORPHAN_NODE',
        severity: 'LOW',
        message: `Low connectivity ${endpoint.refType}:${endpoint.refId} (degree=${endpoint.degree})`,
        repairSuggestion: 'Add cross-domain edges via population derive or editorial graph editor',
      });
    }
    return issues.slice(0, 200);
  }

  async detectBrokenLinks(): Promise<UvkgQualityIssue[]> {
    const prisma = getPrisma();
    const issues: UvkgQualityIssue[] = [];
    const sample = await prisma.vkKnowledgeLink.findMany({
      take: 2000,
      where: { edgeClass: { in: ['CLINICAL', 'NUTRITIONAL'] } },
      select: {
        linkKey: true,
        fromRefType: true,
        fromRefId: true,
        toRefType: true,
        toRefId: true,
        fromEntityId: true,
        toEntityId: true,
      },
    });

    const entitySlugs = new Set(
      (await prisma.vkKnowledgeEntity.findMany({ select: { slug: true, id: true } })).map(
        (e) => `${e.slug}|${e.id}`,
      ),
    );

    for (const link of sample) {
      if (link.fromRefType === 'DISEASE') {
        const reg = await prisma.diDiseaseRegistry.findUnique({
          where: { slug: link.fromRefId },
        });
        if (!reg && !link.fromEntityId) {
          issues.push({
            kind: 'BROKEN_LINK',
            severity: 'MEDIUM',
            linkKey: link.linkKey,
            message: `Disease endpoint missing: ${link.fromRefId}`,
            repairSuggestion: 'Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity',
          });
        }
      }
      if (link.fromEntityId) {
        const exists = [...entitySlugs].some((s) => s.endsWith(`|${link.fromEntityId}`));
        if (!exists) {
          issues.push({
            kind: 'BROKEN_LINK',
            severity: 'HIGH',
            linkKey: link.linkKey,
            message: `fromEntityId ${link.fromEntityId} not found`,
            repairSuggestion: 'Re-resolve endpoint via UvkgEndpointResolverService',
          });
        }
      }
    }

    return issues.slice(0, 100);
  }

  async detectDuplicates(): Promise<UvkgQualityIssue[]> {
    const groups = await getKnowledgeLinkRepository().findDuplicateEdgeGroups(50);
    return groups.map((g) => ({
      kind: 'DUPLICATE_EDGE' as const,
      severity: 'MEDIUM' as const,
      message: `Duplicate ${g.edgeType} edge ${g.fromRefId} → ${g.toRefId} (${g.count} rows)`,
      repairSuggestion: 'Merge via linkKey deduplication; keep highest weight row',
    }));
  }

  async detectConflicts(): Promise<UvkgQualityIssue[]> {
    const prisma = getPrisma();
    const open = await prisma.uvkgSyncConflict.findMany({
      where: { status: 'OPEN' },
      take: 100,
    });
    return open.map((c) => ({
      kind: 'CONFLICT' as const,
      severity: 'MEDIUM' as const,
      linkKey: c.linkKey,
      message: `Open sync conflict: ${c.conflictType}`,
      repairSuggestion: 'Resolve in uvkg_sync_conflicts or run repairSync with source priority',
    }));
  }

  async detectCircularDependencies(): Promise<UvkgQualityIssue[]> {
    const issues: UvkgQualityIssue[] = [];
    const diffEdges = await getKnowledgeLinkRepository().findLinksByEdgeTypes([
      'DIFFERENTIAL_OF',
      'COMORBID_WITH',
    ]);

    const adjacency = new Map<string, Set<string>>();
    for (const e of diffEdges) {
      const a = `${e.fromRefType}:${e.fromRefId}`;
      const b = `${e.toRefType}:${e.toRefId}`;
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      adjacency.get(a)!.add(b);
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(b)!.add(a);
    }

    const visited = new Set<string>();
    for (const start of adjacency.keys()) {
      if (visited.has(start)) continue;
      const stack: Array<{ node: string; path: string[] }> = [{ node: start, path: [start] }];
      while (stack.length > 0) {
        const { node, path } = stack.pop()!;
        visited.add(node);
        for (const next of adjacency.get(node) ?? []) {
          const idx = path.indexOf(next);
          if (idx >= 0) {
            const cycle = path.slice(idx).concat(next);
            issues.push({
              kind: 'CIRCULAR_DEPENDENCY',
              severity: 'LOW',
              message: `Cycle detected: ${cycle.join(' → ')}`,
              repairSuggestion: 'Review DIFFERENTIAL_OF/COMORBID_WITH edges for mutual exclusivity',
            });
            break;
          }
          if (!path.includes(next)) {
            stack.push({ node: next, path: [...path, next] });
          }
        }
      }
    }

    return issues.slice(0, 50);
  }
}

let quality: GraphQualityService | undefined;

export function getGraphQualityService(): GraphQualityService {
  quality ??= new GraphQualityService();
  return quality;
}

export function resetGraphQualityServiceForTests(): void {
  quality = undefined;
}
