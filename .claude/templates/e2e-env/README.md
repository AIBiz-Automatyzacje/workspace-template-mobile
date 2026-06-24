# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy Maestro**: stawia Metro na dedykowanej
bazie e2e, synchronizuje migracje+seedy per faza, a fail asercji wchodzi w pętlę fix jako
finding P2 typ E2E.

**Bramka opt-in (od 2026-06-16):**
- **Brak `.env.e2e`** → projekt nie chce E2E → flow klasyfikowane jako OPERATOR, run leci dalej (status quo).
- **`.env.e2e` istnieje, ale środowisko niegotowe** (np. brak dev-clienta na simulatorze) → autopilot
  **TWARDO zatrzymuje run w bootstrapie** z gotową komendą naprawczą. Powód: gdy projekt opt-in'ował
  się w E2E, ciche pominięcie = E2E znika z runu bez śladu (regresja etap-11). Świadomy run headless:
  usuń/zmień nazwę `.env.e2e`.

## Architektura

```
Bootstrap:    env-up    — .env.e2e? gitignore? Metro (detached, env z .env.e2e),
                          simulator + dev client. .env.e2e jest, a env niegotowe = HARD STOP
                          (gate opt-in); brak .env.e2e = pominieto, run leci dalej.
Per faza:     db-sync   — supabase db push na bazę e2e (PIERWSZY realny apply SQL migracji
                          w pipeline!) + seedy .maestro/*-seed.sql + konto testowe.
Review/fix:   tester E2E i fix odpalają Maestro na gotowym środowisku.
Zakończenie:  env-down  — ubija TYLKO Metro z naszego .pid; STOP zostawia środowisko
                          do ręcznego debugowania.
```

## Szybki start — gotowy prompt dla asystenta

Zamiast wykonywać kroki ręcznie, wklej asystentowi w sesji projektu (zastąp `<projekt>`):

```markdown
Zrób one-time setup środowiska E2E wg .claude/templates/e2e-env/README.md:

1. Utwórz dedykowany projekt Supabase "<projekt>-e2e" (przez Supabase MCP
   jeśli dostępny, inaczej daj mi link i poprowadź przez dashboard — free tier).
   To MUSI być NOWY projekt — nigdy ref istniejącej bazy dev/prod.
2. Zbierz: URL, anon key, service_role key, connection string (direct).
3. Utwórz `.env.e2e` w korzeniu repo wg .claude/templates/e2e-env/.env.e2e.example,
   wygeneruj silne hasło dla konta testowego (e2e@<projekt>.test).
4. Dopisz `.env.e2e` do .gitignore i ZWERYFIKUJ: `git check-ignore .env.e2e`.
5. Sprawdź maestro CLI (`maestro --version`), zainstaluj jeśli brak.
6. Dev client: sprawdź czy simulator ma zainstalowaną apkę (bundle id z app.json,
   `xcrun simctl listapps booted`). Brak → `bunx expo run:ios` (długi build, w tle).
7. Na koniec smoke: curl do URL projektu e2e + `supabase db push --db-url ...`
   na pustą bazę (zaaplikuje WSZYSTKIE migracje od zera — to też test, czy
   łańcuch migracji jest kompletny!) i pokaż mi raport co działa, a co wymaga
   mojej ręki.

Sekretów nie loguj i nie commituj. Po wszystkim NIE odpalaj autopilota — czekaj na mnie.
```

Krok 1 może wymagać ręcznego kliknięcia w dashboardzie (uprawnienia tokena MCP);
resztę asystent zrobi sam. Pierwszy run autopilota z `.env.e2e` traktuj jako test
bojowy tej fazy.

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
- **Dev sign-in czyta konto z `EXPO_PUBLIC_E2E_TEST_USER_*`** — jeśli flow loguje się przez
  ekran dev/E2E (nie pełny formularz), te zmienne muszą wskazywać konto e2e. Przy swapie
  `.env.local`→e2e ustaw je razem z `EXPO_PUBLIC_SUPABASE_URL` (inaczej login celuje w złe konto).
- **Re-seed per flow** (izolacja stanu): każdy flow zaczyna od czystego, znanego stanu —
  seed idempotentny aplikuj przed KAŻDYM flow, nie raz na całą fazę. Łap świeże `TOURNAMENT_UUID`
  z `RAISE NOTICE` seeda i przekaż do inject przez `env:` w YAML.

## Pułapki

- **Metro „zastane"**: jeśli masz już ręcznie odpalone `bun start` (env dev!), autopilot go
  użyje i ostrzeże w logu — flow mogą gadać z bazą dev. Ubij własny Metro przed runem.
- **Reset danych**: db-sync nie robi `db reset` — czyszczenie zostawione seedom
  (idempotencja). Gdy baza e2e „zgnije", zresetuj ręcznie: `supabase db reset --db-url ...`.
- Haptyki i fizyczne gesty simulator nie symuluje — to zostaje na checklistach Operatora.
- **Connection string „direct" jest IPv6-only** — w sieci bez IPv6 psql/db push wiszą na
  timeout. Używaj session poolera (IPv4, port 5432, wspiera migracje) — wzór w `.env.e2e.example`.
  (Lekcja z setupu gramywpadla 2026-06-12.)
- **Stary Supabase CLI potrafi mieć zepsute tworzenie projektu** (np. 2.67.1 — wybór regionu);
  przy dziwnych błędach najpierw `brew upgrade supabase`.
- **Seedy muszą wstawiać WSZYSTKO, czego flow potrzebuje** — świeża baza e2e nie ma danych
  „oczywistych" z dev (np. słownikowych wstawianych kiedyś ręcznie). Migracje ≠ dane.
