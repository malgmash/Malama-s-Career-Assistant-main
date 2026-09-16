import type { Requirement } from './requirements';
import type { ProfileFactForMatching } from '../db/matches';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'with', 'and', 'or', 'to', 'for', 'is',
  'are', 'be', 'as', 'at', 'by', 'years', 'year', 'experience', 'working',
  'knowledge', 'familiarity', 'strong', 'excellent', 'good', 'ability',
  'skills', 'plus', 'preferred', 'required', 'degree', 'related', 'field',
]);

export type TermMatchResult = {
  matchedTerms: string[];
  suggestedAdditions: string[]; // backed by a demonstrated profile_fact, just not in the resume text
  unsupportedGaps: string[]; // no backing fact, or only coursework/exposure strength
  termMatchScore: number;
};

// Pulls candidate terms out of a requirement's short phrase — this is a
// coarse, word-level approximation of docs/SCORING.md's "extract
// technologies and noun phrases", not a real noun-phrase extractor. ATS
// matching is itself fairly literal per the same doc, so word-level
// overlap is a defensible stand-in, not a shortcut taken for convenience.
function candidateTerms(requirement: Requirement): string[] {
  return requirement.text
    .split(/[\s,/]+/)
    .map((w) => w.replace(/[^a-zA-Z0-9+#.]/g, ''))
    .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
}

function appearsInText(term: string, text: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

// Group C, per docs/SCORING.md: reuses the requirements already extracted
// for Group B (extract-requirements.v1) rather than a second LLM call —
// same terms are relevant to both, and the doc doesn't require a separate
// extraction pass.
export function checkTermMatch(
  requirements: Requirement[],
  resumeText: string,
  facts: ProfileFactForMatching[],
): TermMatchResult {
  const allTerms = [...new Set(requirements.flatMap(candidateTerms))];
  const matchedTerms: string[] = [];
  const missing: string[] = [];

  for (const term of allTerms) {
    if (appearsInText(term, resumeText)) {
      matchedTerms.push(term);
    } else {
      missing.push(term);
    }
  }

  const demonstratedFactsText = facts
    .filter((f) => f.strength === 'demonstrated')
    .map((f) => f.claim)
    .join(' \n ');

  const suggestedAdditions = missing.filter((term) => appearsInText(term, demonstratedFactsText));
  const unsupportedGaps = missing.filter((term) => !suggestedAdditions.includes(term));

  return {
    matchedTerms,
    suggestedAdditions,
    unsupportedGaps,
    termMatchScore: allTerms.length === 0 ? 100 : Math.round((matchedTerms.length / allTerms.length) * 100),
  };
}
