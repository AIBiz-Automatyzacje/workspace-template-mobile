---
name: e2e-setup
description: "Przeprowadza one-time setup środowiska E2E (Maestro + dedykowany projekt Supabase) w projekcie Expo — dedykowana baza, .env.e2e, migracje, marker bazy, konto testowe, dev-client z modułami natywnymi, canary jako dowód. Używaj gdy: „ustaw E2E\", „skonfiguruj środowisko testowe\", „setup Maestro\", „autopilot mówi że brak .env.e2e\", „autopilot zatrzymał się na bramce E2E\", „chcę odpalać testy end-to-end\", „canary nie przechodzi\", „flow Maestro nie wchodzą do apki\" — a także PRZED pierwszym uruchomieniem dev-autopilota na etapie, którego plan zawiera checkboxy [E2E]."
argument-hint: "[opcjonalnie: --weryfikuj (tylko sprawdź istniejący setup, bez tworzenia czegokolwiek)]"
---

# e2e-setup — środowisko E2E dla autopilota i testów Maestro

Jednorazowa konfiguracja na projekt. **Zrób ją PRZED pierwszym odpaleniem autopilota** na etapie,
który ma checkboxy `[E2E]` — inaczej autopilot zatrzyma się na bramce setupu (a jeśli bramki nie ma,
przejedzie cały plan i dopiero na końcu okaże się, że scenariuszy nie było gdzie wykonać).

Kanoniczna specyfikacja harnessu: `.claude/templates/e2e-env/README.md`.
Ten skill to **wykonawcza ścieżka** — kolejność kroków, dowód przejścia każdego z nich i pułapki
z realnych przejść. Każdy krok ma dowód, bo `exit 0` nie jest dowodem.

## Zasada nadrzędna

> Deliverable E2E napisany, lecz nieuruchomiony = bug ukryty do pierwszego realnego przebiegu.
> „Green" bez wykonania jest fałszywy.

Dopisanie pliku `.yaml` do repo **nie jest** wykonaniem testu. Znany przypadek: pięć flow przeszło
walidację składni i wyglądało na gotowe, a przy pierwszym realnym uruchomieniu okazało się, że
**żaden nie wchodził nawet do apki** (pułapki 6 i 7).

## Zanim zaczniesz — ustal z użytkownikiem

Zapytaj tylko o to, czego nie da się odczytać z repo:

1. **Czy istnieje już dedykowany projekt Supabase e2e?** Jeśli nie — user musi go utworzyć
   (dashboard, free tier). NIGDY nie używaj refa dev/prod. Jeśli MCP Supabase jest podłączone,
   możesz pomóc z listą projektów, ale samo utworzenie zwykle wymaga dashboardu.
2. **Platforma:** iOS (symulator) czy Android (emulator). iOS jest ścieżką domyślną, jeśli projekt
   ma katalog `ios/` lub użytkownik pracuje na macOS.

Sekretów **nie proś o wklejenie do czatu** — trafiłyby do transkryptu sesji. Utwórz `.env.e2e`
z placeholderami, poproś o wypełnienie w edytorze i o sygnał „gotowe".

---

## 1. Narzędzia

| Narzędzie | Po co | Sprawdzenie |
|---|---|---|
| Maestro CLI | uruchamianie flow | `maestro --version` |
| Java (JDK 17+) | Maestro chodzi na JVM | `java -version` |
| `psql` (libpq) | aplikowanie seedów | `psql --version` |
| Supabase CLI | `db push` migracji | `supabase --version` |
| Xcode / Android SDK | build dev-clienta | `xcodebuild -version` |

`psql` **nie jest** częścią Supabase CLI — trzeba go doinstalować osobno:

```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
```

Homebrew instaluje `libpq` jako *keg-only*, czyli świadomie NIE podlinkowuje binarek do `PATH`
(kolidowałyby z pełnym serwerem Postgresa). Bez dopisania do `PATH` `command -v psql` zwraca pusto,
mimo że pakiet jest zainstalowany.

**Dowód:** `psql --version` zwraca numer w **nowej** sesji terminala.

---

## 2. Osobny projekt Supabase — to nie jest przesada

Nowy projekt (np. `<projekt>-e2e`). Nigdy dev, nigdy prod.

Powód jest twardszy niż higiena: seedy **kasują** dane konta testowego przed każdym przebiegiem, żeby
test startował ze znanego stanu. Jeśli któraś tabela jest append-only (RLS bez polityk `UPDATE`
i `DELETE` — typowe dla ledgerów punktów, płatności, audytu), to wiersze dopisane przez flow na bazie
produkcyjnej **są nieusuwalne z klienta**; zostaje ręczna interwencja admina.

Drugie ryzyko z tego samego worka: flow celują na sztywno w adres Metro (`127.0.0.1:8081`), więc
uruchomione przy Metro podniesionym ze zmiennymi dev/prod zapiszą dane tam, gdzie akurat wskazuje env.

**Dowód:** ref w `.env.e2e` różni się od refa w `.env` / `.env.local`:

```bash
grep EXPO_PUBLIC_SUPABASE_URL .env .env.e2e 2>/dev/null
```

---

## 3. Plik `.env.e2e`

```bash
cp .claude/templates/e2e-env/.env.e2e.example .env.e2e
printf '.env.e2e\n.env.local.bak\n' >> .gitignore   # jeśli jeszcze ich nie ma
git check-ignore -v .env.e2e .env.local.bak          # MUSI wypisać dopasowania
```

Osiem wartości, realnie cztery rzeczy — reszta się powtarza:

| Zmienna | Skąd |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Settings → API |
| `SUPABASE_E2E_SERVICE_ROLE_KEY` | Settings → API (**service_role**, omija RLS) |
| `SUPABASE_E2E_DB_URL` | Settings → Database → **Session pooler** (patrz pułapki 1–3) |
| `E2E_TEST_EMAIL`/`_PASSWORD` + `EXPO_PUBLIC_E2E_TEST_USER_EMAIL`/`_PASSWORD` | wymyślasz; **obie pary identyczne** |

Dlaczego ta sama para dwa razy: `E2E_TEST_*` czyta harness (canary, seedy, tworzenie konta),
a `EXPO_PUBLIC_E2E_TEST_USER_*` Metro inline'uje do bundla, żeby apka wiedziała, czym się zalogować.
Rozjazd = apka loguje się na konto, którego seed nie zna. **Brak drugiej pary jest cichy** — env-up
wymaga tylko pierwszej, więc setup „wg instrukcji" przechodzi, a błąd wychodzi dopiero na pierwszej
asercji za auth.

**Dowód** (bez wypisywania wartości): żadna linia nie zawiera `<` ani `>` (pozostały placeholder)
i obie pary są równe.

---

## 4. Migracje na bazę e2e

```bash
DB=$(grep '^SUPABASE_E2E_DB_URL=' .env.e2e | cut -d= -f2-)
supabase db push --db-url "$DB" --include-all
```

To bywa **pierwszy realny apply SQL migracji w całym projekcie** — `jest` chodzi po atrapach albo
lokalnym SQLite i nie wykonuje ani migracji, ani RLS. Dlatego dowód przejścia jest jednocześnie
weryfikacją samych migracji na żywym Postgresie:

```bash
psql "$DB" -tAc "select string_agg(tablename,', ') from pg_tables where schemaname='public';"
psql "$DB" -tAc "select string_agg(cmd||':'||policyname,'  ') from pg_policies where tablename='<tabela>';"
psql "$DB" -tAc "select string_agg(tgname,', ') from pg_trigger
                 where tgrelid='public.<tabela>'::regclass and not tgisinternal;"
```

Sprawdź, czy wynik zgadza się z niezmiennikami projektu — np. tabela append-only NIE MOŻE mieć
polityk `UPDATE`/`DELETE`, a trigger walidujący musi istnieć.

### 4b. Marker bazy E2E — bez niego żaden seed nie wystartuje

Skoro seedy kasują dane, każdy z nich wymaga **pozytywnej identyfikacji bazy**: tabeli-markera
istniejącej WYŁĄCZNIE na bazie e2e. Guard „konto o tym mailu istnieje" tego nie zapewnia — zawodzi
otwarcie dokładnie w groźnym przypadku, czyli gdy konto testowe istnieje też na dev/prod.

```bash
psql "$DB" -v ON_ERROR_STOP=1 -c "create table if not exists public.e2e_env_marker(id int primary key default 1, note text not null default 'baza projektu E2E — NIGDY dev/prod');"
```

Marker jest **poza migracjami** świadomie: `supabase db push` na dev/prod nie może go przynieść.
**Nigdy nie zakładaj tej tabeli na dev ani prod.**

Każdy seed zaczyna się od:

```sql
if to_regclass('public.e2e_env_marker') is null then
  raise exception 'Seed <nazwa> odmawia pracy: brak public.e2e_env_marker — to nie jest baza e2e.';
end if;
```

**Dowód:** najpierw negatywny (na bazie bez markera seed MUSI odmówić), potem pozytywny —
`psql "$DB" -tAc "select to_regclass('public.e2e_env_marker') is not null;"` zwraca `t`.

---

## 5. Konto testowe

Nie klikaj w konsoli — utwórz przez Admin API kluczem `service_role`, z `email_confirm: true`
(bez tego konto istnieje, ale logowanie hasłem odbija się o niepotwierdzony mail):

```
POST {SUPABASE_URL}/auth/v1/admin/users
Headers: apikey + Authorization: Bearer {SERVICE_ROLE_KEY}
Body:    {"email": ..., "password": ..., "email_confirm": true}
```

**Dowód** — zaloguj się tak, jak zrobi to apka, czyli **kluczem anon**, nie service_role:

```
POST {SUPABASE_URL}/auth/v1/token?grant_type=password
Headers: apikey: {ANON_KEY}
```

Musi wrócić `access_token`. To sprawdza całą ścieżkę, którą pójdzie apka — anon key, provider Email
włączony, polityki, potwierdzenie maila — a nie tylko „wiersz w `auth.users` istnieje".

---

## 6. Dev-client z modułami natywnymi

Jeśli etap dodał paczkę z częścią natywną (`expo-sqlite`, `expo-network`, …), stary dev-client wywali
`Cannot find native module` — JS przyjdzie świeży z Metro, ale natywnej strony nie doklei.

```bash
npx expo prebuild --platform ios
xcodebuild -workspace ios/*.xcworkspace -scheme <scheme> -configuration Debug \
  -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGN_IDENTITY="-" build
xcrun simctl install booted <ścieżka do .app>
```

**`CODE_SIGN_IDENTITY="-"`, nigdy `CODE_SIGNING_ALLOWED=NO`.** Drugi wariant pomija podpisywanie, więc
binarka nie dostaje entitlements — a bez `application-identifier` Keychain odmawia współpracy
i `expo-secure-store` nie utrzyma sesji. Build „przejdzie", a sesja nie przeżyje restartu apki.

Dopisz `/ios` i `/android` do `.gitignore`, jeśli projekt jest czystym CNG — inaczej wygenerowane
katalogi wywalą bramkę „czyste drzewo" przy następnym starcie autopilota.

---

## 7. Canary — dopiero on kończy setup

```bash
set -a; source .env.e2e; set +a
maestro test -e E2E_EMAIL="$E2E_TEST_EMAIL" -e E2E_PASSWORD="$E2E_TEST_PASSWORD" .maestro/_canary.yaml
```

Brak `.maestro/_canary.yaml`? Skopiuj wzór: `cp .claude/templates/e2e-env/_canary.yaml .maestro/`
i podmień oznaczone miejsca (`scheme` z `app.json`, testID ekranu za auth).

Canary MUSI przejść przez logowanie do ekranu **za auth** — samo `launchApp` niczego nie dowodzi
poza tym, że apka wstaje, i dwukrotnie już wpuściło zepsute środowisko do runu.

Dopiero po `MAESTRO_EXIT=0` sensowne są flow etapu i uruchomienie autopilota.

---

## Pułapki — wszystkie z realnych przejść

**1. `db.<ref>.supabase.co` nie działa — potrzebny session pooler.**
`No route to host` z adresem IPv6 w komunikacie to cała diagnoza: bezpośrednie połączenie Supabase
jest dziś IPv6-only, a typowa sieć domowa go nie routuje. Poprawnie:
`postgresql://postgres.<ref>:<hasło>@aws-1-<region>.pooler.supabase.com:5432/postgres`
— zwróć uwagę, że user to `postgres.<ref>`, nie `postgres`.

**2. `aws-0` vs `aws-1` w hoście poolera.** `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found`
sugeruje złe hasło, a oznacza zły shard. Starsze przykłady mówią `aws-0-<region>`, nowsze projekty
dostają `aws-1-<region>`. Kopiuj string z konsoli; jak nie działa — podmień prefiks.

**3. Port 5432 vs 6543.** Session pooler (5432) trzyma sesję i wspiera migracje. Transaction pooler
(6543) nie — `db push` i skrypty wielostanowe się na nim wywalą.

**4. Mail konta testowego musi być NIEROUTOWALNY.** Seedy trzymają adres jako stałą w SQL i są
commitowane do repo — realna skrzynka trafia do historii gita na zawsze. Używaj domeny `.test`
(zarezerwowana przez RFC, gwarantowanie nieistniejąca w DNS): `e2e@<projekt>.test`.

**5. Tożsamość konta żyje w trzech miejscach:** `.env.e2e` (dwie pary kluczy) + stała `c_email`
w każdym seedzie. Dobry seed sprawdza to sam i mówi wprost, co jest nie tak
(`raise exception 'brak konta … w auth.users'`) — bez tego przechodzi „pusto", a flow pada dalej
z niejasnym błędem.

**6. Flow musi jawnie wejść w dev server.** `launchApp` na dev-cliencie ląduje na ekranie
expo-dev-launcher, nie w apce. Pierwsza asercja pada, a komunikat („element nie widoczny") nie
wskazuje przyczyny. Potrzebny `openLink: "<scheme>://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"`
(Android: `10.0.2.2:8081`).

**7. Onboardingowy sheet dev-menu zasłania apkę.** Panel „This is the developer menu…" z przyciskiem
`Continue` wraca przy KAŻDYM przebiegu, bo `clearState: true` czyści też flagę „menu widziane".
Gasi się go dwoma krokami (`Continue`, potem tap poza panelem), oba warunkowe.

**8. Restart apki w flow: `stopApp` + `openLink`, nigdy `launchApp` + `openLink`.**
`launchApp` — także z `stopApp: true` — najpierw **startuje** apkę, więc kolejny `openLink` trafia
w żywy proces i robi gorący restart. To deterministycznie wywala runtime (SIGSEGV pod `0x0`
w destruktorze JSI, wątek `com.facebook.react.runtime.JavaScript`), a Maestro raportuje to jako
nietrafioną asercję albo `Timed out snapshotting`. Rozdziel na dwa kroki. Skrót diagnostyczny, gdy
flow „wisi" po restarcie:

```bash
xcrun simctl terminate booted <bundle-id>
xcrun simctl openurl booted "<scheme>://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
xcrun simctl io booted screenshot /tmp/po-restarcie.png   # obejrzyj, co realnie widzi user
```

**9. `supabase db query -f` NIE zastępuje `psql` przy seedach.** `db query` wysyła plik jako JEDNO
prepared statement, więc seed z `begin; do $$ … $$; commit;` pada na `cannot insert multiple commands
into a prepared statement (42601)`. CLI nadaje się do jednozdaniowych sprawdzeń, nie do seedów.

**10. Weryfikacja modułów natywnych — dwie oczywiste metody kłamią.** Pody linkują się statycznie do
`<App>.debug.dylib` (~50 MB), a plik `<App>` to kilkudziesięciokilobajtowy stub. Dlatego lista
`<App>.app/Frameworks/` niczego nie dowodzi, a `nm`/`strings` na `<App>` zwraca zero trafień.
Sprawdzaj dylib i wygenerowany provider:

```bash
nm -a "<App>.app/<App>.debug.dylib" | grep -ci exposqlite     # oczekuj setek/tysięcy
grep -oE "^import \w+" "ios/Pods/Target Support Files/Pods-<App>/ExpoModulesProvider.swift"
```

**11. Bramka `__DEV__` wyklucza build `preview`.** Jeśli ścieżka logowania e2e jest bramkowana
wariantem bundla (żeby hasło konta testowego nie mogło wylądować jawnym tekstem w artefakcie
sklepowym), to `preview` z wbudowanym bundlem **nie jest** alternatywą dla dev-clienta — przycisk
logowania w nim nie powstaje i flow padną na pierwszym `tapOn`.

**12. Seedy wzajemnie destrukcyjne = „N/N PASS" nieosiągalne.** Jeśli każdy seed etapu resetuje ten
sam rekord/konto, to po zbiorczym apply stan spełnia warunek wstępny najwyżej JEDNEGO flow, choć
każdy osobno przechodzi. Dołóż runner `.maestro/<etap>-run-all.sh` przeplatający
`psql -v ON_ERROR_STOP=1 -f <seed>` z `maestro test <flow>` para po parze.

---

## Kolejność, gdyby robić to jeszcze raz

1. `brew install libpq` + `PATH`, sprawdź Maestro i Javę.
2. Nowy projekt Supabase, ref inny niż dev/prod.
3. `.env.e2e` z example, **session pooler** w DB URL, mail w domenie `.test`.
4. `git check-ignore` na `.env.e2e` i `.env.local.bak`.
5. `supabase db push --db-url` + zapytania weryfikujące schemat i RLS.
6. Marker `public.e2e_env_marker` na bazie e2e — bez niego seedy odmawiają pracy.
7. Konto przez Admin API z `email_confirm: true`, potwierdzone logowaniem **anon key**.
8. Stała `c_email` w seedach zgodna z `E2E_TEST_EMAIL`.
9. Dev-client przebudowany z podpisem ad-hoc, moduły natywne zweryfikowane w dylib.
10. `maestro test .maestro/_canary.yaml` — **dopiero teraz** odpalaj autopilota.

Krok 10 jest puentą: canary istnieje po to, żeby jedno tanie uruchomienie powiedziało „środowisko
stoi", zanim ktokolwiek wyda godziny na pełny przebieg. Pominięcie go kosztowało już trzy przerwane
runy autopilota w jednym etapie.

## Powiązane

- `.claude/templates/e2e-env/README.md` — kanoniczna specyfikacja harnessu i architektura bramek
- `.claude/templates/e2e-env/_canary.yaml` — wzór canary do skopiowania do `.maestro/`
- skill `mobile-e2e-maestro` — pisanie samych flow (komendy, gesty, granice możliwości Maestro)
- `.claude/workflows/dev-autopilot-wf.js` — bramka, która zatrzymuje run bez tego setupu
