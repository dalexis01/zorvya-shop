import "server-only";

import { randomUUID } from "node:crypto";

import { readDataFile, writeDataFile } from "@/lib/server/storage";
import { generateProductAiDraft } from "@/lib/server/admin/ai-helpers";
import type { ProductAiDraft } from "@/lib/shop/admin-types";

const AI_DRAFTS_FILE = "content-ai-drafts.json";

function trimText(value: string | undefined) {
  return (value ?? "").trim();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSku(name: string, brand: string, category: string) {
  const brandPrefix = slugify(brand).slice(0, 3).toUpperCase() || "ZRV";
  const categoryPrefix = slugify(category).slice(0, 3).toUpperCase() || "CAT";
  const namePrefix = slugify(name).slice(0, 4).toUpperCase() || "ITEM";
  return `${brandPrefix}-${categoryPrefix}-${namePrefix}`;
}

function buildInternalCode(name: string, category: string) {
  const categoryPrefix = slugify(category).slice(0, 4).toUpperCase() || "PROD";
  const namePrefix = slugify(name).slice(0, 5).toUpperCase() || "ITEM";
  return `INT-${categoryPrefix}-${namePrefix}`;
}

function normalizeDraft(draft: ProductAiDraft): ProductAiDraft {
  const suggestedName = trimText(draft.suggestedName) || trimText(draft.approvedName);
  const approvedName = trimText(draft.approvedName) || suggestedName;
  const suggestedCategory = trimText(draft.suggestedCategory) || trimText(draft.approvedCategory);
  const approvedCategory = trimText(draft.approvedCategory) || suggestedCategory;
  const brandHint = trimText(draft.brandHint);
  const suggestedSku =
    trimText(draft.suggestedSku) || buildSku(suggestedName, brandHint, suggestedCategory);
  const approvedSku =
    trimText(draft.approvedSku) || buildSku(approvedName, brandHint, approvedCategory);
  const suggestedInternalCode =
    trimText(draft.suggestedInternalCode) || buildInternalCode(suggestedName, suggestedCategory);
  const approvedInternalCode =
    trimText(draft.approvedInternalCode) || buildInternalCode(approvedName, approvedCategory);

  return {
    ...draft,
    suggestedName,
    approvedName,
    suggestedCategory,
    approvedCategory,
    suggestedSku,
    approvedSku,
    suggestedInternalCode,
    approvedInternalCode,
  };
}

async function readAiDrafts() {
  const drafts = await readDataFile<ProductAiDraft[]>(AI_DRAFTS_FILE, []);
  return drafts.map(normalizeDraft);
}

async function writeAiDrafts(drafts: ProductAiDraft[]) {
  await writeDataFile(AI_DRAFTS_FILE, drafts.map(normalizeDraft));
}

export async function getAllProductAiDrafts() {
  const drafts = await readAiDrafts();

  return drafts.sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

export async function getProductAiDraftById(draftId: string) {
  const drafts = await readAiDrafts();
  return drafts.find((draft) => draft.id === draftId) ?? null;
}

export async function createProductAiDraft(input: {
  sourceImageUrl: string;
  nameHint?: string;
  brandHint?: string;
  categoryHint?: string;
}) {
  const suggestion = await generateProductAiDraft(input);
  const now = new Date().toISOString();

  const draft: ProductAiDraft = {
    id: `AID-${randomUUID().slice(0, 8).toUpperCase()}`,
    linkedProductId: null,
    createdAt: now,
    updatedAt: now,
    ...suggestion,
  };

  const drafts = await readAiDrafts();
  drafts.push(draft);
  await writeAiDrafts(drafts);

  return draft;
}

export async function updateProductAiDraft(
  draftId: string,
  updates: {
    approvedName?: string;
    approvedShortDescription?: string;
    approvedLongDescription?: string;
    approvedCategory?: string;
    approvedTags?: string[];
    approvedImageIds?: string[];
  }
) {
  const drafts = await readAiDrafts();
  const draft = drafts.find((item) => item.id === draftId);

  if (!draft) {
    throw new Error("AI_DRAFT_NOT_FOUND");
  }

  const updatedDraft: ProductAiDraft = {
    ...draft,
    approvedName: updates.approvedName?.trim() || draft.approvedName,
    approvedShortDescription:
      updates.approvedShortDescription?.trim() || draft.approvedShortDescription,
    approvedLongDescription:
      updates.approvedLongDescription?.trim() || draft.approvedLongDescription,
    approvedCategory: updates.approvedCategory?.trim() || draft.approvedCategory,
    approvedTags: updates.approvedTags?.length ? updates.approvedTags : draft.approvedTags,
    approvedImageIds: updates.approvedImageIds?.length
      ? updates.approvedImageIds
      : draft.approvedImageIds,
    updatedAt: new Date().toISOString(),
  };

  await writeAiDrafts(drafts.map((item) => (item.id === draftId ? updatedDraft : item)));

  return updatedDraft;
}

export async function linkProductAiDraft(draftId: string, productId: string) {
  const drafts = await readAiDrafts();

  await writeAiDrafts(
    drafts.map((draft) => {
      if (draft.id !== draftId) {
        return draft;
      }

      return {
        ...draft,
        linkedProductId: productId,
        updatedAt: new Date().toISOString(),
      };
    })
  );
}
