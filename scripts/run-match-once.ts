import { runMatchPass } from '../lib/scoring';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

runMatchPass()
  .then(() => {
    console.log('Match pass complete.');
  })
  .catch((err) => {
    console.error('Match pass failed:', err);
    process.exitCode = 1;
  });
