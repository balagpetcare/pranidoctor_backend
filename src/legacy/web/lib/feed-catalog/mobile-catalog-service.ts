import { FeedCategory, Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";



import {

  feedCatalogMatchesQuery,

  mapFeedCatalogItem,

} from "../../../../shared/feed-catalog/catalog-meta.js";

import { feedCategoryToFeedType } from "./category-map";



export async function mobileListFeedCatalog(params: {

  q?: string;

  category?: FeedCategory;

  limit: number;

}) {

  const where: Prisma.FeedCatalogWhereInput = { isActive: true };

  if (params.category) where.category = params.category;



  const rows = await prisma.feedCatalog.findMany({

    where,

    orderBy: [{ sortOrder: "asc" }, { nameBn: "asc" }],

  });



  const q = params.q?.trim();

  const filtered = q

    ? rows.filter((row) => feedCatalogMatchesQuery(row, q))

    : rows;



  return {

    items: filtered.slice(0, params.limit).map((row) =>

      mapFeedCatalogItem({

        id: row.id,

        code: row.code,

        nameBn: row.nameBn,

        nameEn: row.nameEn,

        category: row.category,

        defaultUnit: row.defaultUnit,

        approxPriceBdt: row.approxPriceBdt,

        availabilityScore: row.availabilityScore,

        sortOrder: row.sortOrder,

        nutritionJson: row.nutritionJson,

        legacyFeedType: feedCategoryToFeedType(row.category),

      }),

    ),

  };

}



export async function mobileGetFeedCatalogById(id: string) {

  const row = await prisma.feedCatalog.findFirst({

    where: { id, isActive: true },

  });

  if (!row) return null;

  return mapFeedCatalogItem({

    id: row.id,

    code: row.code,

    nameBn: row.nameBn,

    nameEn: row.nameEn,

    category: row.category,

    defaultUnit: row.defaultUnit,

    approxPriceBdt: row.approxPriceBdt,

    availabilityScore: row.availabilityScore,

    sortOrder: row.sortOrder,

    nutritionJson: row.nutritionJson,

    legacyFeedType: feedCategoryToFeedType(row.category),

  });

}

