import "server-only";

import { randomUUID } from "node:crypto";

import type { StatusChange, StatusLog } from "@/lib/shop/admin-types";
import { getAdminRuntimePool } from "@/lib/server/admin/runtime-db";

type StatusLogRow = {
  id: string;
  type: StatusLog["type"];
  target_id: string;
  action: StatusLog["action"];
  changed_by: string;
  changed_by_name: string;
  changes_json: StatusChange[] | null;
  created_at: string;
};

function mapStatusLogRow(row: StatusLogRow): StatusLog {
  return {
    id: row.id,
    type: row.type,
    targetId: row.target_id,
    action: row.action,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    changes: Array.isArray(row.changes_json) ? row.changes_json : [],
    createdAt: row.created_at,
  };
}

async function queryLogs(sql: string, values: unknown[] = []) {
  const pool = await getAdminRuntimePool();
  const result = await pool.query<StatusLogRow>(sql, values);
  return result.rows.map(mapStatusLogRow);
}

export async function createStatusLog(input: {
  type: "order" | "product" | "user" | "content";
  targetId: string;
  action: "created" | "updated" | "deleted" | "status_changed";
  changedBy: string;
  changedByName: string;
  changes: StatusChange[];
}) {
  const log: StatusLog = {
    id: randomUUID(),
    type: input.type,
    targetId: input.targetId,
    action: input.action,
    changedBy: input.changedBy,
    changedByName: input.changedByName,
    changes: input.changes,
    createdAt: new Date().toISOString(),
  };

  const pool = await getAdminRuntimePool();
  await pool.query(
    `
      INSERT INTO admin_status_logs (
        id,
        type,
        target_id,
        action,
        changed_by,
        changed_by_name,
        changes_json,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz
      )
    `,
    [
      log.id,
      log.type,
      log.targetId,
      log.action,
      log.changedBy,
      log.changedByName,
      JSON.stringify(log.changes),
      log.createdAt,
    ]
  );

  return log;
}

export async function getLogsForTarget(
  targetId: string,
  type?: "order" | "product" | "user" | "content"
) {
  if (type) {
    return queryLogs(
      `
        SELECT
          id,
          type,
          target_id,
          action,
          changed_by,
          changed_by_name,
          changes_json,
          created_at::text
        FROM admin_status_logs
        WHERE target_id = $1 AND type = $2
        ORDER BY created_at DESC
      `,
      [targetId, type]
    );
  }

  return queryLogs(
    `
      SELECT
        id,
        type,
        target_id,
        action,
        changed_by,
        changed_by_name,
        changes_json,
        created_at::text
      FROM admin_status_logs
      WHERE target_id = $1
      ORDER BY created_at DESC
    `,
    [targetId]
  );
}

export async function getLogsByUser(changedBy: string) {
  return queryLogs(
    `
      SELECT
        id,
        type,
        target_id,
        action,
        changed_by,
        changed_by_name,
        changes_json,
        created_at::text
      FROM admin_status_logs
      WHERE changed_by = $1
      ORDER BY created_at DESC
    `,
    [changedBy]
  );
}

export async function getLogsForType(type: "order" | "product" | "user" | "content") {
  return queryLogs(
    `
      SELECT
        id,
        type,
        target_id,
        action,
        changed_by,
        changed_by_name,
        changes_json,
        created_at::text
      FROM admin_status_logs
      WHERE type = $1
      ORDER BY created_at DESC
    `,
    [type]
  );
}

export async function getRecentLogs(limit: number = 50) {
  return queryLogs(
    `
      SELECT
        id,
        type,
        target_id,
        action,
        changed_by,
        changed_by_name,
        changes_json,
        created_at::text
      FROM admin_status_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
}
