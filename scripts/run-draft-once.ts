import { runDraftPass } from '../lib/draft';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

runDraftPass()
  .then(() => {
    console.log('Draft pass complete.');
  })
  .catch((err) => {
    console.error('Draft pass failed:', err);
    process.exitCode = 1;
  });
