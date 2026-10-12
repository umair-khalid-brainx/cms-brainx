import { z } from 'zod';

// Shapes only: the service normalises both addresses and explains what's wrong (GOV-05).
export const createRedirectSchema = z.object({
  fromPath: z.string().trim().min(1, 'Enter the old address, like /old-page.').max(500),
  toPath: z.string().trim().min(1, 'Enter where visitors should go, like /new-page.').max(500),
});

export type CreateRedirectDto = z.infer<typeof createRedirectSchema>;
