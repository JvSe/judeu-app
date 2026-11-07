// Preferências de quem pede ajuda (pitch: "nota ≥ 4,8, mais de 50 tarefas,
// só mulheres"). Sem preferência, ninguém é filtrado — comportamento atual.

export type OrderPreferences = {
  minRating?: number | null;
  minCompleted?: number | null;
  gender?: "F" | "M" | null;
};

export type PreferenceProfile = {
  ratingAvg?: number | null;
  ratingCount?: number | null;
  completedCount?: number | null;
  gender?: string | null;
};

export function hasPreferences(p: OrderPreferences | null | undefined): boolean {
  return !!p && (p.minRating != null || p.minCompleted != null || p.gender != null);
}

export function meetsPreferences(profile: PreferenceProfile, prefs: OrderPreferences | null | undefined): boolean {
  if (!hasPreferences(prefs)) return true;
  if (prefs!.minRating != null) {
    // Sem nenhuma avaliação não dá para provar a nota mínima.
    if (!profile.ratingCount || (profile.ratingAvg ?? 0) < prefs!.minRating) return false;
  }
  if (prefs!.minCompleted != null && (profile.completedCount ?? 0) < prefs!.minCompleted) return false;
  if (prefs!.gender != null && profile.gender !== prefs!.gender) return false;
  return true;
}

export const PREFERENCES_DENIED = "Este pedido tem preferências de quem atende que o seu perfil não atende.";
