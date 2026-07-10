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
