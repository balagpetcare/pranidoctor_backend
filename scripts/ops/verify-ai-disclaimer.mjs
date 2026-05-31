#!/usr/bin/env node
/**
 * Smoke test: Admin AI Disclaimer GET/PUT via web BFF.
 * Usage: node scripts/ops/verify-ai-disclaimer.mjs [webOrigin]
 */
const webOrigin = process.argv[2] ?? "http://localhost:3001";
const email = process.env.ADMIN_EMAIL ?? "admin@pranidoctor.com";
const password = process.env.ADMIN_PASSWORD ?? "12345678";

async function main() {
  const jar = {};
  const cookieHeader = () =>
    Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

  function storeCookies(res) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const single = res.headers.get("set-cookie");
    if (single && raw.length === 0) {
      for (const line of single.split(/,(?=\s*\w+=)/)) {
        const [pair] = line.trim().split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) jar[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }

  const login = await fetch(`${webOrigin}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  storeCookies(login);
  if (!login.ok) {
    console.error("LOGIN FAIL", login.status, await login.text());
    process.exit(1);
  }

  const get1 = await fetch(`${webOrigin}/api/admin/settings/ai-disclaimer`, {
    headers: { cookie: cookieHeader() },
  });
  const getText = await get1.text();
  let getJson;
  try {
    getJson = JSON.parse(getText);
  } catch {
    console.error("GET parse fail", get1.status, getText.slice(0, 200));
    process.exit(1);
  }
  if (!get1.ok || !getJson.ok || !getJson.data) {
    console.error("GET FAIL", get1.status, getText);
    process.exit(1);
  }
  const original = getJson.data;
  console.log("GET ok", {
    contentVersion: original.contentVersion,
    consentVersion: original.consentVersion,
    enforceAcceptance: original.enforceAcceptance,
    updatedAt: original.updatedAt,
  });

  const bumped = `${original.consentVersion}-verify-${Date.now()}`;
  const putBody = {
    contentVersion: original.contentVersion,
    enforceAcceptance: true,
    consentVersion: bumped,
    consentTitle: original.consentTitle,
    consentContent: original.consentContent,
    banner: original.banner,
    contextual: original.contextual,
  };
  const put = await fetch(`${webOrigin}/api/admin/settings/ai-disclaimer`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify(putBody),
  });
  const putText = await put.text();
  let putJson;
  try {
    putJson = JSON.parse(putText);
  } catch {
    console.error("PUT parse fail", put.status, putText.slice(0, 200));
    process.exit(1);
  }
  if (!put.ok || !putJson.ok) {
    console.error("PUT FAIL", put.status, putText);
    process.exit(1);
  }
  console.log("PUT ok", {
    consentVersion: putJson.data.consentVersion,
    enforceAcceptance: putJson.data.enforceAcceptance,
    updatedAt: putJson.data.updatedAt,
  });

  const get2 = await fetch(`${webOrigin}/api/admin/settings/ai-disclaimer`, {
    headers: { cookie: cookieHeader() },
  });
  const reload = await get2.json();
  if (!get2.ok || reload.data?.consentVersion !== bumped) {
    console.error("RELOAD FAIL", get2.status, reload);
    process.exit(1);
  }
  console.log("RELOAD ok", { consentVersion: reload.data.consentVersion });

  const restore = await fetch(`${webOrigin}/api/admin/settings/ai-disclaimer`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: cookieHeader() },
    body: JSON.stringify({
      ...putBody,
      consentVersion: original.consentVersion,
      enforceAcceptance: original.enforceAcceptance,
    }),
  });
  const restoreJson = await restore.json();
  if (!restore.ok || restoreJson.data?.consentVersion !== original.consentVersion) {
    console.error("RESTORE FAIL", restore.status, restoreJson);
    process.exit(1);
  }
  console.log("RESTORE ok");
  console.log("ALL PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
