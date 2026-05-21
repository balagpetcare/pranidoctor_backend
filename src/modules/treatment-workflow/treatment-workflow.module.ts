import { BaseModule } from '../../shared/module/base-module.js';
import type { ModuleMetadata } from '../../shared/module/module.types.js';

import { TreatmentWorkflowController } from './treatment-workflow.controller.js';
import { configureTreatmentWorkflowRoutes } from './treatment-workflow.routes.js';
import { getTreatmentWorkflowService } from './treatment-workflow.service.js';

export class TreatmentWorkflowModule extends BaseModule {
  private controller!: TreatmentWorkflowController;

  get metadata(): ModuleMetadata {
    return {
      name: 'cases',
      version: '1.0.0',
      dependencies: ['auth'],
      description: 'Treatment workflow layer over clinical cases — consultation through close',
    };
  }

  protected registerServices(): void {
    this.controller = new TreatmentWorkflowController();
    this.registerService(getTreatmentWorkflowService());
  }

  protected configureRoutes(): void {
    configureTreatmentWorkflowRoutes(this.router, this.controller);
  }
}

export function createTreatmentWorkflowModule(): TreatmentWorkflowModule {
  return new TreatmentWorkflowModule();
}
