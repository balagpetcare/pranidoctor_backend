import { jsonError, jsonOk } from "@/lib/api-response";
import { resolveAdminPanelActor } from "@/lib/admin-auth/panel-access";
import { getAdminSession } from "@/lib/admin-auth/session";
import { getOtpDevLogSnapshotForAdmin } from "@/lib/mobile-auth/otp-dev-log";
import {
  getOtpConfig,
  isOtpDebugPanelAllowed,
} from "@/lib/mobile-auth/otp-env";

export async function GET() {
  if (!isOtpDebugPanelAllowed()) {
    return jsonError(
      "FORBIDDEN",
      "এই ডিবাগ টুল শুধু ডেভ/স্টেজিং বা OTP_DEBUG_PANEL_ENABLED চালু থাকলে ব্যবহার করা যায়।",
      403,
    );
  }

  const session = await getAdminSession();
  if (!session) {
    return jsonError("UNAUTHORIZED", "Not signed in", 401);
  }

  const actor = await resolveAdminPanelActor(session);
  if (!actor) {
    return jsonError("FORBIDDEN", "Admin panel access required", 403);
  }

  const cfg = getOtpConfig();
  return jsonOk({
    otpMode: cfg.mode,
    entries: getOtpDevLogSnapshotForAdmin(),
  });
}
