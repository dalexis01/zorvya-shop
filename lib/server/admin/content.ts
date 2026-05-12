import "server-only";

import { randomUUID } from "node:crypto";
import { readDataFile, writeDataFile } from "../storage";

import type { FeaturedContent } from "@/lib/shop/admin-types";

const FEATURED_FILE = "content-featured.json";

async function readFeaturedContent() {
  return readDataFile<FeaturedContent[]>(FEATURED_FILE, []);
}

async function writeFeaturedContent(content: FeaturedContent[]) {
  await writeDataFile(FEATURED_FILE, content);
}

export async function getFeaturedContent(type?: "featured" | "top" | "banner") {
  let content = await readFeaturedContent();

  if (type) {
    content = content.filter((c) => c.type === type);
  }

  return content
    .filter((c) => c.isActive)
    .sort((a, b) => a.position - b.position);
}

export async function getFeaturedContentById(id: string) {
  const content = await readFeaturedContent();
  return content.find((c) => c.id === id) ?? null;
}

export async function createFeaturedContent(
  input: {
    type: "featured" | "top" | "banner";
    productIds: string[];
    position: number;
    startDate: string;
    endDate?: string;
  },
  createdBy: string
) {
  const now = new Date().toISOString();
  const content: FeaturedContent = {
    id: randomUUID(),
    type: input.type,
    productIds: input.productIds,
    position: input.position,
    isActive: true,
    startDate: input.startDate,
    endDate: input.endDate,
    createdAt: now,
    updatedAt: now,
    updatedBy: createdBy,
  };

  const allContent = await readFeaturedContent();
  allContent.push(content);
  await writeFeaturedContent(allContent);

  return content;
}

export async function updateFeaturedContent(
  id: string,
  updates: Partial<Omit<FeaturedContent, "id" | "createdAt" | "updatedAt" | "updatedBy">>,
  updatedBy: string
) {
  const allContent = await readFeaturedContent();
  const content = allContent.find((c) => c.id === id);

  if (!content) {
    throw new Error("CONTENT_NOT_FOUND");
  }

  const updated: FeaturedContent = {
    ...content,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  const updated_content = allContent.map((c) => (c.id === id ? updated : c));
  await writeFeaturedContent(updated_content);

  return updated;
}

export async function deleteFeaturedContent(id: string) {
  const allContent = await readFeaturedContent();
  const filtered = allContent.filter((c) => c.id !== id);
  await writeFeaturedContent(filtered);
}

export async function toggleFeaturedContentStatus(id: string, updatedBy: string) {
  const content = await getFeaturedContentById(id);
  if (!content) throw new Error("CONTENT_NOT_FOUND");

  return updateFeaturedContent(id, { isActive: !content.isActive }, updatedBy);
}

export async function reorderFeaturedContent(
  ids: string[],
  type: "featured" | "top" | "banner",
  updatedBy: string
) {
  const allContent = await readFeaturedContent();

  const updated = allContent.map((c) => {
    if (c.type === type) {
      const newPosition = ids.indexOf(c.id);
      if (newPosition >= 0) {
        return { ...c, position: newPosition, updatedAt: new Date().toISOString(), updatedBy };
      }
    }
    return c;
  });

  await writeFeaturedContent(updated);
  return updated.filter((c) => c.type === type).sort((a, b) => a.position - b.position);
}

export async function getFeaturedProductIds(type: "featured" | "top" | "banner") {
  const content = await getFeaturedContent(type);
  return content.flatMap((c) => c.productIds);
}
