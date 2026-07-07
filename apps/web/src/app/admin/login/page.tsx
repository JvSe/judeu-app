import { Button } from "@judeu/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@judeu/ui/components/card";
import { Input } from "@judeu/ui/components/input";
import { Label } from "@judeu/ui/components/label";

import { loginAdmin } from "../actions";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="container mx-auto flex max-w-sm flex-col justify-center px-4 py-24">
      <Card>
        <CardHeader>
          <CardTitle>Painel admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={loginAdmin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required autoFocus />
            </div>
            {error && (
              <p className="text-xs text-destructive">
                Senha incorreta (ou ADMIN_PASSWORD não configurada no servidor).
              </p>
            )}
            <Button type="submit">Entrar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
