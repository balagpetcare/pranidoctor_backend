import bcrypt from "bcryptjs";

import { Prisma, UserRole, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { CRED_MSG } from "./customer-credentials-messages";
import { normalizeBdMobilePhone } from "./phone";

const INTERNAL_REGISTER_DOMAIN = "@mobile-register.pranidoctor.internal";

export type CredentialFailure = {
  ok: false;
  httpStatus: number;
  code: string;
  message: string;
};

export type CredentialSuccess = { ok: true; userId: string };

function syntheticRegisterEmail(normalizedPhone880: string): string {
  return `${normalizedPhone880.replace(/\+/g, "")}${INTERNAL_REGISTER_DOMAIN}`;
}

function isReservedInternalEmail(email: string): boolean {
  const e = email.toLowerCase();
  return (
    e.endsWith("@mobile-otp.pranidoctor.internal") ||
    e.endsWith(INTERNAL_REGISTER_DOMAIN)
  );
}

export async function registerCustomerWithPassword(params: {
  name: string;
  rawMobile: string;
  rawEmail: string | null | undefined;
  password: string;
}): Promise<CredentialSuccess | CredentialFailure> {
  const name = params.name.trim();
  if (name.length < 1) {
    return {
      ok: false,
      httpStatus: 422,
      code: "VALIDATION_ERROR",
      message: CRED_MSG.validationName,
    };
  }

  const normalizedPhone = normalizeBdMobilePhone(params.rawMobile);
  if (!normalizedPhone) {
    return {
      ok: false,
      httpStatus: 422,
      code: "VALIDATION_ERROR",
      message: CRED_MSG.validationPhone,
    };
  }

  if (params.password.length < 6) {
    return {
      ok: false,
      httpStatus: 422,
      code: "VALIDATION_ERROR",
      message: CRED_MSG.validationPassword,
    };
  }

  let emailToStore: string;
  const trimmedEmail = params.rawEmail?.trim() ?? "";
  if (trimmedEmail.length > 0) {
    const lower = trimmedEmail.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) {
      return {
        ok: false,
        httpStatus: 422,
        code: "VALIDATION_ERROR",
        message: CRED_MSG.validationEmail,
      };
    }
    if (isReservedInternalEmail(lower)) {
      return {
        ok: false,
        httpStatus: 422,
        code: "VALIDATION_ERROR",
        message: CRED_MSG.validationEmail,
      };
    }
    emailToStore = lower;
  } else {
    emailToStore = syntheticRegisterEmail(normalizedPhone);
  }

  const existingPhone = await prisma.user.findFirst({
    where: { phone: normalizedPhone },
    select: { id: true },
  });
  if (existingPhone) {
    return {
      ok: false,
      httpStatus: 409,
      code: "DUPLICATE_PHONE",
      message: CRED_MSG.duplicatePhone,
    };
  }

  const existingEmail = await prisma.user.findFirst({
    where: { email: emailToStore },
    select: { id: true },
  });
  if (existingEmail) {
    return {
      ok: false,
      httpStatus: 409,
      code: "DUPLICATE_EMAIL",
      message: CRED_MSG.duplicateEmail,
    };
  }

  const passwordHash = await bcrypt.hash(params.password, 10);

  try {
    const created = await prisma.user.create({
      data: {
        email: emailToStore,
        phone: normalizedPhone,
        passwordHash,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
        customerProfile: {
          create: {
            displayName: name,
          },
        },
      },
    });
    return { ok: true, userId: created.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = e.meta?.target;
      const tStr = Array.isArray(target)
        ? target.join(" ")
        : String(target ?? "");
      if (tStr.includes("phone")) {
        return {
          ok: false,
          httpStatus: 409,
          code: "DUPLICATE_PHONE",
          message: CRED_MSG.duplicatePhone,
        };
      }
      if (tStr.includes("email")) {
        return {
          ok: false,
          httpStatus: 409,
          code: "DUPLICATE_EMAIL",
          message: CRED_MSG.duplicateEmail,
        };
      }
    }
    console.error("[mobile-auth] register failed", e);
    return {
      ok: false,
      httpStatus: 500,
      code: "SIGNUP_FAILED",
      message: CRED_MSG.signupFailed,
    };
  }
}

export async function loginCustomerWithPassword(params: {
  rawIdentifier: string;
  password: string;
}): Promise<CredentialSuccess | CredentialFailure> {
  const idRaw = params.rawIdentifier.trim();
  if (!idRaw || params.password.length < 1) {
    return {
      ok: false,
      httpStatus: 422,
      code: "VALIDATION_ERROR",
      message: CRED_MSG.wrongIdentifierOrPassword,
    };
  }

  let user = null as Awaited<
    ReturnType<
      typeof prisma.user.findFirst<{ include: { customerProfile: true } }>
    >
  >;

  if (idRaw.includes("@")) {
    const email = idRaw.toLowerCase();
    user = await prisma.user.findFirst({
      where: { email },
      include: { customerProfile: true },
    });
  } else {
    const normalizedPhone = normalizeBdMobilePhone(idRaw);
    if (!normalizedPhone) {
      return {
        ok: false,
        httpStatus: 401,
        code: "INVALID_CREDENTIALS",
        message: CRED_MSG.wrongIdentifierOrPassword,
      };
    }
    user = await prisma.user.findFirst({
      where: { phone: normalizedPhone },
      include: { customerProfile: true },
    });
  }

  if (
    !user ||
    user.role !== UserRole.CUSTOMER ||
    user.status !== UserStatus.ACTIVE ||
    !user.customerProfile
  ) {
    return {
      ok: false,
      httpStatus: 401,
      code: "INVALID_CREDENTIALS",
      message: CRED_MSG.wrongIdentifierOrPassword,
    };
  }

  const ok = await bcrypt.compare(params.password, user.passwordHash);
  if (!ok) {
    return {
      ok: false,
      httpStatus: 401,
      code: "INVALID_CREDENTIALS",
      message: CRED_MSG.wrongIdentifierOrPassword,
    };
  }

  return { ok: true, userId: user.id };
}

export function serializeAuthUser(user: {
  id: string;
  email: string;
  phone: string | null;
  customerProfile: { displayName: string };
}): {
  id: string;
  name: string;
  mobile: string;
  email: string | null;
  role: "CUSTOMER";
} {
  const e = user.email.toLowerCase();
  const hideEmail =
    e.endsWith("@mobile-otp.pranidoctor.internal") ||
    e.endsWith(INTERNAL_REGISTER_DOMAIN);
  return {
    id: user.id,
    name: user.customerProfile.displayName,
    mobile: user.phone ?? "",
    email: hideEmail ? null : user.email,
    role: "CUSTOMER",
  };
}
