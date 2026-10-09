import { z } from 'zod';

// What `web`'s server action forwards for one form submission. The field
// definitions are NOT in here: the API reads them from the live page itself
// (blocks[blockIndex]), so a visitor can't add fields or drop `required`.
export const createSubmissionSchema = z.object({
  path: z.string().min(1).max(2000),
  blockIndex: z.number().int().min(0).max(1000),
  values: z.record(z.string(), z.string().max(10_000)),
});

export type CreateSubmissionDto = z.infer<typeof createSubmissionSchema>;

/** One stored answer — a snapshot of the field's label at submission time. */
export type SubmissionAnswer = { name: string; label: string; value: string };
