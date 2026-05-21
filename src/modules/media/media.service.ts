import type { AppConfig } from '../../shared/config/config.schema.js';
import { ServiceUnavailableError } from '../../shared/errors/index.js';
import type { ModuleService } from '../../shared/module/module.types.js';

const MSG = 'Media service pending port from legacy web storage';

export class MediaService implements ModuleService {
  readonly name = 'MediaService';
  constructor(_repository: unknown, _storage: unknown, _config: AppConfig) {}
  async upload(): Promise<never> {
    throw new ServiceUnavailableError('MEDIA_MIGRATION_PENDING', MSG);
  }
}
