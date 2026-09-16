const BULLET_LINE = /^\s*[•●◦\-*]\s+(.*)/;

// A bulleted line that's actually a labeled inventory ("Technical
// Infrastructure: PostgreSQL, TypeScript, ...", "Skills Involved: ...",
// "Languages: Python, C, ...") isn't an accomplishment statement — it was
// never going to start with a verb or contain a metric, and shouldn't be
// judged as if it were. Confirmed against a real resume where these made
// up roughly a third of all bulleted lines and were skewing both the
// action-verb and quantification checks for no real reason.
const LABELED_LIST_BULLET = /^[A-Z][A-Za-z /&-]{2,40}:\s/;

// Shared by structure.ts (Group A) and quantification.ts (Group D) so both
// groups agree on what counts as an accomplishment bullet.
export function extractBullets(parsedText: string): string[] {
  return parsedText
    .split('\n')
    .map((line) => line.match(BULLET_LINE))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => match[1].trim())
    .filter((bullet) => !LABELED_LIST_BULLET.test(bullet));
}
