# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy Maestro**: stawia Metro na dedykowanej
bazie e2e, synchronizuje migracje+seedy per faza, a fail asercji wchodzi w pętlę fix jako
finding P2 typ E2E. Bez setupu nic się nie psuje — flow E2E są klasyfikowane jako OPERATOR
(status quo).

## Architektura

```
Bootstrap:    env-up    — .env.e2e? gitignore? Metro (detached, env z .env.e2e),
                          simulator + dev client. Fail = log, run idzie dalej (nie gate).
Per faza:     db-sync   — supabase db push na bazę e2e (PIERWSZY realny apply SQL migracji
                          w pipeline!) + seedy .maestro/*-seed.sql + konto testowe.
Review/fix:   tester E2E i fix odpalają Maestro na gotowym środowisku.
Zakończenie:  env-down  — ubija TYLKO Metro z naszego .pid; STOP zostawia środowisko
                          do ręcznego debugowania.
```

## Kroki (raz na maszynę/projekt)

1. **Utwórz dedykowany projekt Supabase** (np. `<projekt>-e2e`). Nigdy nie podawaj tu
   refów dev/prod — env-up ma guard tożsamości (URL e2e ≠ URL z `.env`), ale nie kuś losu.
2. **Skopiuj config**: `cp .claude/templates/e2e-env/.env.e2e.example .env.e2e` i uzupełnij
   (API keys, connection string direct, konto testowe email+hasło).
3. **Gitignore**: dopisz `.env.e2e` do `.gitignore` (env-up odmówi startu bez tego).
4. **Dev client na simulatorze** (najdłuższy krok, ~10+ min, potem cache):
   `bunx expo run:ios` — buduje i instaluje na domyślnym simulatorze. Odświeżaj tylko po
   zmianie natywnych zależności.
5. **Maestro CLI**: `curl -Ls https://get.maestro.mobile.dev | bash` (jeśli brak).
6. Gotowe — następny run autopilota wykryje `.env.e2e` i przejdzie w tryb zarządzany.

## Konwencje dla planów zadań

- Flow Maestro: `.maestro/<nazwa>.yaml`; seedy: `.maestro/<nazwa>-seed.sql` —
  db-sync wiąże seed z flow po nazwie. Pisz seedy **idempotentnie**.
- Logowanie w flow wyłącznie kontem `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (OAuth Google
  jest nietestowalny w Maestro).

## Pułapki

- **Metro „zastane"**: jeśli masz już ręcznie odpalone `bun start` (env dev!), autopilot go
  użyje i ostrzeże w logu — flow mogą gadać z bazą dev. Ubij własny Metro przed runem.
- **Reset danych**: db-sync nie robi `db reset` — czyszczenie zostawione seedom
  (idempotencja). Gdy baza e2e „zgnije", zresetuj ręcznie: `supabase db reset --db-url ...`.
- Haptyki i fizyczne gesty simulator nie symuluje — to zostaje na checklistach Operatora.
