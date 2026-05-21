import { loadEnvironment } from '../src/shared/config/load-env.js';
import { formatEnvValidation, validateInfrastructureEnv } from '../src/shared/config/env.validation.js';

loadEnvironment();

const result = validateInfrastructureEnv();
console.log(formatEnvValidation(result));
process.exit(result.ok ? 0 : 1);
