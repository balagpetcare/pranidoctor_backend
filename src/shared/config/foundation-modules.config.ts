/**
 * Controls which foundation HTTP modules are mounted.
 * Stub modules (animals, clinics, notifications) are off by default to avoid
 * 500s and route shadowing of legacy `/api/notifications/*`.
 */
export const STUB_FOUNDATION_MODULE_NAMES = ['animals', 'clinics', 'notifications'] as const;

export type StubFoundationModuleName = (typeof STUB_FOUNDATION_MODULE_NAMES)[number];

export function shouldMountStubFoundationModules(): boolean {
  return process.env['FOUNDATION_MOUNT_STUB_MODULES'] === 'true';
}

export function isStubFoundationModule(name: string): name is StubFoundationModuleName {
  return (STUB_FOUNDATION_MODULE_NAMES as readonly string[]).includes(name);
}

export function filterFoundationModules<T extends { metadata: { name: string } }>(
  modules: T[],
): T[] {
  if (shouldMountStubFoundationModules()) {
    return modules;
  }
  return modules.filter((m) => !isStubFoundationModule(m.metadata.name));
}
