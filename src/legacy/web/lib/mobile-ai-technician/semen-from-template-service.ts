import {
  AiTechnicianServiceStatus,
  Prisma,
  SemenTemplateApprovalStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { CreateServiceFromTemplateBody } from "./semen-mobile-schemas";
import { assertTechnicianCanUseTemplates } from "./semen-template-catalog-service";

function toDecimal(v: number | string): Prisma.Decimal {
  const s = typeof v === "number" ? String(v) : v.trim();
  return new Prisma.Decimal(s);
}

function buildBreedCompositionLabel(
  mixes: { percentage: Prisma.Decimal; breed: { nameEn: string } }[],
): string {
  return mixes
    .map((m) => `${m.percentage.toString()}% ${m.breed.nameEn}`)
    .join(" + ");
}

function validateOfferDiscountXor(offer: unknown, disc: unknown) {
  const hasOffer = offer != null && String(offer).trim() !== "";
  const hasDisc = disc != null && String(disc).trim() !== "";
  if (hasOffer && hasDisc) return false;
  return true;
}

export async function createTechnicianServiceFromTemplate(
  userId: string,
  body: CreateServiceFromTemplateBody,
) {
  const gate = await assertTechnicianCanUseTemplates(userId);
  if (gate.ok !== true) return gate;

  const template = await prisma.semenServiceTemplate.findFirst({
    where: {
      id: body.templateId.trim(),
      isActive: true,
      approvalStatus: SemenTemplateApprovalStatus.APPROVED,
    },
    include: {
      breedMixes: { include: { breed: true } },
    },
  });
  if (!template) return { ok: "TEMPLATE_NOT_FOUND" as const };

  if (!validateOfferDiscountXor(body.offerPrice, body.discountPercent)) {
    return { ok: "OFFER_DISCOUNT_BOTH" as const };
  }

  const dup = await prisma.aiTechnicianService.findFirst({
    where: {
      aiTechnicianId: gate.profileId,
      semenServiceTemplateId: template.id,
    },
    select: { id: true },
  });
  if (dup) return { ok: "DUPLICATE_TEMPLATE_SERVICE" as const };

  const basePrice =
    body.basePrice !== undefined && body.basePrice !== null && String(body.basePrice).trim() !== ""
      ? toDecimal(body.basePrice as number | string)
      : template.defaultBasePrice;

  const offerPrice =
    body.offerPrice !== undefined && body.offerPrice !== null && String(body.offerPrice).trim() !== ""
      ? toDecimal(body.offerPrice as number | string)
      : template.defaultOfferPrice;

  const discountPercent =
    body.discountPercent !== undefined &&
    body.discountPercent !== null &&
    String(body.discountPercent).trim() !== ""
      ? toDecimal(body.discountPercent as number | string)
      : template.defaultDiscountPercent;

  if (!validateOfferDiscountXor(offerPrice, discountPercent)) {
    return { ok: "OFFER_DISCOUNT_BOTH" as const };
  }

  const breedLabel = buildBreedCompositionLabel(template.breedMixes);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const svc = await tx.aiTechnicianService.create({
        data: {
          aiTechnicianId: gate.profileId,
          title: template.internalName.trim(),
          animalType: template.animalType,
          breedOrSemenType: breedLabel,
          description: template.shortDescription?.trim() || null,
          basePrice,
          visitFee:
            body.visitFee === undefined || body.visitFee === null
              ? null
              : toDecimal(body.visitFee as number | string),
          emergencyFee:
            body.emergencyFee === undefined || body.emergencyFee === null
              ? null
              : toDecimal(body.emergencyFee as number | string),
          repeatServicePolicy: null,
          followUpIncluded: false,
          status: AiTechnicianServiceStatus.DRAFT,
          semenServiceTemplateId: template.id,
          offerPrice: offerPrice ?? null,
          discountPercent: discountPercent ?? null,
          isAvailable: body.isAvailable ?? true,
          technicianServiceNote: body.technicianServiceNote?.trim() || null,
        },
      });

      if (body.initialInventoryLot && body.initialInventoryLot.currentQuantity >= 0) {
        await tx.technicianSemenInventory.create({
          data: {
            aiTechnicianServiceId: svc.id,
            currentQuantity: body.initialInventoryLot.currentQuantity,
            reservedQuantity: body.initialInventoryLot.reservedQuantity ?? 0,
            usedQuantity: body.initialInventoryLot.usedQuantity ?? 0,
            minStockAlert: body.initialInventoryLot.minStockAlert ?? null,
            batchNumber: body.initialInventoryLot.batchNumber?.trim() || null,
            expiryDate: body.initialInventoryLot.expiryDate
              ? new Date(body.initialInventoryLot.expiryDate)
              : null,
            sourceNote: body.initialInventoryLot.sourceNote?.trim() || null,
            storageNote: body.initialInventoryLot.storageNote?.trim() || null,
            isActive: true,
          },
        });
      }

      return tx.aiTechnicianService.findUniqueOrThrow({
        where: { id: svc.id },
        include: {
          semenServiceTemplate: {
            include: {
              semenProvider: true,
              breedMixes: { include: { breed: true } },
              media: { orderBy: { sortOrder: "asc" } },
            },
          },
          semenInventoryLots: true,
        },
      });
    });

    return { ok: true as const, service: created };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: "DUPLICATE_TEMPLATE_SERVICE" as const };
    }
    throw e;
  }
}
