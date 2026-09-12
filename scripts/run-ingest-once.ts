import { runIngestPass } from '../lib/ingest';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

runIngestPass()
  .then(() => {
    console.log('Ingest pass complete.');
  })
  .catch((err) => {
    console.error('Ingest pass failed:', err);
    process.exitCode = 1;
  });
