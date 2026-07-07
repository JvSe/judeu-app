import { redirect } from "next/navigation";

import { Button } from "@judeu/ui/components/button";

import { hasAdminSession } from "@/lib/admin-auth";

import { logoutAdmin } from "../actions";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasAdminSession())) redirect("/admin/login");

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-medium">Moderação de prestadores</h1>
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
