# Środowisko E2E dla dev-autopilot (one-time setup Operatora)

Po tym setupie autopilot **autonomicznie wykonuje testy Maestro**: stawia Metro na dedykowanej
bazie e2e, synchronizuje migracje+seedy per faza, a fail asercji wchodzi w pętlę fix jako
finding P2 typ E2E.

**Bramka opt-in (od 2026-06-16, wzmocniona 2026-07-13):**
- **Brak `.env.e2e`** → projekt nie chce E2E → flow klasyfikowane jako OPERATOR, run leci dalej (status quo).
  Sygnał opt-in czyta osobny, tani **precheck** (samo `test -f .env.e2e`), oddzielony od ciężkiego env-up.
- **`.env.e2e` istnieje, ale środowisko niegotowe LUB canary nie przechodzi** → autopilot
  **TWARDO zatrzymuje run w bootstrapie** z gotową komendą naprawczą. Powód: gdy projekt opt-in'ował
  się w E2E, ciche pominięcie = E2E znika z runu bez śladu (regresja etap-11). Świadomy run headless:
  usuń/zmień nazwę `.env.e2e`.
- **env-up padł (null) przy potwierdzonym opt-in** → retry raz, drugi null = **STOP** (nie cicha degradacja
  do OPERATOR — to infra hiccup, nie brak setupu).

## Architektura

```
Bootstrap:    precheck  — test -f .env.e2e? (tani sygnał opt-in, oddzielony od env-up)
              env-up    — gitignore + komplet kluczy + guard tożsamości (e2e ≠ dev);
                          AUTO-SWAP .env.local → e2e (backup .env.local.bak, dev-client
                          inline'uje env z pliku, nie z shella!); preflight Maestro+Java 17;
                          Metro (deterministyczny restart --clear obcego/po-swapie);
                          emulator iOS (fallback Android) + dev client (5d: świeżość binarki vs
                          package.json/Podfile.lock/app.json; 5e: entitlements przez codesign);
                          CANARY = login konta e2e (REST) + przejście apki przez logowanie do ekranu
                          ZA auth (.maestro/_canary.yaml; fallback launch-only gdy brak pliku) = DOWÓD,
                          że flow ruszy. „gotowe" ZABRONIONE bez canary PASS. Niegotowe = HARD STOP.
Per faza:     natywne    — nowa zależność z kodem natywnym w package.json (git diff po execute)
                          => dev-client jest już nieaktualny => STOP z komendą rebuildu, PRZED review.
              warmup    — rozgrzewka cache vitest (PO bramce E2E — tani gate first).
Per faza:     db-sync   — supabase db push na bazę e2e (PIERWSZY realny apply SQL migracji
                          w pipeline!) + seedy .maestro/*-seed.sql + konto testowe.
Review/fix:   tester E2E i fix odpalają Maestro na gotowym środowisku.
Zakończenie:  env-down  — ubija TYLKO Metro z naszego .pid + COFA SWAP (przywraca .env.local
                          z .bak, assert że wrócił dev). STOP zostawia środowisko do debugu;
                          swap przetrwały po STOP jest bezpieczny (następny env-up wykryje
                          „swap zastany" i cofnie na końcu).
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
3. **Gitignore**: dopisz `.env.e2e` ORAZ `.env.local.bak` do `.gitignore` (env-up odmówi startu bez
   obu wpisów — backup swapu zawiera sekrety dev, a nieignorowany blokowałby kolejny run na bramce
   czystości brancha). Flow canary żyje w `/tmp` — nie zostawia śladu w repo.
4. **Dev client na emulatorze** (najdłuższy krok, ~10+ min, potem cache):
   `bunx expo run:ios` (lub `bunx expo run:android`) — buduje i instaluje na emulatorze. Odświeżaj
   tylko po zmianie natywnych zależności. Zostaw emulator **BOOTED** — canary env-up go użyje.
   Świeżość binarki pilnuje env-up (krok 5d: mtime `.app` vs `package.json`/`Podfile.lock`/`app.json`)
   i sprawdza entitlements (5e) — przestarzały lub niepodpisany dev-client = STOP z komendą rebuildu.
4b. **Canary flow** (zalecane, mocno podnosi wartość bramki): `cp .claude/templates/e2e-env/_canary.yaml
   .maestro/_canary.yaml` i dopasuj `appId` oraz testID do swojej apki. Bez tego pliku env-up spada do
   canary launch-only, który **nie wykryje** braku entitlements ani natywnego modułu ładowanego za
   logowaniem — czyli dokładnie tych awarii, które kosztowały ~3h w runie feedback-marcin-poprawki.
5. **Maestro CLI + Java 17**: `curl -fsSL https://get.maestro.mobile.dev | bash` (jeśli brak);
   Maestro 2.0+ wymaga **Java 17+** (`JAVA_HOME`). env-up sprawdza oba w preflight i STOP-uje gdy brak.
6. **Swap `.env.local` robi env-up automatycznie** — nie musisz ręcznie podmieniać env. Wystarczy, że
   `.env.local` (jeśli istnieje) ma env dev; env-up zrobi backup, podmieni EXPO_PUBLIC_* na e2e na czas
   runu i cofnie na końcu. Nie odpalaj własnego Metro (env-up zrestartuje obce Metro — patrz Pułapki).
7. Gotowe — następny run autopilota wykryje `.env.e2e` i przejdzie w tryb zarządzany.

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
- **Wyegzekwuj re-seed skryptem, nie zdaniem w dokumencie**: jeśli seedy etapu resetują ten sam
  rekord/konto (typowo: `delete from … where user_id = <konto e2e>`), to są **wzajemnie
  destrukcyjne** — po zbiorczym db-sync stan spełnia warunek wstępny najwyżej JEDNEGO flow i „N/N
  PASS" jest nieosiągalne, choć każdy flow osobno przechodzi. Dołóż do etapu runner
  `.maestro/<etap>-run-all.sh` przeplatający `psql -v ON_ERROR_STOP=1 -f <seed>` z
  `maestro test <flow>` para po parze i wskaż go w checkboxach `Weryfikacja: [E2E]` oraz w Operator
  checklist. Wzór: `.maestro/e3-run-all.sh` w repo Nawykometr (etap E3).
- **Seedy aplikuj `psql`, nie `supabase db query -f`**: `db query` wysyła plik jako JEDNO prepared
  statement, więc seed z `begin; do $$ … $$; commit;` pada na `cannot insert multiple commands into
  a prepared statement (42601)`. CLI nadaje się do jednozdaniowych sprawdzeń, nie do seedów.
- **Pozytywna identyfikacja bazy w każdym destrukcyjnym seedzie**: guard „konto testowe istnieje"
  NIE chroni — zawodzi dokładnie wtedy, gdy konto o tym mailu istnieje na dev/prod. Wymagaj tabeli
  markera zakładanej ręcznie WYŁĄCZNIE na bazie e2e (poza migracjami, żeby `db push` nie mógł jej
  przynieść na dev/prod) i zaczynaj seed od:
  `if to_regclass('public.e2e_env_marker') is null then raise exception '…' end if;`

## Pułapki

- **Metro „zastane"**: env-up **deterministycznie restartuje** obce Metro (bez naszego `.pid`) z
  `--clear` i env e2e — bo nie da się zweryfikować env-u cudzego procesu, a dev-client inline'uje env
  z momentu startu Metro. Twoje ręcznie odpalone `bun start` zostanie ubite (zwolnienie portu 8081).
  To celowe: eliminuje klasę false-greenów „flow gada z bazą dev". Ubij własny Metro przed runem, żeby
  nie zdziwił Cię restart.
- **Auto-swap i canary**: pierwszy realny dowód, że flow ruszy, daje **canary** w env-up (login konta
  e2e przez REST + `launchApp` przez Maestro) — jeśli dev-client nie startuje albo konto e2e nie loguje
  się, run STOP-uje w bootstrapie, nie w review fazy 1. Jeśli rollback swapu zawiedzie (log ostrzega),
  przywróć ręcznie: `mv .env.local.bak .env.local`.
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
