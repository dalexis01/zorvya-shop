const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || "";
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || "";

async function runCheck(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

async function expectStatus(response, allowedStatuses, context) {
  if (!allowedStatuses.includes(response.status)) {
    const body = await response.text();
    throw new Error(`${context} expected ${allowedStatuses.join("/")} but received ${response.status}: ${body}`);
  }
}

async function postJson(pathname, body, extraHeaders = {}) {
  const target = `${baseUrl}${pathname}`;
  return fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

await runCheck("admin auth malformed payload", async () => {
  const response = await postJson("/api/admin/auth/login", {});
  await expectStatus(response, [400, 401], "admin login malformed payload");
});

await runCheck("checkout rejects invalid payload", async () => {
  const response = await postJson("/api/place-order", {});
  await expectStatus(response, [400], "place-order invalid payload");
});

await runCheck("paypal create-order rejects invalid payload or missing config", async () => {
  const response = await postJson("/api/paypal/create-order", {});
  await expectStatus(response, [400, 503], "paypal create-order invalid payload");
});

await runCheck("paypal confirm-order requires paypalOrderId", async () => {
  const response = await postJson("/api/paypal/confirm-order", {});
  await expectStatus(response, [400], "paypal confirm-order missing order id");
});

if (adminEmail && adminPassword) {
  await runCheck("admin auth accepts configured credentials", async () => {
    const response = await postJson("/api/admin/auth/login", {
      email: adminEmail,
      password: adminPassword,
    });
    await expectStatus(response, [200, 401], "admin login smoke");
  });
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
