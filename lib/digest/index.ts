import {
  getAllBlockers,
  getClosingSoonEligibleOpportunities,
  getNewEligibleOpportunities,
  saveDigest,
  type DigestOpportunity,
} from '../db/digest';

const NEW_WINDOW_DAYS = 7;
const CLOSING_WINDOW_DAYS = 7;
const TOP_CLUSTER_COUNT = 8;

// The second half of this list isn't generic English stopwords — it's
// scaffolding specific to how prompts/rank.v2.md phrases date/field
// mismatches ("Targets Summer 2026, not Summer 2027", "Field is X, not
// one of the qualifying fields"). Confirmed against real data: without
// these, the top clusters were just "2027", "summer", "targets", "term",
// drowning out actually-informative terms like "hardware".
const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'with', 'and', 'or', 'to', 'for', 'is',
  'are', 'be', 'as', 'at', 'by', 'not', 'no', 'stated', 'supplied', 'fact',
  'facts', 'profile', 'requirement', 'requirements', 'that', 'this', 'from',
  'demonstrates', 'demonstrated', 'experience', 'unclear', 'confirm',
  'confirmation', 'explicitly', 'none',
  'summer', 'term', 'terms', 'targets', 'target', 'targeting', 'targeted',
  'field', 'fields', 'qualifying', 'one', 'restriction', 'restrictions',
]);

export type BlockerCluster = { term: string; count: number };

// Word-frequency over already-LLM-written blocker text — deterministic,
// no model call. Coarse (word-level, like lib/review/terms.ts's term
// matching) but good enough to answer "what keeps coming up", which is
// all a weekly digest needs.
export function clusterBlockers(blockers: string[]): BlockerCluster[] {
  const counts = new Map<string, number>();
  for (const blocker of blockers) {
    const words = blocker
      .split(/[\s,/().;:]+/)
      .map((w) => w.replace(/[^a-zA-Z0-9+#.]/g, ''))
      .filter((w) => w.length > 2 && !STOPWORDS.has(w.toLowerCase()));
    for (const word of new Set(words.map((w) => w.toLowerCase()))) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_CLUSTER_COUNT);
}

function formatOpportunity(o: DigestOpportunity): string {
  return `${o.title} — ${o.org}${o.deadline ? ` (deadline ${o.deadline})` : ''}`;
}

function buildSummary(newOnes: DigestOpportunity[], closingSoon: DigestOpportunity[], clusters: BlockerCluster[]): string {
  const lines: string[] = [];
  lines.push(`${newOnes.length} new eligible opportunit${newOnes.length === 1 ? 'y' : 'ies'} this week.`);
  lines.push(`${closingSoon.length} closing within ${CLOSING_WINDOW_DAYS} days.`);
  if (clusters.length > 0) {
    lines.push(`Recurring blockers: ${clusters.map((c) => `${c.term} (${c.count})`).join(', ')}.`);
  }
  return lines.join(' ');
}

export async function computeDigest(): Promise<void> {
  const now = new Date();
  const sinceNew = new Date(now.getTime() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const untilClosing = new Date(now.getTime() + CLOSING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [newOnes, closingSoon, allBlockers] = await Promise.all([
    getNewEligibleOpportunities(sinceNew.toISOString()),
    getClosingSoonEligibleOpportunities(now.toISOString().slice(0, 10), untilClosing.toISOString().slice(0, 10)),
    getAllBlockers(),
  ]);

  const clusters = clusterBlockers(allBlockers);
  const summary = buildSummary(newOnes, closingSoon, clusters);

  await saveDigest({
    newCount: newOnes.length,
    closingSoonCount: closingSoon.length,
    summary,
    details: {
      new: newOnes.map(formatOpportunity),
      closingSoon: closingSoon.map(formatOpportunity),
      blockerClusters: clusters,
    },
  });
}
