export type ClientRequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export function getClientRequestMeta(request: Request): ClientRequestMeta {
  const xf = request.headers.get("x-forwarded-for");
  const ipAddress = xf?.split(",")[0]?.trim() || null;
  const userAgent = request.headers.get("user-agent");
  return { ipAddress, userAgent };
}
