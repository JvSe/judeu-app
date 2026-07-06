# apps/geo — Serviços de geolocalização (self-hosted na Railway)

Dois serviços OSM/gratuitos que alimentam o fluxo de pedido do Ajuda+:

| Serviço | Papel | Porta | Imagem base |
|---|---|---|---|
| **valhalla** | Rotas + distância/ETA (traça a rota no mapa) | 8002 | `ghcr.io/nilsnolde/docker-valhalla/valhalla` |
| **nominatim** | Geocoding (endereço → coordenadas) | 8080 | `mediagis/nominatim:4.4` |

São diretórios **só de Docker** (sem `package.json`), então o pnpm/turbo os ignoram — não afetam o monorepo. Cada um vira **um serviço separado na Railway**, apontando o *Root Directory* para a subpasta.

**Região inicial:** Palmas/TO. Usamos o PBF do estado do **Tocantins** (pequeno, inclui a capital):
`https://download.openstreetmap.fr/extracts/south-america/brazil/tocantins-latest.osm.pbf`
Para expandir a cobertura depois, basta trocar essa URL nas variáveis da Railway (sem mudar código).

---

## Deploy na Railway (uma vez por serviço)

Para **cada** serviço (`valhalla` e `nominatim`):

1. **New Service → Deploy from GitHub repo** (este repositório).
2. Em **Settings → Source → Root Directory**, aponte para a subpasta:
   - Valhalla: `apps/geo/valhalla`
   - Nominatim: `apps/geo/nominatim`
   (O `railway.json` de cada pasta já define o build via Dockerfile.)
3. **Settings → Networking → Generate Domain** e defina a **Target Port**:
   - Valhalla: **8002**
   - Nominatim: **8080**
4. **Adicione um Volume** (Settings → Volumes) montado em:
   - Valhalla: `/custom_files`  ← persiste os tiles construídos
   - Nominatim: `/var/lib/postgresql/14/main`  ← persiste o Postgres importado
   > Sem o Volume, o serviço **reconstrói/reimporta tudo a cada deploy**. Dê um tamanho folgado (ex.: 10 GB p/ Tocantins).
5. **Variables** (Settings → Variables):

   **Valhalla**
   ```
   tile_urls=https://download.openstreetmap.fr/extracts/south-america/brazil/tocantins-latest.osm.pbf
   ```

   **Nominatim**
   ```
   PBF_URL=https://download.openstreetmap.fr/extracts/south-america/brazil/tocantins-latest.osm.pbf
   NOMINATIM_PASSWORD=<gere-uma-senha-forte>
   ```
6. **Deploy.** O **primeiro boot é longo** (baixa o PBF e constrói tiles / importa o banco) — para o Tocantins, alguns minutos. **Não redeploy no meio do import.** Por isso não há healthcheck curto configurado (evita reinício em loop durante a carga).

Depois que ambos estiverem "Active", copie os domínios públicos gerados para `apps/web/.env`:
```
VALHALLA_URL=https://<seu-valhalla>.up.railway.app
NOMINATIM_URL=https://<seu-nominatim>.up.railway.app
```
(Essas variáveis já são validadas em `packages/env/src/server.ts` e consumidas por `apps/web/src/lib/geo.ts`.)

---

## Smoke tests (após o deploy)

Rota (Valhalla) — dois pontos em Palmas:
```bash
curl -s "$VALHALLA_URL/route" \
  -d '{"locations":[{"lat":-10.184,"lon":-48.333},{"lat":-10.240,"lon":-48.324}],"costing":"auto"}' \
  | head -c 400
# → deve retornar um objeto "trip" com "legs"/"summary" (distância + tempo)
```

Geocoding (Nominatim) — endereço em Palmas:
```bash
curl -s "$NOMINATIM_URL/search?format=jsonv2&countrycodes=br&q=Quadra+104+Norte,+Palmas" | head -c 400
# → deve retornar uma lista com "lat"/"lon"
```

---

## Notas

- **Imagem do Valhalla:** o repo `nilsnolde/docker-valhalla` está **arquivado** (o código foi para o repo oficial do Valhalla), mas a imagem `ghcr.io/...:latest` continua funcional e é a mais prática por baixar/construir os tiles via `tile_urls` no boot. Para fixar uma versão, troque `:latest` por uma tag específica.
- **Custo/recursos:** Tocantins é leve. Ao expandir para regiões maiores (ou Brasil inteiro), o Nominatim exige bem mais RAM/disco no import — reveja o plano da Railway antes.
- **Atualização de mapa:** para reimportar dados novos, troque o PBF (ou force rebuild) e faça um deploy manual; com o Volume, o build normal reaproveita o que já existe.
- **Teste local (opcional, requer Docker):** `docker build -t ajuda-valhalla apps/geo/valhalla` e `docker run --rm -e tile_urls=<pbf-pequeno-monaco> -p 8002:8002 -v $PWD/_valhalla:/custom_files ajuda-valhalla` (idem Nominatim com um PBF de Monaco para validar rápido).
