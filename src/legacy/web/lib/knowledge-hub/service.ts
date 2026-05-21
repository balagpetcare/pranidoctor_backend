import {
  ContentApprovalStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { isLikelyCuid } from "./schemas";

const authorPublicSelect = {
  id: true,
  email: true,
  role: true,
  adminProfile: { select: { displayName: true } },
  doctorProfile: { select: { displayName: true } },
} satisfies Prisma.UserSelect;

export type TutorialAuthorPublic = Prisma.UserGetPayload<{
  select: typeof authorPublicSelect;
}>;

export function displayNameForTutorialAuthor(u: TutorialAuthorPublic): string | null {
  return (
    u.doctorProfile?.displayName ??
    u.adminProfile?.displayName ??
    null
  );
}

const postPublicInclude = {
  category: {
    select: { id: true, nameBn: true, nameEn: true, slug: true },
  },
  author: { select: authorPublicSelect },
} satisfies Prisma.ContentPostInclude;

export type ContentPostPublicPayload = Prisma.ContentPostGetPayload<{
  include: typeof postPublicInclude;
}>;

export async function listActiveTutorialCategories() {
  return prisma.contentCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { nameBn: "asc" }],
    select: {
      id: true,
      nameBn: true,
      nameEn: true,
      slug: true,
      description: true,
      sortOrder: true,
    },
  });
}

export async function listPublishedTutorials(params: {
  take: number;
  skip: number;
  categoryId?: string;
  categorySlug?: string;
}) {
  const categoryFilter =
    params.categoryId != null
      ? { categoryId: params.categoryId }
      : params.categorySlug != null
        ? { category: { slug: params.categorySlug, isActive: true } }
        : {};

  const rows = await prisma.contentPost.findMany({
    where: {
      approvalStatus: ContentApprovalStatus.APPROVED,
      isPublished: true,
      ...categoryFilter,
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: params.take,
    skip: params.skip,
    include: postPublicInclude,
  });

  const total = await prisma.contentPost.count({
    where: {
      approvalStatus: ContentApprovalStatus.APPROVED,
      isPublished: true,
      ...categoryFilter,
    },
  });

  return { tutorials: rows, total };
}

export async function getPublishedTutorialBySlugOrId(slugOrId: string) {
  if (isLikelyCuid(slugOrId)) {
    const byId = await prisma.contentPost.findFirst({
      where: {
        id: slugOrId,
        approvalStatus: ContentApprovalStatus.APPROVED,
        isPublished: true,
      },
      include: postPublicInclude,
    });
    if (byId) return byId;
  }

  return prisma.contentPost.findFirst({
    where: {
      slug: slugOrId,
      approvalStatus: ContentApprovalStatus.APPROVED,
      isPublished: true,
    },
    include: postPublicInclude,
  });
}

function editableStatuses(): ContentApprovalStatus[] {
  return [
    ContentApprovalStatus.DRAFT,
    ContentApprovalStatus.PENDING_REVIEW,
    ContentApprovalStatus.REJECTED,
  ];
}

export async function createTutorialAsAuthor(
  authorId: string,
  data: {
    title: string;
    slug: string;
    summary?: string | null;
    body: string;
    coverImageUrl?: string | null;
    categoryId: string;
  },
) {
  const category = await prisma.contentCategory.findUnique({
    where: { id: data.categoryId },
  });
  if (!category) {
    return { ok: false as const, code: "CATEGORY_NOT_FOUND" as const };
  }

  try {
    const post = await prisma.contentPost.create({
      data: {
        title: data.title,
        slug: data.slug,
        summary: data.summary ?? null,
        body: data.body,
        coverImageUrl: data.coverImageUrl ?? null,
        categoryId: data.categoryId,
        authorId,
        approvalStatus: ContentApprovalStatus.DRAFT,
        isPublished: false,
      },
      include: postPublicInclude,
    });
    return { ok: true as const, post };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false as const, code: "SLUG_TAKEN" as const };
    }
    throw e;
  }
}

export async function updateTutorialAsAuthor(
  authorId: string,
  postId: string,
  patch: Partial<{
    title: string;
    slug: string;
    summary: string | null;
    body: string;
    coverImageUrl: string | null;
    categoryId: string;
  }>,
) {
  const existing = await prisma.contentPost.findUnique({
    where: { id: postId },
  });
  if (!existing || existing.authorId !== authorId) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }
  if (!editableStatuses().includes(existing.approvalStatus)) {
    return { ok: false as const, code: "NOT_EDITABLE" as const };
  }

  if (patch.categoryId && patch.categoryId !== existing.categoryId) {
    const cat = await prisma.contentCategory.findUnique({
      where: { id: patch.categoryId },
    });
    if (!cat) {
      return { ok: false as const, code: "CATEGORY_NOT_FOUND" as const };
    }
  }

  try {
    const post = await prisma.contentPost.update({
      where: { id: postId },
      data: {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.coverImageUrl !== undefined
          ? { coverImageUrl: patch.coverImageUrl }
          : {}),
        ...(patch.categoryId !== undefined
          ? { categoryId: patch.categoryId }
          : {}),
      },
      include: postPublicInclude,
    });
    return { ok: true as const, post };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false as const, code: "SLUG_TAKEN" as const };
    }
    throw e;
  }
}

export async function submitTutorialAsAuthor(authorId: string, postId: string) {
  const existing = await prisma.contentPost.findUnique({
    where: { id: postId },
  });
  if (!existing || existing.authorId !== authorId) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }

  const canSubmit =
    existing.approvalStatus === ContentApprovalStatus.DRAFT ||
    existing.approvalStatus === ContentApprovalStatus.REJECTED;

  if (!canSubmit) {
    return { ok: false as const, code: "INVALID_STATE" as const };
  }

  const post = await prisma.contentPost.update({
    where: { id: postId },
    data: {
      approvalStatus: ContentApprovalStatus.PENDING_REVIEW,
      rejectionReason: null,
    },
    include: postPublicInclude,
  });

  return { ok: true as const, post };
}

export async function listAllTutorialsForAdmin(params: {
  take: number;
  skip: number;
  categoryId?: string;
  approvalStatus?: ContentApprovalStatus;
  authorId?: string;
}) {
  const where: Prisma.ContentPostWhereInput = {
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.approvalStatus
      ? { approvalStatus: params.approvalStatus }
      : {}),
    ...(params.authorId ? { authorId: params.authorId } : {}),
  };

  const rows = await prisma.contentPost.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: params.take,
    skip: params.skip,
    include: postPublicInclude,
  });

  const total = await prisma.contentPost.count({ where });

  return { tutorials: rows, total };
}

export async function listTutorialsForDoctorAuthor(params: {
  authorId: string;
  take: number;
  skip: number;
  categoryId?: string;
  approvalStatus?: ContentApprovalStatus;
}) {
  const where: Prisma.ContentPostWhereInput = {
    authorId: params.authorId,
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    ...(params.approvalStatus
      ? { approvalStatus: params.approvalStatus }
      : {}),
  };

  const rows = await prisma.contentPost.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: params.take,
    skip: params.skip,
    include: postPublicInclude,
  });

  const total = await prisma.contentPost.count({ where });

  return { tutorials: rows, total };
}

export async function getTutorialForDoctorAuthor(authorId: string, postId: string) {
  return prisma.contentPost.findFirst({
    where: { id: postId, authorId },
    include: postPublicInclude,
  });
}

export async function approveTutorialAsAdmin(postId: string) {
  const existing = await prisma.contentPost.findUnique({
    where: { id: postId },
  });
  if (!existing) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }
  if (existing.approvalStatus !== ContentApprovalStatus.PENDING_REVIEW) {
    return { ok: false as const, code: "INVALID_STATE" as const };
  }

  const now = new Date();
  const post = await prisma.contentPost.update({
    where: { id: postId },
    data: {
      approvalStatus: ContentApprovalStatus.APPROVED,
      isPublished: true,
      publishedAt: existing.publishedAt ?? now,
      rejectionReason: null,
    },
    include: postPublicInclude,
  });

  return { ok: true as const, post };
}

export async function rejectTutorialAsAdmin(postId: string, reason: string) {
  const existing = await prisma.contentPost.findUnique({
    where: { id: postId },
  });
  if (!existing) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }
  if (existing.approvalStatus !== ContentApprovalStatus.PENDING_REVIEW) {
    return { ok: false as const, code: "INVALID_STATE" as const };
  }

  const post = await prisma.contentPost.update({
    where: { id: postId },
    data: {
      approvalStatus: ContentApprovalStatus.REJECTED,
      rejectionReason: reason,
      isPublished: false,
    },
    include: postPublicInclude,
  });

  return { ok: true as const, post };
}

export async function getContentPostForAdmin(id: string) {
  return prisma.contentPost.findUnique({
    where: { id },
    include: postPublicInclude,
  });
}

export async function listContentCategoriesForAdmin() {
  return prisma.contentCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { nameBn: "asc" }],
  });
}

export async function getContentCategoryForAdmin(id: string) {
  return prisma.contentCategory.findUnique({ where: { id } });
}

export async function createContentCategoryForAdmin(data: {
  nameBn: string;
  nameEn?: string | null;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  try {
    const category = await prisma.contentCategory.create({ data });
    return { ok: true as const, category };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false as const, code: "SLUG_TAKEN" as const };
    }
    throw e;
  }
}

export async function updateContentCategoryForAdmin(
  id: string,
  patch: Partial<{
    nameBn: string;
    nameEn: string | null;
    slug: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const existing = await prisma.contentCategory.findUnique({ where: { id } });
  if (!existing) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }

  try {
    const category = await prisma.contentCategory.update({
      where: { id },
      data: {
        ...(patch.nameBn !== undefined ? { nameBn: patch.nameBn } : {}),
        ...(patch.nameEn !== undefined ? { nameEn: patch.nameEn } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
    });
    return { ok: true as const, category };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false as const, code: "SLUG_TAKEN" as const };
    }
    throw e;
  }
}
