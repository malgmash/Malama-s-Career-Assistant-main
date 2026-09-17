import { computeDigest } from '../lib/digest';

try {
  process.loadEnvFile('.env.local');
} catch {
  // .env.local is optional if the environment already has these vars set.
}

computeDigest()
  .then(() => {
    console.log('Digest computed.');
  })
  .catch((err) => {
    console.error('Digest computation failed:', err);
    process.exitCode = 1;
  });
