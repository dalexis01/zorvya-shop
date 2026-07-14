import "server-only";

import { randomUUID } from "node:crypto";

import type { FeaturedContent } from "@/lib/shop/admin-types";
import { getAdminRuntimePool } from "@/lib/server/admin/runtime-db";

async function readFeaturedContent() {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<{
    id: string;
    type: FeaturedContent["type"];
    product_ids_json: string[] | null;
    position: number;
    is_active: boolean;
    start_date: string;
    end_date: string | null;
    created_at: string;
    updated_at: string;
    updated_by: string;
  }>(
    `
      SELECT
        id,
        type,
        product_ids_json,
        position,
        is_active,
        start_date::text,
        end_date::text,
        created_at::text,
        updated_at::text,
        updated_by
      FROM admin_featured_content
      ORDER BY position ASC, created_at ASC
    `
  );

  return result.rows.map<FeaturedContent>((row) => ({
    id: row.id,
    type: row.type,
    productIds: Array.isArray(row.product_ids_json) ? row.product_ids_json : [],
    position: Number(row.position) || 0,
    isActive: Boolean(row.is_active),
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

async function writeFeaturedContent(content: FeaturedContent[]) {
  const pool = await getAdminRuntimePool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of content) {
      await client.query(
        `
          INSERT INTO admin_featured_content (
            id,
            type,
            product_ids_json,
            position,
            is_active,
            start_date,
            end_date,
            created_at,
            updated_at,
            updated_by
          ) VALUES (
            $1, $2, $3::jsonb, $4, $5, $6::timestamptz, $7::timestamptz,
            $8::timestamptz, $9::timestamptz, $10
          )
          ON CONFLICT (id) DO UPDATE SET
            type = EXCLUDED.type,
            product_ids_json = EXCLUDED.product_ids_json,
            position = EXCLUDED.position,
            is_active = EXCLUDED.is_active,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by
        `,
        [
          item.id,
          item.type,
          JSON.stringify(item.productIds ?? []),
          item.position,
          item.isActive,
          item.startDate,
          item.endDate ?? null,
          item.createdAt,
          item.updatedAt,
          item.updatedBy,
        ]
      );
    }

    const ids = content.map((item) => item.id);
    if (ids.length > 0) {
      await client.query(`DELETE FROM admin_featured_content WHERE NOT (id = ANY($1::text[]))`, [ids]);
    } else {
      await client.query(`DELETE FROM admin_featured_content`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
