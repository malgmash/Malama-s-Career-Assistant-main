import type { Adapter } from './types';
import { githubJsonAdapter } from './github_json';
import { malgDropboxAdapter } from './malg_dropbox';

// Register a new source here after adding its adapter file. Nothing else
// in the ingest or normalize path needs to change. See docs/SOURCES.md
// "Adding a source".
export const adapters: Record<string, Adapter> = {
  [githubJsonAdapter.kind]: githubJsonAdapter,
  [malgDropboxAdapter.kind]: malgDropboxAdapter,
};

export function getAdapter(kind: string): Adapter {
  const adapter = adapters[kind];
  if (!adapter) throw new Error(`No adapter registered for source kind "${kind}"`);
  return adapter;
}

export * from './types';
