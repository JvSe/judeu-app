"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  ADMIN_COOKIE,
  checkAdminPassword,
  isAdminPasswordConfigured,
  requireAdminSession,
  signAdminSession,
} from "@/lib/admin-auth";
import { setProviderProfileStatus } from "@/lib/provider-profile";
import type { BadgeType, RiskLevel } from "@/lib/risk";
import { setCategoryRisk, setProviderBadge } from "@/lib/risk-admin";
import { markSupportTicketInProgress, respondToSupportTicket as respondTicket } from "@/lib/support";

export async function loginAdmin(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!isAdminPasswordConfigured() || !checkAdminPassword(password)) {
    redirect("/admin/login?error=1");
  }

  const token = await signAdminSession();
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

export async function updateProviderStatus(
  providerId: string,
  status: "PENDING" | "APPROVED" | "BLOCKED",
): Promise<void> {
  await requireAdminSession();
  await setProviderProfileStatus(providerId, status);
  revalidatePath("/admin");
}

export async function respondToSupportTicket(ticketId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const response = String(formData.get("response") ?? "").trim();
  if (!response) return;
  await respondTicket(ticketId, response);
  revalidatePath("/admin/support");
}

export async function claimSupportTicket(ticketId: string): Promise<void> {
  await requireAdminSession();
  await markSupportTicketInProgress(ticketId);
  revalidatePath("/admin/support");
}

export async function updateProviderBadge(
  providerId: string,
  type: BadgeType,
  granted: boolean,
): Promise<void> {
  await requireAdminSession();
  await setProviderBadge(providerId, type, granted);
  revalidatePath("/admin");
}

export async function updateCategoryRisk(categoryId: string, formData: FormData): Promise<void> {
  await requireAdminSession();
  const level = Number(formData.get("riskLevel"));
  if (![1, 2, 3, 4].includes(level)) return;
  await setCategoryRisk(categoryId, level as RiskLevel);
  revalidatePath("/admin/categories");
}
