import type { Metadata } from "next";

import { getSharedTracking } from "@/lib/family";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acompanhamento — Ajuda+",
  robots: { index: false, follow: false },
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

// Página pública do modo família. Atualiza sozinha a cada 20 s.
export default async function SharedTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getSharedTracking((await params).token);

  if (!data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Link indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este acompanhamento terminou ou o link não é válido.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-10">
      <meta httpEquiv="refresh" content="20" />
      <p className="text-sm text-muted-foreground">Pedido de {data.clientFirstName}</p>
      <h1 className="text-2xl font-semibold">{data.statusLabel}</h1>
      <p className="text-sm">{data.task}</p>

      {data.providerFirstName && (
        <div className="flex items-center gap-3 rounded-xl border p-4">
          {data.providerAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.providerAvatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold">
              {data.providerFirstName[0]}
            </div>
          )}
          <div>
            <p className="font-medium">{data.providerFirstName}</p>
            <p className="text-sm text-muted-foreground">
              {data.etaMin != null ? `Chega em cerca de ${data.etaMin} min` : "Quem está ajudando"}
            </p>
          </div>
        </div>
      )}

      {data.providerPosition && (
        <a
          className="text-sm font-medium underline"
          href={`https://www.openstreetmap.org/?mlat=${data.providerPosition.lat}&mlon=${data.providerPosition.lng}#map=16/${data.providerPosition.lat}/${data.providerPosition.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver no mapa onde a pessoa está
        </a>
      )}

      <ol className="flex flex-col gap-2 border-l pl-4">
        {data.events.map((e, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{e.label}</span>{" "}
            <span className="text-muted-foreground">· {time(e.at)}</span>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        Esta página se atualiza sozinha. O link para de funcionar 24 horas depois do fim do pedido.
      </p>
    </main>
  );
}
