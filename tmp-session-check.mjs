import { loadEnvironment } from "./src/shared/config/load-env.js";

loadEnvironment();

const { loadConfig } = await import("./src/shared/config/index.js");
const { createPrismaClient, getPrisma } = await import("./src/shared/database/prisma.js");

createPrismaClient({ config: loadConfig() });
const prisma = getPrisma();

if (!process.env.PD_CHECK_EMAIL || !process.env.PD_CHECK_PASSWORD) {
  console.error("Set PD_CHECK_EMAIL and PD_CHECK_PASSWORD (test admin, never commit them).");
  process.exit(1);
}

const loginRes = await fetch("http://localhost:3000/api/admin/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: process.env.PD_CHECK_EMAIL,
    password: process.env.PD_CHECK_PASSWORD,
  }),
});
const token = loginRes.headers.getSetCookie()[0].split(";")[0].split("=").slice(1).join("=");
const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const sid = payload.sid;

const row = await prisma.userSession.findUnique({ where: { id: sid } });
console.log("sid", sid, "row", row ? { status: row.status, userId: row.userId, expires: row.expiresAt } : null);
