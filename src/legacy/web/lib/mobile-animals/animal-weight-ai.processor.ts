import { Prisma } from "@/generated/prisma/client";
import {
  AnimalWeightAiJobStatus,
  AnimalWeightMeasurementSource,
  AnimalWeightMethod,
} from "@/generated/prisma/client";

import { getAiOrchestratorService } from "../../../../modules/ai/orchestrator/ai-orchestrator.service.js";
import { prisma } from "@/lib/prisma";
import { buildAppDownloadUrl } from "@/lib/storage/storage-module";

function uploadPublicUrl(fileId: string): string {
  const base =
    process.env.APP_PUBLIC_URL?.trim() ||
    process.env.API_BASE_URL?.trim() ||
    "http://localhost:3000";
  return buildAppDownloadUrl(base, fileId);
}

import { roundWeightKg } from "./tape-formula-registry.js";
import {
  toAiJobJsonDto,
  toMeasurementJsonDto,
} from "./animal-weight-mapper.js";
import { mirrorAnimalProfileWeight } from "./animal-weight-profile.util.js";

const WEIGHT_JSON_REGEX =
  /\{[\s\S]*"weightKg"\s*:\s*([0-9.]+)[\s\S]*"confidence"\s*:\s*([0-9.]+)/i;

function parseAiWeightResponse(content: string): {
  weightKg: number;
  confidence: number;
} | null {
  const trimmed = content.trim();
  try {
    const json = JSON.parse(trimmed) as {
      weightKg?: number;
      confidence?: number;
    };
    if (
      typeof json.weightKg === "number" &&
      json.weightKg > 0 &&
      typeof json.confidence === "number"
    ) {
      return {
        weightKg: json.weightKg,
        confidence: Math.min(1, Math.max(0, json.confidence)),
      };
    }
  } catch {
    // fall through
  }

  const match = WEIGHT_JSON_REGEX.exec(trimmed);
  if (!match) return null;
  const weightKg = Number.parseFloat(match[1]);
  const confidence = Number.parseFloat(match[2]);
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(confidence)) return null;
  return { weightKg, confidence: Math.min(1, Math.max(0, confidence)) };
}

export async function processAnimalWeightAiJob(jobId: string): Promise<void> {
  const job = await prisma.animalWeightAiJob.findUnique({
    where: { id: jobId },
  });
  if (!job) return;
  if (
    job.status === AnimalWeightAiJobStatus.SUCCEEDED ||
    job.status === AnimalWeightAiJobStatus.FAILED ||
    job.status === AnimalWeightAiJobStatus.CANCELLED
  ) {
    return;
  }

  if (!job.animalId) {
    await prisma.animalWeightAiJob.update({
      where: { id: jobId },
      data: {
        status: AnimalWeightAiJobStatus.FAILED,
        errorCode: "ANIMAL_REQUIRED",
        errorMessage: "Animal must exist before AI weight processing",
        completedAt: new Date(),
      },
    });
    return;
  }

  await prisma.animalWeightAiJob.update({
    where: { id: jobId },
    data: {
      status: AnimalWeightAiJobStatus.PROCESSING,
      startedAt: new Date(),
    },
  });

  try {
    const imageUrls = job.uploadIds.map((id) => uploadPublicUrl(id));
    const mediaLines = imageUrls.map((u) => `- ${u}`).join("\n");
    const videoLine = job.videoUploadId
      ? `\nVideo: ${uploadPublicUrl(job.videoUploadId)}`
      : "";

    const cp = await prisma.customerProfile.findUnique({
      where: { id: job.customerId },
      select: { userId: true },
    });

    const output = await getAiOrchestratorService().complete({
      feature: "livestock_weight_estimate",
      taskType: "IMAGE_ANALYSIS",
      systemPrompt:
        "You estimate live body weight in kilograms for livestock from images. " +
        "Respond with JSON only: {\"weightKg\": number, \"confidence\": 0-1, \"reasoningBrief\": string}. " +
        "No diagnosis. Bangladesh farm context.",
      userMessage: [
        `Animal type: ${job.animalType ?? "OTHER"}`,
        "Images:",
        mediaLines,
        videoLine,
      ]
        .filter(Boolean)
        .join("\n"),
      userId: cp?.userId,
      customerId: job.customerId,
      maxTokens: 512,
      temperature: 0.2,
    });

    const parsed = parseAiWeightResponse(output.content);
    if (!parsed) {
      throw new Error("AI_PARSE_FAILED");
    }

    const measuredAt = new Date();
    const measuredOn = new Date(
      Date.UTC(
        measuredAt.getUTCFullYear(),
        measuredAt.getUTCMonth(),
        measuredAt.getUTCDate(),
      ),
    );

    await prisma.$transaction(async (tx) => {
      await tx.animalWeightAiJob.update({
        where: { id: jobId },
        data: {
          status: AnimalWeightAiJobStatus.SUCCEEDED,
          resultWeightKg: new Prisma.Decimal(roundWeightKg(parsed.weightKg)),
          confidence: new Prisma.Decimal(parsed.confidence.toFixed(4)),
          modelId: output.model ?? null,
          providerId: output.provider ?? null,
          completedAt: new Date(),
        },
      });

      const existing = await tx.animalWeightMeasurement.findFirst({
        where: { aiJobId: jobId },
      });

      if (!existing) {
        const measurement = await tx.animalWeightMeasurement.create({
          data: {
            customerId: job.customerId,
            animalId: job.animalId!,
            method: AnimalWeightMethod.AI_CAMERA,
            source: AnimalWeightMeasurementSource.REGISTRATION,
            weightKg: new Prisma.Decimal(roundWeightKg(parsed.weightKg)),
            measuredAt,
            measuredOn,
            aiJobId: jobId,
            aiConfidence: new Prisma.Decimal(parsed.confidence.toFixed(4)),
            aiModelId: output.model ?? null,
            aiDisclaimerAck: true,
            mediaAssetIds: [
              ...job.uploadIds,
              ...(job.videoUploadId ? [job.videoUploadId] : []),
            ],
          },
        });

        await mirrorAnimalProfileWeight(tx, job.animalId!, {
          weightKg: measurement.weightKg,
          method: AnimalWeightMethod.AI_CAMERA,
          measuredAt,
        });
      }
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI processing failed";
    await prisma.animalWeightAiJob.update({
      where: { id: jobId },
      data: {
        status: AnimalWeightAiJobStatus.FAILED,
        errorCode: message === "AI_PARSE_FAILED" ? "AI_PARSE_FAILED" : "AI_ERROR",
        errorMessage: message.slice(0, 500),
        completedAt: new Date(),
      },
    });
  }
}

export async function getAiJobForCustomer(
  customerId: string,
  jobId: string,
  options?: { processIfPending?: boolean },
) {
  if (options?.processIfPending !== false) {
    const row = await prisma.animalWeightAiJob.findFirst({
      where: { id: jobId, customerId },
    });
    if (row?.status === AnimalWeightAiJobStatus.PENDING) {
      await processAnimalWeightAiJob(jobId);
    }
  }

  const job = await prisma.animalWeightAiJob.findFirst({
    where: { id: jobId, customerId },
  });
  if (!job) return null;

  const measurement = await prisma.animalWeightMeasurement.findFirst({
    where: { aiJobId: jobId },
  });

  return {
    job: toAiJobJsonDto(job),
    measurement: measurement ? toMeasurementJsonDto(measurement) : null,
  };
}
