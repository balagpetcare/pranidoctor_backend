import { Hind_Siliguri, Inter } from "next/font/google";

/**
 * Inter (Latin UI) + Hind Siliguri (Bengali-first). Variables are consumed by
 * `src/app/admin/admin-typography.css` and `admin-shell.css` under `#pd-admin-root`.
 */
export const adminFontInter = Inter({
  subsets: ["latin"],
  variable: "--font-pd-admin-inter",
  display: "swap",
});

export const adminFontHindSiliguri = Hind_Siliguri({
  subsets: ["latin", "bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pd-admin-hind",
  display: "swap",
});

export const adminDashboardFontVariablesClassName = `${adminFontInter.variable} ${adminFontHindSiliguri.variable}`.trim();
