import { supabase } from "./db";
import { uploadAvatar } from "./storage";
import { publicUser, type PublicUser } from "./user";

export type UpdateProfileInput = { fullName?: string; phone?: string; gender?: "F" | "M" | "OTHER" | null };

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<PublicUser> {
  const { data: user, error } = await supabase
    .from("user")
    .update({ ...input, updatedAt: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !user) throw new Error(error?.message ?? "Usuário não encontrado");
  return publicUser(user);
}

export async function updateAvatar(
  userId: string,
  base64: string,
  mimeType: string,
): Promise<PublicUser> {
  const avatarUrl = await uploadAvatar(userId, base64, mimeType);
  const { data: user, error } = await supabase
    .from("user")
    .update({ avatarUrl, updatedAt: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !user) throw new Error(error?.message ?? "Usuário não encontrado");
  return publicUser(user);
}

export type ClientStatsDTO = {
  completedOrders: number;
  cancelledOrders: number;
  totalOrders: number;
  ratingAvg: number | null;
  ratingCount: number;
};

export async function getClientStats(userId: string): Promise<ClientStatsDTO> {
  const map = await batchClientStats([userId]);
  return (
    map.get(userId) ?? {
      completedOrders: 0,
      cancelledOrders: 0,
      totalOrders: 0,
      ratingAvg: null,
      ratingCount: 0,
    }
  );
}

/** Agrega nota e pedidos para vários clientes (ex.: pool de ajudas). */
export async function batchClientStats(
  clientIds: string[],
): Promise<Map<string, ClientStatsDTO>> {
  const unique = [...new Set(clientIds.filter(Boolean))];
  const empty = new Map<string, ClientStatsDTO>();
  for (const id of unique) {
    empty.set(id, {
      completedOrders: 0,
      cancelledOrders: 0,
      totalOrders: 0,
      ratingAvg: null,
      ratingCount: 0,
    });
  }
  if (unique.length === 0) return empty;

  const [{ data: orderRows }, { data: reviews }] = await Promise.all([
    supabase.from("order").select("clientId, status").in("clientId", unique),
    supabase.from("review").select("targetId, rating").in("targetId", unique),
  ]);

  const completedByClient = new Map<string, number>();
  const cancelledByClient = new Map<string, number>();
  const totalByClient = new Map<string, number>();
  for (const row of orderRows ?? []) {
    const id = row.clientId as string;
    totalByClient.set(id, (totalByClient.get(id) ?? 0) + 1);
    if (row.status === "COMPLETED") {
      completedByClient.set(id, (completedByClient.get(id) ?? 0) + 1);
    } else if (row.status === "CANCELLED") {
      cancelledByClient.set(id, (cancelledByClient.get(id) ?? 0) + 1);
    }
  }

  const ratingsByClient = new Map<string, number[]>();
  for (const row of reviews ?? []) {
    const id = row.targetId as string;
    const list = ratingsByClient.get(id) ?? [];
    list.push(row.rating as number);
    ratingsByClient.set(id, list);
  }

  for (const id of unique) {
    const ratings = ratingsByClient.get(id) ?? [];
    const ratingCount = ratings.length;
    empty.set(id, {
      completedOrders: completedByClient.get(id) ?? 0,
      cancelledOrders: cancelledByClient.get(id) ?? 0,
      totalOrders: totalByClient.get(id) ?? 0,
      ratingAvg: ratingCount === 0 ? null : ratings.reduce((a, b) => a + b, 0) / ratingCount,
      ratingCount,
    });
  }
  return empty;
}
