import { z } from 'zod';

/**
 * `API/Errors/ApiException.cs` - the body `ExceptionMiddleware` serialises for an
 * unhandled exception. `details` is the stack trace in Development and
 * `"Internal server error"` otherwise.
 */
export const ApiExceptionSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  details: z.string().nullish(),
});

export type ApiException = z.infer<typeof ApiExceptionSchema>;
