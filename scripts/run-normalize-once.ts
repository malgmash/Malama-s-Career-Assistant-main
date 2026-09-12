import { runNormalizePass } from '../lib/normalize';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

runNormalizePass()
  .then(() => {
    console.log('Normalize pass complete.');
  })
  .catch((err) => {
    console.error('Normalize pass failed:', err);
    process.exitCode = 1;
  });
