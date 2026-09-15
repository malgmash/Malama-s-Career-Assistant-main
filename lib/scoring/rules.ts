import type { OpportunityForMatching } from '../db/matches';
import { ACTIVE_INTEREST_KINDS, FRESHNESS_DAYS } from './config';

const CITIZENSHIP_REQUIRED_TAG = 'citizenship_required';

export type RuleResult = {
  pass: boolean;
  ruleScore: number;
};

// Pass 1, per docs/SCORING.md: deterministic, no model, on structured
// fields only. Field relevance, class-year targeting, and region/travel
// reimbursement can't be judged reliably from structured fields alone (see
// the in-session plan discussion) so those stay in Pass 2 (rank.ts), which
// reads the free text. This pass only kills what's cheaply and reliably
// checkable: interest kind, freshness, an unpassed deadline, and an
// explicit international-student exclusion when the source states one.
export function applyRules(opportunity: OpportunityForMatching): RuleResult {
  if (!(ACTIVE_INTEREST_KINDS as readonly string[]).includes(opportunity.kind)) {
    return { pass: false, ruleScore: 0 };
  }

  const daysSinceSeen =
    (Date.now() - new Date(opportunity.last_seen_at).getTime()) / (24 * 60 * 60 * 1000);
  if (daysSinceSeen > FRESHNESS_DAYS) {
    return { pass: false, ruleScore: 0 };
  }

  if (opportunity.deadline !== null) {
    const deadlinePassed = new Date(opportunity.deadline).getTime() < Date.now();
    if (deadlinePassed) {
      return { pass: false, ruleScore: 0 };
    }
  }

  if (opportunity.tags.includes(CITIZENSHIP_REQUIRED_TAG)) {
    return { pass: false, ruleScore: 0 };
  }

  return { pass: true, ruleScore: 100 };
}
