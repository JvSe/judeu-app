# Material do QA de 2026-11-03 (3 personas)

Esta pasta é a cópia persistente do scratchpad da sessão. Onde o `BRIEF.md` fala em `$QA`, leia **esta pasta**.

- `BRIEF.md` — briefing comum dos agentes (regras, helpers, API, lições do Maestro).
- `db.mjs` — acesso direto ao banco de dev (supabase-js + service role). `node db.mjs q <tabela> '{filtro}' 'cols'`.
- `api.sh` — curl com token. `./api.sh GET /api/auth/me '' "$TOKEN"`.
- `seed-veterans.mjs` — seed das contas VETERANAS da rodada 2 (ainda NÃO executado). `node seed-veterans.mjs` com o backend no ar.
- `cleanup.mjs` — apaga tudo com prefixo `qa-20261103-` (`--dry` / `--yes`).
- `report-r1-prestador.md`, `report-r1-helper.md` — relatórios das personas (rodada 1). O do cliente não foi escrito (sessão encerrada); evidências dele estão em `mailbox/S*-cliente.json` e `maestro/shots/cliente-*.png`.
- `mailbox/` — handoffs entre agentes (um JSON por passo de cenário).
- `maestro/*.yaml` — flows de UI; `maestro/shots/` — screenshots (fora do git, 35 MB).
- `backend.log` / `baseline.log` — log do Next.js durante os testes e saída de `pnpm check-types`/`pnpm test`.
- Arquivos `*.json`/`*.txt` na raiz desta pasta são saídas brutas dos agentes (contêm tokens de contas de teste) e ficam fora do git.

Relatório consolidado: `../relatorio-qa-3-perfis-2026-11-03.md`.
