import { z } from "zod";

// Formato de usuário exposto ao app (nunca inclui passwordHash).
export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
};

export function publicUser(u: {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
    emailVerified: u.emailVerified,
    phoneVerified: u.phoneVerified,
    createdAt: u.createdAt.toISOString(),
  };
}

export const roleSchema = z.enum(["CLIENT", "PROVIDER", "BOTH"]);
