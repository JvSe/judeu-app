import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@judeu/ui/components/button";

import { hasAdminSession } from "@/lib/admin-auth";

import { logoutAdmin } from "../actions";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAdminSession())) redirect("/admin/login");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <nav className="flex gap-4">
          <Link href="/admin" className="text-lg font-medium hover:underline">
            Prestadores
          </Link>
          <Link href="/admin/support" className="text-lg font-medium hover:underline">
            Chamados
          </Link>
        </nav>
        <form action={logoutAdmin}>
          <Button variant="outline" size="sm" type="submit">
            Sair
          </Button>
        </form>
      </div>
      {children}
    </div>
  );
}
