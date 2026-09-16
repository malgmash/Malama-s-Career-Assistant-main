import { runReviewPass } from '../lib/review';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

runReviewPass()
  .then(() => {
    console.log('Review pass complete.');
  })
  .catch((err) => {
    console.error('Review pass failed:', err);
    process.exitCode = 1;
  });
