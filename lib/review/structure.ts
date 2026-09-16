import type { RubricRow } from '../db/reviews';
import { extractBullets } from './bullets';

// Common resume action verbs. Deliberately broad rather than exhaustive —
// docs/SCORING.md's Group A is deterministic (no LLM), so this list is the
// entire judgment call; a bullet starting with a verb not on this list
// will be flagged even if it's reasonable, which is why the finding always
// includes the actual bullet text for a human to override, not just a
// pass/fail count.
const ACTION_VERBS = new Set([
  'built', 'developed', 'designed', 'led', 'created', 'managed', 'implemented',
  'analyzed', 'engineered', 'architected', 'deployed', 'optimized', 'automated',
  'launched', 'drove', 'initiated', 'coordinated', 'established', 'integrated',
  'tested', 'debugged', 'wrote', 'resolved', 'presented', 'trained', 'mentored',
  'contributed', 'refactored', 'migrated', 'scaled', 'streamlined', 'delivered',
  'executed', 'spearheaded', 'orchestrated', 'authored', 'reduced', 'increased',
  'improved', 'devised', 'constructed', 'configured', 'maintained', 'audited',
  'researched', 'evaluated', 'diagnosed', 'shipped', 'ran', 'selected', 'tracked',
  'turned', 'participated', 'supported', 'collaborated', 'assisted', 'conducted',
  'performed', 'utilized', 'leveraged', 'enhanced', 'achieved', 'generated',
  'produced', 'cuts', 'cut', 'run', 'runs', 'track', 'tracks',
]);

// Matches a date, optionally followed by "- <end date>", as ONE unit —
// capturing only the start date (group 1). This matters specifically for
// ranges like "Jan 2019 - Nov 2021": matching start and end as two
// independent tokens made the later end date look like an out-of-order
// jump forward when compared against the *next* entry, since it's really
// one entry's span, not two sequential entries. Also excludes a date
// preceded by "expected" (e.g. "Expected Graduation: December 2029" is a
// future target, not a past entry).
const DATE = '(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|(?:19|20)\\d{2})';
const DATE_TOKEN = new RegExp(`(?<!expected[^.\\n]{0,25})\\b(${DATE})\\b(?:\\s*-\\s*${DATE}\\b)?`, 'gi');

export type StructureFindings = {
  pageCount: number;
  pageCountOk: boolean;
  bulletCount: number;
  overLongBulletCount: number; // approximate — see note below
  actionVerbStartCount: number;
  actionVerbStartPercent: number;
  nonActionVerbBullets: string[];
  detectedDatesInOrder: string[];
  datesReverseChronological: boolean | null; // null when fewer than 2 dates found
};

// Deterministic, no LLM, per docs/SCORING.md Group A. Two of these checks
// are necessarily approximate given plain-text extraction has no reliable
// concept of visual line wrapping or entry boundaries — flagged inline.
export function checkStructure(parsedText: string, pageCount: number, rubric: RubricRow): StructureFindings {
  const bullets = extractBullets(parsedText);

  // No reliable way to know the PDF's visual line wrap from extracted text
  // alone, so this is a character-length proxy (~2 lines at a typical
  // resume's characters-per-line) rather than a true line count.
  const LONG_BULLET_CHAR_THRESHOLD = 200;
  const overLongBulletCount = bullets.filter((b) => b.length > LONG_BULLET_CHAR_THRESHOLD).length;

  const nonActionVerbBullets = bullets.filter((b) => {
    const firstWord = b.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '').toLowerCase();
    return firstWord ? !ACTION_VERBS.has(firstWord) : true;
  });
  const actionVerbStartCount = bullets.length - nonActionVerbBullets.length;

  const detectedDatesInOrder = [...parsedText.matchAll(DATE_TOKEN)].map((m) => m[1]);
  const datesReverseChronological =
    detectedDatesInOrder.length < 2 ? null : isRoughlyDescending(detectedDatesInOrder);

  return {
    pageCount,
    pageCountOk: pageCount <= rubric.criteria.structure.maxPages,
    bulletCount: bullets.length,
    overLongBulletCount,
    actionVerbStartCount,
    actionVerbStartPercent: bullets.length === 0 ? 0 : Math.round((actionVerbStartCount / bullets.length) * 100),
    nonActionVerbBullets,
    detectedDatesInOrder,
    datesReverseChronological,
  };
}

function yearOf(dateToken: string): number {
  const match = dateToken.match(/\d{4}/);
  return match ? Number(match[0]) : 0;
}

function isRoughlyDescending(tokens: string[]): boolean {
  for (let i = 1; i < tokens.length; i++) {
    if (yearOf(tokens[i]) > yearOf(tokens[i - 1])) return false;
  }
  return true;
}

// Weighted per rubric.criteria.weights.structure — see lib/review/index.ts
// for how this rolls into the composite score.
export function scoreStructure(findings: StructureFindings, rubric: RubricRow): number {
  const checks = [
    findings.pageCountOk,
    findings.overLongBulletCount === 0,
    findings.actionVerbStartPercent >= rubric.criteria.structure.actionVerbStartPercent,
    findings.datesReverseChronological !== false, // true or unknown (null) both pass
    findings.bulletCount >= rubric.criteria.structure.bulletsPerRoleMin,
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}
