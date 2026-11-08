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
import { markReportReviewed, setUserBlocked } from "@/lib/moderation";
import { createZone, deleteZone, updateZone } from "@/lib/zones-db";
import { parseClock, parsePolygonInput } from "@/lib/zones";
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

export async function updateUserBlocked(userId: string, blocked: boolean): Promise<void> {
  await requireAdminSession();
  await setUserBlocked(userId, blocked, blocked ? "Suspenso pelo suporte após denúncia" : null);
  revalidatePath("/admin/reports");
}

export async function reviewReport(reportId: string): Promise<void> {
  await requireAdminSession();
  await markReportReviewed(reportId);
  revalidatePath("/admin/reports");
}

export async function createServiceZone(formData: FormData): Promise<void> {
  await requireAdminSession();
  const name = String(formData.get("name") ?? "").trim();
  const polygon = parsePolygonInput(String(formData.get("polygon") ?? ""));
  const openMinute = parseClock(String(formData.get("open") ?? ""));
  const closeMinute = parseClock(String(formData.get("close") ?? ""));
  const weekdays = formData
    .getAll("weekday")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const fail = (msg: string) => redirect(`/admin/zones?error=${encodeURIComponent(msg)}`);
  if (!name) fail("Dê um nome à zona.");
  if (!polygon) fail("Polígono inválido: precisa de pelo menos 3 pontos.");
  if (openMinute == null || closeMinute == null || openMinute >= 1440 || closeMinute === 0) {
    fail("Horário inválido (use HH:MM).");
  }
  if (openMinute === closeMinute) fail("Abertura e fechamento não podem ser iguais.");
  if (weekdays.length === 0) fail("Escolha pelo menos um dia.");
  await createZone({ name, polygon: polygon!, weekdays, openMinute: openMinute!, closeMinute: closeMinute! });
  revalidatePath("/admin/zones");
  redirect("/admin/zones");
}

export async function toggleServiceZone(zoneId: string, active: boolean): Promise<void> {
  await requireAdminSession();
  await updateZone(zoneId, { active });
  revalidatePath("/admin/zones");
}

export async function removeServiceZone(zoneId: string): Promise<void> {
  await requireAdminSession();
  await deleteZone(zoneId);
  revalidatePath("/admin/zones");
}
