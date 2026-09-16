import Anthropic from '@anthropic-ai/sdk';
import {
  downloadResumeFile,
  getLatestRubric,
  getPendingReviewRequests,
  markRequestProcessed,
  saveResumeParsedText,
  saveReview,
  type RubricRow,
} from '../db/reviews';
import { getProfileFacts } from '../db/matches';
import { parseResumePdf } from './pdf';
import { extractRequirements, EXTRACT_REQUIREMENTS_PROMPT_VERSION, type Requirement } from './requirements';
import { checkCoverage, COVERAGE_PROMPT_VERSION, type CoverageResult } from './coverage';
import { checkTermMatch } from './terms';
import { checkStructure, scoreStructure } from './structure';
import { checkQuantification, scoreQuantification } from './quantification';

const DEFAULT_ROLE_FAMILY = 'swe_intern'; // only rubric that exists so far

function scoreCoverage(requirements: Requirement[], coverage: CoverageResult[]): number {
  let requiredTotal = 0;
  let requiredMet = 0;
  let preferredTotal = 0;
  let preferredMet = 0;

  requirements.forEach((req, id) => {
    const result = coverage.find((c) => c.requirementId === id);
    const met = result?.met ?? false;
    if (req.kind === 'required') {
      requiredTotal++;
      if (met) requiredMet++;
    } else {
      preferredTotal++;
      if (met) preferredMet++;
    }
  });

  const denominator = 2 * requiredTotal + preferredTotal;
  if (denominator === 0) return 100;
  return Math.round(((2 * requiredMet + preferredMet) / denominator) * 100);
}

async function processOne(
  request: Awaited<ReturnType<typeof getPendingReviewRequests>>[number],
  client: Anthropic,
): Promise<void> {
  const roleFamily = request.resumes.role_family ?? DEFAULT_ROLE_FAMILY;
  const rubric: RubricRow | null = await getLatestRubric(roleFamily);
  if (!rubric) {
    throw new Error(`No rubric found for role_family "${roleFamily}"`);
  }

  const fileBuffer = await downloadResumeFile(request.resumes.storage_path);
  const { text: resumeText, pageCount } = await parseResumePdf(fileBuffer);
  await saveResumeParsedText(request.resume_id, resumeText);

  const postingText = `${request.opportunities.title}\n${request.opportunities.org}\n${request.opportunities.description ?? ''}`;
  const requirements = await extractRequirements(postingText, client);
  const coverage = await checkCoverage(requirements, resumeText, client);
  const facts = await getProfileFacts();
  const termMatch = checkTermMatch(requirements, resumeText, facts);
  const structureFindings = checkStructure(resumeText, pageCount, rubric);
  const quantificationFindings = checkQuantification(resumeText);

  const subscores = {
    coverage: scoreCoverage(requirements, coverage),
    term_match: termMatch.termMatchScore,
    structure: scoreStructure(structureFindings, rubric),
    quantification: scoreQuantification(quantificationFindings, rubric),
  };

  const weights = rubric.criteria.weights;
  const totalScore = Math.round(
    weights.coverage * subscores.coverage +
      weights.term_match * subscores.term_match +
      weights.structure * subscores.structure +
      weights.quantification * subscores.quantification,
  );

  await saveReview({
    resumeId: request.resume_id,
    opportunityId: request.opportunity_id,
    rubricId: rubric.id,
    totalScore,
    subscores,
    findings: {
      requirements,
      coverage,
      termMatch,
      structure: structureFindings,
      quantification: quantificationFindings,
    },
    promptVersion: `${EXTRACT_REQUIREMENTS_PROMPT_VERSION}+${COVERAGE_PROMPT_VERSION}`,
  });

  await markRequestProcessed(request.id);
}

// One bad request logs and the run continues — same posture as
// lib/ingest and lib/scoring.
export async function runReviewPass(): Promise<void> {
  const pending = await getPendingReviewRequests();
  if (pending.length === 0) return;

  const client = new Anthropic();
  for (const request of pending) {
    try {
      await processOne(request, client);
    } catch (err) {
      console.error(`runReviewPass: request ${request.id} failed, continuing`, err);
    }
  }
}
