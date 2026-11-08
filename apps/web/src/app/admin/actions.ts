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
import { cancelShift, createShift } from "@/lib/anchors-admin";
import { createCoupon, findUserIdByEmail, grantCredit, setCouponActive } from "@/lib/discounts";
import { createZone, deleteZone, updateZone } from "@/lib/zones-db";
import { brasiliaToUtc, parseClock, parsePolygonInput } from "@/lib/zones";
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

export async function createAnchorShift(formData: FormData): Promise<void> {
  await requireAdminSession();
  const fail = (msg: string) => redirect(`/admin/anchors?error=${encodeURIComponent(msg)}`);
  const providerId = String(formData.get("providerId") ?? "");
  const date = String(formData.get("date") ?? "");
  const start = parseClock(String(formData.get("start") ?? ""));
  const end = parseClock(String(formData.get("end") ?? ""));
  const floor = Math.round(Number(String(formData.get("floor") ?? "").replace(",", ".")) * 100);
  if (!providerId) fail("Escolha quem atende.");
  if (start == null || end == null || start === end) fail("Horário inválido (use HH:MM).");
  if (!Number.isFinite(floor) || floor < 0) fail("Piso inválido.");
  const startsAt = brasiliaToUtc(date, start!);
  // Fim antes do início = termina no dia seguinte.
  const endsAt = brasiliaToUtc(date, end! <= start! ? end! + 1440 : end!);
  if (!startsAt || !endsAt) fail("Data inválida.");
  await createShift({ providerId, startsAt: startsAt!, endsAt: endsAt!, hourlyFloorCents: floor });
  revalidatePath("/admin/anchors");
  redirect("/admin/anchors");
}

export async function cancelAnchorShift(shiftId: string): Promise<void> {
  await requireAdminSession();
  await cancelShift(shiftId);
  revalidatePath("/admin/anchors");
}

/** "10,50" → 1050; vazio → null; inválido → NaN. */
function reaisToCents(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return Math.round(Number(text.replace(",", ".")) * 100);
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text ? Number(text) : null;
}

export async function createDiscountCoupon(formData: FormData): Promise<void> {
  await requireAdminSession();
  const fail = (msg: string) => redirect(`/admin/coupons?error=${encodeURIComponent(msg)}`);
  const code = String(formData.get("code") ?? "").trim();
  const kind = formData.get("kind") === "FIXED" ? "FIXED" : "PERCENT";
  const rawValue = String(formData.get("value") ?? "").trim();
  const value = kind === "FIXED" ? reaisToCents(rawValue) : Number(rawValue);
  const maxDiscountCents = reaisToCents(formData.get("maxDiscount"));
  const minPriceCents = reaisToCents(formData.get("minPrice"));
  const maxRedemptions = optionalInt(formData.get("maxRedemptions"));
  const perUserLimit = optionalInt(formData.get("perUserLimit")) ?? 1;
  const expiresOn = String(formData.get("expiresOn") ?? "").trim();
  const expiresAt = expiresOn ? brasiliaToUtc(expiresOn, 1440) : null;

  if (!/^[A-Za-z0-9_-]{3,40}$/.test(code)) fail("Código: 3 a 40 letras, números, - ou _.");
  if (value == null || !Number.isInteger(value) || value <= 0) fail("Valor do desconto inválido.");
  if (kind === "PERCENT" && value! > 100) fail("Percentual vai de 1 a 100.");
  for (const n of [maxDiscountCents, minPriceCents, maxRedemptions]) {
    if (n != null && (!Number.isFinite(n) || n <= 0)) fail("Teto, mínimo e usos precisam ser positivos.");
  }
  if (!Number.isInteger(perUserLimit) || perUserLimit < 1) fail("Usos por pessoa: pelo menos 1.");
  if (expiresOn && !expiresAt) fail("Data de vencimento inválida.");

  try {
    await createCoupon({
      code,
      kind,
      value: value!,
      maxDiscountCents,
      minPriceCents,
      maxRedemptions,
      perUserLimit,
      firstOrderOnly: formData.get("firstOrderOnly") === "on",
      startsAt: null,
      expiresAt,
    });
  } catch (err) {
    fail(err instanceof Error ? err.message : "Falha ao criar o cupom.");
  }
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function toggleCoupon(couponId: string, active: boolean): Promise<void> {
  await requireAdminSession();
  await setCouponActive(couponId, active);
  revalidatePath("/admin/coupons");
}

export async function grantClientCredit(formData: FormData): Promise<void> {
  await requireAdminSession();
  const fail = (msg: string) => redirect(`/admin/coupons?error=${encodeURIComponent(msg)}`);
  const email = String(formData.get("email") ?? "");
  const amount = reaisToCents(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim() || "Cortesia";
  if (amount == null || !Number.isFinite(amount) || amount <= 0) fail("Valor inválido.");
  const userId = await findUserIdByEmail(email);
  if (!userId) fail("Nenhum usuário com esse e-mail.");
  await grantCredit(userId!, amount!, reason);
  revalidatePath("/admin/coupons");
  redirect(`/admin/coupons?ok=${encodeURIComponent("Crédito concedido.")}`);
}
