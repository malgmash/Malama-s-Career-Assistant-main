import { createServiceRoleClient } from './client';

export type PendingReviewRequest = {
  id: string;
  resume_id: string;
  opportunity_id: string;
  resumes: { storage_path: string; role_family: string | null };
  opportunities: { title: string; org: string; description: string | null };
};

export async function getPendingReviewRequests(): Promise<PendingReviewRequest[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('review_requests')
    .select(
      'id, resume_id, opportunity_id, resumes!inner(storage_path, role_family), opportunities!inner(title, org, description)',
    )
    .is('processed_at', null);
  if (error) throw error;
  return (data ?? []) as unknown as PendingReviewRequest[];
}

export async function markRequestProcessed(id: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db
    .from('review_requests')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function downloadResumeFile(storagePath: string): Promise<Buffer> {
  const db = createServiceRoleClient();
  const { data, error } = await db.storage.from('resumes').download(storagePath);
  if (error) throw error;
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export type RubricRow = {
  id: string;
  role_family: string;
  version: number;
  criteria: {
    weights: { coverage: number; term_match: number; structure: number; quantification: number };
    structure: {
      maxPages: number;
      bulletsPerRoleMin: number;
      bulletsPerRoleMax: number;
      maxBulletLines: number;
      actionVerbStartPercent: number;
    };
    quantification: { quantifiedBulletPercentTarget: number };
  };
};

export async function getLatestRubric(roleFamily: string): Promise<RubricRow | null> {
  const db = createServiceRoleClient();
  const { data, error } = await db
    .from('rubrics')
    .select('id, role_family, version, criteria')
    .eq('role_family', roleFamily)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as RubricRow | null;
}

export async function saveResumeParsedText(resumeId: string, parsedText: string): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('resumes').update({ parsed_text: parsedText }).eq('id', resumeId);
  if (error) throw error;
}

export type ReviewToSave = {
  resumeId: string;
  opportunityId: string;
  rubricId: string;
  totalScore: number;
  subscores: Record<string, number>;
  findings: unknown;
  promptVersion: string;
};

export async function saveReview(review: ReviewToSave): Promise<void> {
  const db = createServiceRoleClient();
  const { error } = await db.from('reviews').insert({
    resume_id: review.resumeId,
    opportunity_id: review.opportunityId,
    rubric_id: review.rubricId,
    total_score: review.totalScore,
    subscores: review.subscores,
    findings: review.findings,
    prompt_version: review.promptVersion,
  });
  if (error) throw error;
}
