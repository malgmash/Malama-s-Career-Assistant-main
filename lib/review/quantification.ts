import type { RubricRow } from '../db/reviews';
import { extractBullets } from './bullets';

const HAS_NUMBER = /\d/;

export type QuantificationFindings = {
  bulletCount: number;
  quantifiedBulletCount: number;
  quantifiedBulletPercent: number;
  bulletsMissingNumbers: string[];
};

// Group D, deterministic, per docs/SCORING.md: "percentage of bullets
// containing a concrete number... report the bullets missing one rather
// than a bare percentage."
export function checkQuantification(parsedText: string): QuantificationFindings {
  const bullets = extractBullets(parsedText);
  const bulletsMissingNumbers = bullets.filter((b) => !HAS_NUMBER.test(b));
  const quantifiedBulletCount = bullets.length - bulletsMissingNumbers.length;

  return {
    bulletCount: bullets.length,
    quantifiedBulletCount,
    quantifiedBulletPercent: bullets.length === 0 ? 0 : Math.round((quantifiedBulletCount / bullets.length) * 100),
    bulletsMissingNumbers,
  };
}

export function scoreQuantification(findings: QuantificationFindings, rubric: RubricRow): number {
  const target = rubric.criteria.quantification.quantifiedBulletPercentTarget;
  if (target === 0) return 100;
  return Math.min(100, Math.round((findings.quantifiedBulletPercent / target) * 100));
}
