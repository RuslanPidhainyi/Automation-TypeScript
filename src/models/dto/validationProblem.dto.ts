import { z } from 'zod';

/**
 * ASP.NET Core's `ValidationProblemDetails` - what `[ApiController]` answers,
 * with 400, when a body breaks its DTO's data annotations, before the action
 * even runs. `errors` maps each invalid property, PascalCase, to its messages.
 */
export const ValidationProblemSchema = z.object({
  status: z.number(),
  errors: z.record(z.string(), z.array(z.string())),
});

export type ValidationProblem = z.infer<typeof ValidationProblemSchema>;
