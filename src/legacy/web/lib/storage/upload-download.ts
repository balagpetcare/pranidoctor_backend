import { UploadedFileStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { getSignedGetObjectUrl } from "./s3-client";
import { getStorageEnv, isS3Configured } from "./storage-env";

export async function getActiveUploadedFileOrNull(id: string) {
  return prisma.uploadedFile.findFirst({
    where: { id, status: UploadedFileStatus.ACTIVE },
  });
}

export async function getSignedDownloadUrlForUploadedFile(
  id: string,
  expiresInSeconds = 300,
): Promise<{ url: string } | "NOT_FOUND" | "NOT_CONFIGURED"> {
  const row = await getActiveUploadedFileOrNull(id);
  if (!row) return "NOT_FOUND";
  const env = getStorageEnv();
  if (!isS3Configured(env)) {
    return "NOT_CONFIGURED";
  }
  const url = await getSignedGetObjectUrl({
    env,
    key: row.storageKey,
    expiresIn: expiresInSeconds,
  });
  return { url };
}
