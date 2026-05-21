export interface ErrorDetails {
  [key: string]: unknown;
}

export abstract class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: ErrorDetails,
    isOperational = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    if (details !== undefined) {
      this.details = details;
    }
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}
