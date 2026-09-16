-- Phase 5: first rubric, per docs/ROADMAP.md's Phase 5 exit criterion.
-- Weights are the fixed composite formula from docs/SCORING.md
-- ("total = 0.45 * coverage + 0.25 * term_match + 0.20 * structure +
-- 0.10 * quantification"). The structure thresholds are the same generic
-- ones already stated in docs/SCORING.md's Group A table -- this rubric
-- doesn't invent new numbers, it's the first family to actually use them.

insert into rubrics (role_family, version, criteria)
values (
  'swe_intern',
  1,
  '{
    "weights": {
      "coverage": 0.45,
      "term_match": 0.25,
      "structure": 0.20,
      "quantification": 0.10
    },
    "structure": {
      "maxPages": 1,
      "bulletsPerRoleMin": 3,
      "bulletsPerRoleMax": 6,
      "maxBulletLines": 2,
      "actionVerbStartPercent": 100
    },
    "quantification": {
      "quantifiedBulletPercentTarget": 50
    }
  }'::jsonb
)
on conflict do nothing;
