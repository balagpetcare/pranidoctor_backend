/**
 * Same-origin doctor API calls — ensures session cookies are included in the browser.
 */
export function doctorFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    credentials: "same-origin",
    ...init,
  });
}
