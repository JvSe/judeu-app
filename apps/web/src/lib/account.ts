import { randomUUID } from "node:crypto";

import { hashPassword, revokeAllRefreshTokens } from "./auth";
import { supabase } from "./db";

export async function deleteAccount(userId: string): Promise<void> {
  const { data: provider } = await supabase
    .from("providerprofile")
    .select("id")
    .eq("userId", userId)
    .maybeSingle();

  const { error } = await supabase.rpc("soft_delete_account", {
    p_user_id: userId,
    p_email: `deleted-${randomUUID()}@ajuda.app`,
    p_password_hash: await hashPassword(randomUUID()),
    p_has_provider: !!provider,
  });
  if (error) throw new Error(`delete account: ${error.message}`);

  await revokeAllRefreshTokens(userId);
}

export async function exportAccountData(userId: string) {
  const { data: user, error } = await supabase
    .from("user")
    .select(
      `
      id, email, fullName, phone, role, createdAt, termsAcceptedAt, notifyOrders, notifyMessages,
      addresses:address(*),
      ordersAsClient:order!order_clientId_fkey(*, events:orderevent(*)),
      reviewsAuthored:review!review_authorId_fkey(*),
      reviewsReceived:review!review_targetId_fkey(*),
      messages:message(*),
      wallet:wallet(*, transactions:wallettransaction(*)),
      notifications:notification(*),
      providerProfile:providerprofile(
        *,
        services:service(*),
        categories:providercategory(*),
        ordersAsProvider:order!order_providerId_fkey(*, events:orderevent(*))
      )
    `,
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`export account: ${error.message}`);
  return user;
}
