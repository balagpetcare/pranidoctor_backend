/** Shared API envelope types (synced from pranidoctor-web). */
export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
