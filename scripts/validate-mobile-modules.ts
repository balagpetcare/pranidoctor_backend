/**
 * CI check: mobile profile/settings modules must import cleanly.
 */
import {
  formatMobileProfileModuleFailure,
  validateMobileProfileModules,
} from '../src/shared/config/mobile-profile-startup.js';

async function main(): Promise<void> {
  const result = await validateMobileProfileModules();
  if (!result.ok) {
    console.error(formatMobileProfileModuleFailure(result));
    process.exit(1);
  }
  console.log('Mobile profile modules OK:', result.details);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
