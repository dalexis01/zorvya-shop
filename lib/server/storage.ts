import "server-only";

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const WINDOWS_FILE_LOCK_ERROR_CODES = new Set(["EPERM", "EBUSY", "EACCES", "EEXIST", "ENOTEMPTY"]);

function getFilePath(fileName: string) {
  return path.join(DATA_DIRECTORY, fileName);
}

function isWindowsLockError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return WINDOWS_FILE_LOCK_ERROR_CODES.has(code);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function renameWithRetries(sourcePath: string, destinationPath: string) {
  let lastError: unknown;

  for (const delay of [0, 40, 120, 240, 400]) {
    if (delay > 0) {
      await sleep(delay);
    }

    try {
      await rename(sourcePath, destinationPath);
      return;
    } catch (error) {
      lastError = error;

      if (!isWindowsLockError(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function ensureDataFile<T>(fileName: string, fallback: T) {
  const filePath = getFilePath(fileName);

  await mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

export async function readDataFile<T>(fileName: string, fallback: T) {
  const filePath = getFilePath(fileName);

  await ensureDataFile(fileName, fallback);

  try {
    const fileContents = await readFile(filePath, "utf8");
    if (!fileContents.trim()) {
      return fallback;
    }

    return JSON.parse(fileContents) as T;
  } catch {
    return fallback;
  }
}

export async function writeDataFile<T>(fileName: string, value: T) {
  const filePath = getFilePath(fileName);
  const serializedValue = JSON.stringify(value, null, 2);
  const temporaryFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(temporaryFilePath, serializedValue, "utf8");

  try {
    await renameWithRetries(temporaryFilePath, filePath);
    return;
  } catch (error) {
    if (!isWindowsLockError(error)) {
      await rm(temporaryFilePath, { force: true });
      throw error;
    }
  }

  try {
    await copyFile(temporaryFilePath, filePath);
  } catch {
    await writeFile(filePath, serializedValue, "utf8");
  } finally {
    await rm(temporaryFilePath, { force: true });
  }
}
