import "server-only";

import { randomUUID } from "node:crypto";
import { readDataFile, writeDataFile } from "../storage";

import type { StatusLog, StatusChange } from "@/lib/shop/admin-types";

const LOGS_FILE = "admin-logs.json";

async function readLogs() {
  return readDataFile<StatusLog[]>(LOGS_FILE, []);
}

async function writeLogs(logs: StatusLog[]) {
  await writeDataFile(LOGS_FILE, logs);
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

  const logs = await readLogs();
  logs.push(log);
  await writeLogs(logs);

  return log;
}

export async function getLogsForTarget(
  targetId: string,
  type?: "order" | "product" | "user" | "content"
) {
  const logs = await readLogs();
  return logs
    .filter(
      (log) =>
        log.targetId === targetId && (!type || log.type === type)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLogsByUser(changedBy: string) {
  const logs = await readLogs();
  return logs
    .filter((log) => log.changedBy === changedBy)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getLogsForType(type: "order" | "product" | "user" | "content") {
  const logs = await readLogs();
  return logs
    .filter((log) => log.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getRecentLogs(limit: number = 50) {
  const logs = await readLogs();
  return logs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
