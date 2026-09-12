import { createServiceRoleClient } from './client';

export type SourceRow = {
  id: string;
  kind: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

export async function getEnabledSources(): Promise<SourceRow[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('sources')
    .select('id, kind, name, config, enabled')
    .eq('enabled', true);
  if (error) throw error;
  return data ?? [];
}

export async function recordSourceError(sourceId: string, message: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('sources')
    .update({ last_error: message })
    .eq('id', sourceId);
  if (error) throw error;
}

export async function recordSourceRun(sourceId: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('sources')
    .update({ last_run_at: new Date().toISOString(), last_error: null })
    .eq('id', sourceId);
  if (error) throw error;
}
