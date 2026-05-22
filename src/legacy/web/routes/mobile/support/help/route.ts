import { jsonError, jsonOk } from "@/lib/api-response";
import { getSupportHelp } from "@/lib/mobile-support/support-service";

export async function GET() {
  try {
    const help = await getSupportHelp();
    return jsonOk(help);
  } catch {
    return jsonError("INTERNAL", "Could not load help content", 500);
  }
}
