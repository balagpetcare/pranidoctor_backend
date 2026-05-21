import type { ModuleMetadata, DependencyGraph, DependencyNode } from './module.types.js';

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class MissingDependencyError extends Error {
  constructor(
    public readonly module: string,
    public readonly missing: string
  ) {
    super(`Module '${module}' depends on '${missing}' which is not registered`);
    this.name = 'MissingDependencyError';
  }
}

export class DependencyGuard {
  private graph: DependencyGraph = new Map();

  registerModule(metadata: ModuleMetadata): void {
    const node: DependencyNode = {
      name: metadata.name,
      dependencies: [...metadata.dependencies],
      dependents: [],
    };

    this.graph.set(metadata.name, node);

    for (const dep of metadata.dependencies) {
      const depNode = this.graph.get(dep);
      if (depNode) {
        depNode.dependents.push(metadata.name);
      }
    }
  }

  validate(): void {
    this.validateNoCycles();
    this.validateAllDependenciesExist();
  }

  private validateNoCycles(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const moduleNode = this.graph.get(node);
      if (moduleNode) {
        for (const dep of moduleNode.dependencies) {
          if (!visited.has(dep)) {
            dfs(dep);
          } else if (recursionStack.has(dep)) {
            const cycleStart = path.indexOf(dep);
            const cycle = [...path.slice(cycleStart), dep];
            throw new CircularDependencyError(cycle);
          }
        }
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const node of this.graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
  }

  private validateAllDependenciesExist(): void {
    for (const [name, node] of this.graph) {
      for (const dep of node.dependencies) {
        if (!this.graph.has(dep)) {
          throw new MissingDependencyError(name, dep);
        }
      }
    }
  }

  getInitializationOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (node: string): void => {
      if (visited.has(node)) return;

      const moduleNode = this.graph.get(node);
      if (moduleNode) {
        for (const dep of moduleNode.dependencies) {
          visit(dep);
        }
      }

      visited.add(node);
      order.push(node);
    };

    for (const node of this.graph.keys()) {
      visit(node);
    }

    return order;
  }

  getShutdownOrder(): string[] {
    return this.getInitializationOrder().reverse();
  }

  getDependencies(moduleName: string): string[] {
    return this.graph.get(moduleName)?.dependencies ?? [];
  }

  getDependents(moduleName: string): string[] {
    return this.graph.get(moduleName)?.dependents ?? [];
  }

  getGraph(): DependencyGraph {
    return new Map(this.graph);
  }

  clear(): void {
    this.graph.clear();
  }
}

export const dependencyGuard = new DependencyGuard();
