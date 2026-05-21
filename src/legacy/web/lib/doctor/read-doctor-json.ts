/**
 * Parses `{ ok: true, data }` doctor API responses and redirects on 401.
 */
export async function readDoctorJson<T>(res: Response): Promise<T> {
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new Error("Invalid response from server");
  }

  const body = parsed as
    | { ok: true; data: T }
    | { ok: false; error?: { message?: string } };

  if (res.status === 401) {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/doctor/login?next=${encodeURIComponent(next)}`;
    throw new Error("Not signed in");
  }

  if (!body.ok || !("data" in body)) {
    throw new Error(body.error?.message ?? "Request failed");
  }

  return body.data;
}
