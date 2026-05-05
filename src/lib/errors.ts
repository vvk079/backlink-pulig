import { z } from 'zod';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const asyncHandler = (
  fn: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>
) => {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const validateBody = <T>(schema: z.ZodSchema<T>) => {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: result.error.issues,
      });
      return;
    }
    req.body = result.data;
    next();
  };
};

export const parseSiteUrl = (url: string): { fullUrl: string; rootDomain: string } => {
  try {
    const parsed = new URL(url);
    let rootDomain = parsed.hostname.toLowerCase();
    // Strip leading www.
    if (rootDomain.startsWith('www.')) {
      rootDomain = rootDomain.slice(4);
    }
    return {
      fullUrl: `${parsed.protocol}//${parsed.host}`,
      rootDomain,
    };
  } catch {
    throw new AppError('INVALID_URL', 'Invalid URL format', 400);
  }
};