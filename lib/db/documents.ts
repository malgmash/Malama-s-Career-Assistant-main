import { createServiceRoleClient } from './client';

export type PendingDraftRequest = {
  id: string;
  application_id: string;
  kind: 'bullets' | 'short_answer';
  question: string | null;
  applications: { opportunity_id: string; opportunities: { title: string; org: string; description: string | null } };
};

export async function getPendingDraftRequests(): Promise<PendingDraftRequest[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('draft_requests')
    .select(
      'id, application_id, kind, question, applications!inner(opportunity_id, opportunities(title, org, description))',
    )
    .is('processed_at', null);
  if (error) throw error;
  return (data ?? []) as unknown as PendingDraftRequest[];
}

export async function markDraftProcessed(id: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('draft_requests').update({ processed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export type ProfileFactWithId = {
  id: string;
  category: string;
  claim: string;
  strength: string;
};

export async function getProfileFactsWithIds(): Promise<ProfileFactWithId[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from('profile_facts').select('id, category, claim, strength');
  if (error) throw error;
  return data ?? [];
}

export type DocumentToSave = {
  applicationId: string;
  kind: 'bullets' | 'short_answer';
  content: string;
  factIds: string[];
  gaps: string[];
  keywordsUsed: string[];
  promptVersion: string;
};

export async function saveDocument(doc: DocumentToSave): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('documents').insert({
    application_id: doc.applicationId,
    kind: doc.kind,
    content: doc.content,
    fact_ids: doc.factIds,
    gaps: doc.gaps,
    keywords_used: doc.keywordsUsed,
    prompt_version: doc.promptVersion,
  });
  if (error) throw error;
}
