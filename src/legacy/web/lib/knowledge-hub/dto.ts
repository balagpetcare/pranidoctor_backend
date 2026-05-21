import {
  displayNameForTutorialAuthor,
  type ContentPostPublicPayload,
  type TutorialAuthorPublic,
} from "./service";

export function toTutorialPublicDto(post: ContentPostPublicPayload) {
  const author = post.author as TutorialAuthorPublic;
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    body: post.body,
    coverImageUrl: post.coverImageUrl,
    approvalStatus: post.approvalStatus,
    rejectionReason: post.rejectionReason,
    publishedAt: post.publishedAt,
    isPublished: post.isPublished,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    category: post.category,
    author: {
      userId: author.id,
      role: author.role,
      displayName: displayNameForTutorialAuthor(author),
    },
  };
}

export function toTutorialListItemDto(post: ContentPostPublicPayload) {
  const author = post.author as TutorialAuthorPublic;
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary,
    coverImageUrl: post.coverImageUrl,
    approvalStatus: post.approvalStatus,
    rejectionReason: post.rejectionReason,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    category: post.category,
    author: {
      userId: author.id,
      role: author.role,
      displayName: displayNameForTutorialAuthor(author),
    },
  };
}
