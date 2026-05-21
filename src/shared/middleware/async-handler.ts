import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function wrapController<T extends Record<string, AsyncRequestHandler>>(
  controller: T
): { [K in keyof T]: RequestHandler } {
  const wrapped = {} as { [K in keyof T]: RequestHandler };

  for (const key of Object.keys(controller) as Array<keyof T>) {
    const method = controller[key];
    if (typeof method === 'function') {
      wrapped[key] = asyncHandler(method.bind(controller));
    }
  }

  return wrapped;
}
