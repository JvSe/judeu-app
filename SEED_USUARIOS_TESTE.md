# Usuários de teste (seed)

Gerados após a limpeza do banco (tabelas renomeadas para minúsculas via `@@map`). Nenhuma interação (pedido, mensagem, avaliação, pagamento) foi criada entre eles — só cadastro + perfil.

**Senha de todas as contas:** `Demo@12345`

| # | Nome | E-mail | Papel | Perfil |
|---|------|--------|-------|--------|
| 1 | Beatriz Andrade | beatriz.andrade@teste.app | CLIENT | Cliente |
| 2 | Anderson Ferreira | anderson.ferreira@teste.app | PROVIDER | Eletricista |
| 3 | Camila Rocha | camila.rocha@teste.app | PROVIDER | Diarista |
| 4 | Thiago Batista | thiago.batista@teste.app | PROVIDER | Encanador |
| 5 | Larissa Martins | larissa.martins@teste.app | PROVIDER | Cabeleireira |
| 6 | Eduardo Pires | eduardo.pires@teste.app | PROVIDER | Motorista de frete |
| 7 | Vanessa Duarte | vanessa.duarte@teste.app | PROVIDER | Esteticista |
| 8 | Rodrigo Almeida | rodrigo.almeida@teste.app | PROVIDER | Pintor |
| 9 | Sandra Teixeira | sandra.teixeira@teste.app | PROVIDER | Passadeira |
| 10 | Construtora Horizonte Ltda | contato@construtorahorizonte.teste.app | PROVIDER | Empresa — contratando (`isCompany`/`hiringEmployees` = true) |
| 11 | CleanPro Serviços de Limpeza Ltda | contato@cleanpro.teste.app | PROVIDER | Empresa — contratando (`isCompany`/`hiringEmployees` = true) |

## Observações

- Todos os prestadores já estão com `status = APPROVED` e `isAvailable = true`, então aparecem no catálogo do cliente.
- `documentUrl` foi preenchido com um caminho fake (`<userId>/kyc.jpg`) só pra simular "KYC enviado" — não existe arquivo real no Supabase Storage.
- Dados de teste (dev), não usar em produção.
