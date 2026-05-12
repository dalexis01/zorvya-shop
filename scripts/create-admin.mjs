import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIRECTORY = path.join(process.cwd(), "data");
const ADMIN_USERS_FILE = path.join(DATA_DIRECTORY, "admin-users.json");
const KEY_LENGTH = 64;

const [emailArg, passwordArg, nameArg, roleArg] = process.argv.slice(2);

const input = {
  email: emailArg ?? "admin@sorvya.local",
  password: passwordArg ?? "admin4466",
  name: nameArg ?? "Admin Principal",
  role: roleArg ?? "admin",
  createdBy: "system",
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

function getDefaultPermissions(role) {
  switch (role) {
    case "admin":
      return [
        "products.create",
        "products.read",
        "products.update",
        "products.delete",
        "orders.read",
        "orders.update",
        "orders.delete",
        "support.read",
        "support.respond",
        "users.read",
        "users.update",
        "content.update",
        "admin.manage_staff",
      ];
    case "worker":
      return [
        "products.create",
        "products.read",
        "products.update",
        "orders.read",
        "orders.update",
        "support.read",
        "support.respond",
        "users.read",
      ];
    case "support_agent":
      return ["support.read", "support.respond", "users.read", "orders.read"];
    default:
      throw new Error("INVALID_ROLE");
  }
}

async function ensureDataFile(filePath, fallback) {
  await mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, JSON.stringify(fallback, null, 2), "utf8");
  }
}

async function readJsonFile(filePath, fallback) {
  await ensureDataFile(filePath, fallback);

  try {
    const fileContents = await readFile(filePath, "utf8");

    if (!fileContents.trim()) {
      return fallback;
    }

    return JSON.parse(fileContents);
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath, value) {
  const temporaryFilePath = `${filePath}.tmp`;

  await mkdir(DATA_DIRECTORY, { recursive: true });
  await writeFile(temporaryFilePath, JSON.stringify(value, null, 2), "utf8");
  await rename(temporaryFilePath, filePath);
}

async function main() {
  const role = input.role.trim();
  const permissions = getDefaultPermissions(role);
  const users = await readJsonFile(ADMIN_USERS_FILE, []);
  const email = normalizeEmail(input.email);

  const existingUser = users.find((user) => user.email === email);
  if (existingUser) {
    console.error(`Admin user already exists for ${email}`);
    process.exitCode = 1;
    return;
  }

  const now = new Date().toISOString();
  const newUser = {
    id: randomUUID(),
    email,
    passwordHash: hashPassword(input.password),
    name: input.name.trim(),
    role,
    permissions,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    createdBy: input.createdBy,
  };

  users.push(newUser);
  await writeJsonFile(ADMIN_USERS_FILE, users);

  console.log("Admin user created successfully");
  console.log(
    JSON.stringify(
      {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      null,
      2
    )
  );
  console.log(`Login email: ${input.email}`);
  console.log(`Login password: ${input.password}`);
}

main().catch((error) => {
  console.error("Failed to create admin user");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
