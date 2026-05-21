import { SemenTemplateMediaKind } from "@/generated/prisma/browser";

export type AdminSemenUploadResult = {
  fileId: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export function uploadPurposeForSemenTemplateMedia(
  kind: SemenTemplateMediaKind | string,
): string | null {
  if (kind === SemenTemplateMediaKind.COVER) return "ADMIN_SEMEN_TEMPLATE_COVER";
  if (kind === SemenTemplateMediaKind.GALLERY) return "ADMIN_SEMEN_TEMPLATE_GALLERY";
  if (kind === SemenTemplateMediaKind.VIDEO_UPLOAD) return "ADMIN_SEMEN_TEMPLATE_VIDEO";
  return null;
}

export function mediaKindFileAccept(kind: SemenTemplateMediaKind | string): string {
  if (kind === SemenTemplateMediaKind.COVER || kind === SemenTemplateMediaKind.GALLERY) {
    return "image/jpeg,image/png,image/webp";
  }
  if (kind === SemenTemplateMediaKind.VIDEO_UPLOAD) return "video/mp4,video/webm";
  return "";
}

/**
 * Same-origin admin upload with optional progress (0–100).
 */
export function uploadAdminSemenFileWithProgress(params: {
  file: Blob;
  fileName: string;
  purpose: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<AdminSemenUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      params.signal?.removeEventListener("abort", onAbort);
      fn();
    };

    xhr.open("POST", "/api/admin/uploads");
    xhr.withCredentials = true;
    xhr.responseType = "json";

    const onAbort = () => {
      xhr.abort();
    };
    if (params.signal?.aborted) {
      queueMicrotask(() => finish(() => reject(new DOMException("আপলোড বাতিল", "AbortError"))));
      return;
    }
    params.signal?.addEventListener("abort", onAbort, { once: true });

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) {
        const pct = Math.min(100, Math.round((100 * e.loaded) / e.total));
        params.onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (params.signal?.aborted) {
        finish(() => reject(new DOMException("আপলোড বাতিল", "AbortError")));
        return;
      }

      const body = xhr.response as
        | { ok?: boolean; data?: AdminSemenUploadResult; error?: { code?: string; message?: string } }
        | null
        | undefined;

      if (xhr.status === 401) {
        finish(() => {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.href = `/admin/login?next=${encodeURIComponent(next)}`;
          reject(new Error("Not signed in"));
        });
        return;
      }

      if (!body || body.ok !== true || !body.data?.fileId) {
        const code = body?.error?.code?.trim();
        const msg = body?.error?.message?.trim() || "আপলোড ব্যর্থ";
        finish(() => reject(new Error(code ? `${code}: ${msg}` : msg)));
        return;
      }

      finish(() => resolve(body.data as AdminSemenUploadResult));
    };

    xhr.onerror = () => {
      finish(() => {
        if (params.signal?.aborted) {
          reject(new DOMException("আপলোড বাতিল", "AbortError"));
        } else {
          reject(new Error("নেটওয়ার্ক ত্রুটি"));
        }
      });
    };

    xhr.onabort = () => {
      finish(() => reject(new DOMException("আপলোড বাতিল", "AbortError")));
    };

    const fd = new FormData();
    fd.set("purpose", params.purpose);
    fd.set("file", params.file, params.fileName);
    xhr.send(fd);
  });
}
