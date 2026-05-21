import type { Router } from 'express';

export interface ModuleMetadata {
  name: string;
  version: string;
  dependencies: string[];
  description?: string;
}

export interface ModuleService {
  readonly name: string;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface ModuleDefinition {
  metadata: ModuleMetadata;
  router: Router;
  services: Map<string, ModuleService>;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ModuleFactory {
  create(): ModuleDefinition;
}

export const ModuleNames = {
  AUTH: 'auth',
  USERS: 'users',
  DOCTORS: 'doctors',
  LEADS: 'leads',
  ANIMALS: 'animals',
  CLINICS: 'clinics',
  AI: 'ai',
  NOTIFICATIONS: 'notifications',
  MEDIA: 'media',
} as const;

export type ModuleName = (typeof ModuleNames)[keyof typeof ModuleNames];

export interface DependencyNode {
  name: string;
  dependencies: string[];
  dependents: string[];
}

export type DependencyGraph = Map<string, DependencyNode>;
