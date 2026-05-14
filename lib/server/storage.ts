import "server-only";

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const WINDOWS_FILE_LOCK_ERROR_CODES = new Set(["EPERM", "EBUSY", "EACCES", "EEXIST", "ENOTEMPTY"]);
const READ_ONLY_FILE_SYSTEM_ERROR_CODES = new Set(["EROFS", "EPERM", "EACCES"]);

type RuntimeDataStore = Map<string, string>;

declare global {
  var __zorvyaRuntimeDataStore__: RuntimeDataStore | undefined;
}

const runtimeDataStore =
  globalThis.__zorvyaRuntimeDataStore__ ?? (globalThis.__zorvyaRuntimeDataStore__ = new Map());

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

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

function isReadOnlyFileSystemError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  const code = String(error.code);
  return READ_ONLY_FILE_SYSTEM_ERROR_CODES.has(code);
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
  if (runtimeDataStore.has(fileName)) {
    return;
  }

  const filePath = getFilePath(fileName);

  if (isProductionRuntime()) {
    try {
      const contents = await readFile(filePath, "utf8");
      runtimeDataStore.set(fileName, contents);
    } catch {
      runtimeDataStore.set(fileName, JSON.stringify(fallback, null, 2));
    }
    return;
  }

  try {
    await mkdir(DATA_DIRECTORY, { recursive: true });
    await readFile(filePath, "utf8");
  } catch (error) {
    if (isReadOnlyFileSystemError(error)) {
      runtimeDataStore.set(fileName, JSON.stringify(fallback, null, 2));
      return;
    }

    await writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

export async function readDataFile<T>(fileName: string, fallback: T) {
  await ensureDataFile(fileName, fallback);

  const runtimeValue = runtimeDataStore.get(fileName);

  if (typeof runtimeValue === "string") {
    try {
      if (!runtimeValue.trim()) {
        return fallback;
      }

      return JSON.parse(runtimeValue) as T;
    } catch {
      return fallback;
    }
  }

  const filePath = getFilePath(fileName);

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
  const serializedValue = JSON.stringify(value, null, 2);
  runtimeDataStore.set(fileName, serializedValue);

  if (isProductionRuntime()) {
    return;
  }

  const filePath = getFilePath(fileName);
  const temporaryFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await mkdir(DATA_DIRECTORY, { recursive: true });
    await writeFile(temporaryFilePath, serializedValue, "utf8");
  } catch (error) {
    if (isReadOnlyFileSystemError(error)) {
      return;
    }

    throw error;
  }

  try {
    await renameWithRetries(temporaryFilePath, filePath);
    return;
  } catch (error) {
    if (isReadOnlyFileSystemError(error)) {
      await rm(temporaryFilePath, { force: true });
      return;
    }

    if (!isWindowsLockError(error)) {
      await rm(temporaryFilePath, { force: true });
      throw error;
    }
  }

  try {
    await copyFile(temporaryFilePath, filePath);
  } catch (error) {
    if (isReadOnlyFileSystemError(error)) {
      return;
    }

    await writeFile(filePath, serializedValue, "utf8");
  } finally {
    await rm(temporaryFilePath, { force: true });
  }
}
