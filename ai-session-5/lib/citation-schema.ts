import { z } from "zod";

/** Shared Zod schema — used by Nest cited-answer and client useObject. */
export const citedAnswerSchema = z.object({
  answer: z.string().describe("The answer to the user question."),
  citations: z.array(
    z.object({
      chunkTitle: z.string().describe("Title of the kb_articles row used."),
      quote: z.string().describe("The exact supporting sentence, verbatim."),
    }),
  ),
});
