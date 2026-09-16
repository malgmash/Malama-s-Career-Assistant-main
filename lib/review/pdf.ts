import { PDFParse } from 'pdf-parse';

export type ParsedResume = {
  text: string;
  pageCount: number;
};

// Deterministic, no LLM — this is docs/SCORING.md's Group A "parse test":
// full text recoverable from the PDF, nothing trapped in tables, columns,
// headers or images. Using a plain library (not Claude reading the PDF)
// matters here specifically: a real applicant-tracking system is not an
// AI, so this has to reflect what a dumb text extractor actually recovers,
// not what a model can visually infer.
export async function parseResumePdf(fileBuffer: Buffer): Promise<ParsedResume> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    return {
      text: textResult.text,
      pageCount: info.total,
    };
  } finally {
    await parser.destroy();
  }
}
