---
name: security
description: "Systematyczny audyt bezpieczeństwa dla React Native / Expo + Supabase + Edge Functions. Używaj przy review bezpieczeństwa, przed releasem, przy pracy z auth/authz, walidacją inputów, RLS policies, deep linkingiem, storage sekretów (SecureStore), WebView, OWASP (w tym Mobile Top 10)."
---

# Security Audit (mobile)

Skill do przeprowadzania systematycznego audytu bezpieczenstwa w projekcie React Native / Expo + Supabase + Edge Functions.

## Kiedy Uzywac

- Review bezpieczenstwa przed releasem (App Store / Google Play / EAS Update)
- Dodawanie nowych endpointow (Edge Functions, API routes `+api.ts`)
- Zmiany w autentykacji lub autoryzacji (auth/authz, OAuth przez deep linking)
- Tworzenie nowych tabel w bazie danych (RLS policies)
- Praca z danymi uzytkownikow (PII, GDPR)
- Nowe deep linki, WebView, obsluga QR / push notifications
- Podejrzenie o luke bezpieczenstwa w istniejacym kodzie

**Kluczowa rama mentalna mobile:** bundle aplikacji jest PUBLICZNY (kazdy moze go pobrac
i zdekompilowac), urzadzenie jest NIEZAUFANE (root/jailbreak, wspoldzielone), a deep linki
to punkty wejscia dostepne dla KAZDEJ innej aplikacji na urzadzeniu.

---

## Workflow -- 6-skanowy protokol

### Krok 1: Input Validation

Znajdz wszystkie punkty wejscia danych z zewnatrz i zweryfikuj walidacje.

1. **Zmapuj punkty wejscia (mobile ma ich wiecej niz web):**
   - Formularze RN (react-hook-form + Zod)
   - Edge Functions / API routes (`req.json()`, `req.text()`, query params)
   - **Deep linki** (expo-linking / Expo Router): parametry z URL — moze je wyslac KAZDA aplikacja
   - **Skan QR** (expo-camera): tresc kodu to niezaufany input (np. kody dolaczania do gry)
   - **Push notifications**: payload `data` z notyfikacji
   - File uploads (expo-image-picker / document-picker): typ, rozmiar, nazwa pliku
2. **Sprawdz walidacje Zod** na kazdym punkcie wejscia:
   - Czy schemat Zod istnieje i jest na granicy systemu (nie glebiej)?
   - Czy typy sa restrykcyjne (`z.string().email()`, nie `z.string()`)?
   - Czy sa limity dlugosci (`z.string().max(500)`)?
3. **Szukaj brakujacej walidacji** -- kazdy `req.json()` bez Zod parse i kazdy parametr
   deep linka uzyty bez walidacji to finding.

### Krok 2: SQL/Query Safety

Supabase query builder jest domyslnie parametryzowany, ale sa pulapki.

1. **Sprawdz wywolania `.rpc()`** -- czy funkcje PostgreSQL nie konkatenuja stringow w SQL
2. **Sprawdz RLS** na kazdej tabeli:
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` -- czy jest?
   - Czy sa policies dla SELECT, INSERT, UPDATE, DELETE?
   - Czy policies uzywaja `(SELECT auth.uid())` (nie `auth.email()`)?
   - RLS to TWOJA JEDYNA bariera — klient mobilny jest niezaufany z definicji
     (anon key z bundla + dowolne zapytanie da sie wyslac poza aplikacja)
3. **Sprawdz filtry** -- czy zapytania `.from()` maja odpowiednie `.eq()`, `.match()`
4. **Sprawdz `.rpc()` z raw SQL** -- szukaj konkatenacji stringow wewnatrz funkcji PostgreSQL

### Krok 3: Powierzchnia mobilna (storage / deep linki / WebView)

Zamiast webowego XSS — natywne wektory ataku.

1. **Storage sekretow:**
   - Tokeny, klucze sesji, dane wrazliwe: TYLKO `expo-secure-store` (Keychain/Keystore)
   - `AsyncStorage` to PLAINTEXT na dysku — finding, jesli laduje tam cokolwiek wrazliwego
   - Czy klient Supabase ma storage adapter oparty o SecureStore?
2. **Deep linking:**
   - Czy parametry deep linkow sa walidowane przed uzyciem (nawigacja, fetch, mutacje)?
   - Custom scheme (`myapp://`) moze przejac inna aplikacja na Androidzie —
     dla flowow auth preferuj **App Links / Universal Links** (zweryfikowane domeny)
   - OAuth redirect: czy uzywa PKCE (expo-auth-session / Supabase OAuth z PKCE)?
   - Czy deep link nie pozwala ominac ekranow autoryzacji (route hijacking)?
3. **WebView (jesli istnieje):**
   - Czy laduje wylacznie zaufane URL-e (whitelist, nie user input)?
   - `injectedJavaScript` z danymi uzytkownika = odpowiednik XSS — finding
   - Czy komunikacja WebView<->RN (`onMessage`) waliduje wiadomosci?
4. **Ekrany wrazliwe:** dane karty/hasla — rozwaz blokade screenshotow i maskowanie
   w app switcherze (LOW, hardening)

### Krok 4: Auth/Authz Audit

Zmapuj endpointy vs wymagania autoryzacji.

1. **Stworz macierz dostepu:**

| Endpoint / Akcja | Anon | Authenticated | Owner | Admin |
|-------------------|------|---------------|-------|-------|
| GET /posts        | tak  | tak           | tak   | tak   |
| POST /posts       | nie  | tak           | -     | tak   |
| DELETE /posts/:id | nie  | nie           | tak   | tak   |

2. **Zweryfikuj RLS policies** -- czy odzwierciedlaja macierz dostepu
3. **Edge Functions JWT** -- czy kazda chroniona funkcja wywoluje `supabase.auth.getUser()`?
4. **Sprawdz `getSession()` vs `getUser()`** -- `getSession()` nie weryfikuje tokena server-side
5. **Sprawdz role-based access** -- czy nie ma hardcoded email/ID w logice autoryzacji
6. **Biometria** (expo-local-authentication) to LOKALNA bramka UX, NIE autoryzacja —
   serwer nadal musi weryfikowac token; biometria nie zastepuje auth

### Krok 5: Sensitive Data Exposure

Szukaj wyciekow danych wrazliwych. Pamietaj: bundle da sie zdekompilowac (`strings` na IPA/APK).

1. **Hardcoded secrets:**
   - Szukaj: API keys, tokeny, hasla w kodzie zrodlowym
   - **Wszystko z prefiksem `EXPO_PUBLIC_*` jest PUBLICZNE w bundlu** — wolno tam trzymac
     wylacznie anon key i jawne URL-e; klucze platne (OpenAI, Stripe secret) NIGDY —
     ukrywaj za Edge Function / API route (skill expo-api-routes)
   - Sprawdz `.env.example` -- czy nie zawiera prawdziwych wartosci
   - Sprawdz git history -- `git log --diff-filter=A -- "*.env*"`
2. **Service role key:**
   - `SUPABASE_SERVICE_ROLE_KEY` TYLKO w Edge Functions / backendzie —
     w bundlu aplikacji to CRITICAL (pelne obejscie RLS dla kazdego, kto pobierze apke)
3. **Dane w logach:**
   - `console.log` z obiektami user/session trafia do `adb logcat` / Console.app —
     czytelne dla innych narzedzi na urzadzeniu deweloperskim
   - Struktury bledow Supabase wyciekaja info o schemacie DB
4. **PII w Sentry:**
   - Czy `captureException` nie wysyla danych osobowych?
   - Czy `beforeSend` filtruje wrazliwe dane?
5. **Odpowiedzi API:**
   - Czy endpointy nie zwracaja wiecej danych niz potrzeba? (`select('*')` vs `select('id, name')`)

### Krok 6: OWASP Compliance

Przejdz kategorie OWASP pod katem stacku:

- **OWASP Mobile Top 10 (2024)** dla warstwy aplikacji: M1 improper credential usage,
  M2 supply chain, M3 insecure auth/authz, M4 insufficient input validation, M5 insecure
  communication, M6 inadequate privacy controls, M8 security misconfiguration,
  M9 insecure data storage, M10 insufficient cryptography — wiekszosc pokrywaja kroki 1-5.
- **OWASP Top 10 (2021)** dla warstwy backendu (Edge Functions / API routes):
  mapowanie w **[resources/owasp-react-supabase.md](resources/owasp-react-supabase.md)**
  (UWAGA: resource pisany pod web — sekcje XSS/CSP czytaj przez pryzmat kroku 3 tego skilla).

---

## Klasyfikacja Findings

```
CRITICAL -- Exploit mozliwy w produkcji, wymaga natychmiastowej naprawy
   Przyklady: RLS wylaczone na tabeli z PII, service_role key w bundlu aplikacji,
   SQL injection w .rpc(), brak auth na endpoincie z danymi, token sesji w AsyncStorage

HIGH -- Powazna luka, exploit mozliwy przy okreslonych warunkach
   Przyklady: brak walidacji inputow na Edge Function, parametry deep linka uzywane
   bez walidacji (route hijacking / IDOR), OAuth bez PKCE na custom scheme,
   getSession() do autoryzacji server-side, injectedJavaScript z user input w WebView

MEDIUM -- Potencjalne ryzyko, wymaga analizy kontekstu
   Przyklady: brak rate limiting, zbyt szerokie CORS na Edge Function, select('*')
   zamiast konkretnych kolumn, klucz platnego API w EXPO_PUBLIC_*, PII w console.log

LOW -- Hardening, defense-in-depth
   Przyklady: brak maskowania wrazliwych ekranow w app switcherze, outdated
   dependencies bez znanych CVE, brak audit logging dla niekrytycznych operacji,
   brak certificate pinning (rozwaz dla aplikacji wysokiego ryzyka)
```

---

## Format Raportu

```markdown
## Security Audit Report: [nazwa projektu / scope]

### Executive Summary
[1-3 zdania: ogolna ocena bezpieczenstwa, liczba findings, najwazniejsze ryzyka]

### Findings

#### CRITICAL
1. **[plik:linia]** -- [tytul]
   - Impact: [co moze sie stac]
   - Remediation: [jak naprawic, z przykladem kodu]

#### HIGH
[jak wyzej]

#### MEDIUM
[jak wyzej]

#### LOW
[jak wyzej]

### Risk Matrix

| Kategoria               | Status | Findings |
|-------------------------|--------|----------|
| Input Validation        | [OK/WARN/FAIL] | X |
| SQL/Query Safety        | [OK/WARN/FAIL] | X |
| Powierzchnia mobilna    | [OK/WARN/FAIL] | X |
| Auth/Authz              | [OK/WARN/FAIL] | X |
| Data Exposure           | [OK/WARN/FAIL] | X |
| OWASP Compliance        | [OK/WARN/FAIL] | X |

### Remediation Roadmap
1. [CRITICAL] [opis] -- termin: natychmiast
2. [HIGH] [opis] -- termin: przed releasem
3. [MEDIUM] [opis] -- termin: nastepny sprint
4. [LOW] [opis] -- termin: backlog
```

---

## Zasady

1. **Mysl jak atakujacy** -- zakladaj najgorszy scenariusz, nie optymistyczny
2. **Klient mobilny jest niezaufany** -- bundle publiczny, urzadzenie obce; jedyna
   prawdziwa bariera to RLS + walidacja server-side
3. **Zawsze podawaj rozwiazanie** -- finding bez remediation jest bezuzyteczny
4. **Nie dismissuj jako pre-existing** -- istniejace luki sa nadal lukami
5. **Weryfikuj, nie zakladaj** -- "Supabase domyslnie to robi" nie wystarczy, sprawdz konfiguracje
6. **Najmniejsze uprawnienia** -- kazdy komponent powinien miec minimum potrzebnych uprawnien
7. **Defense in depth** -- jedna warstwa ochrony to za malo, waliduj na kazdej granicy
8. **Dokumentuj scope** -- jasno okresl co zostalo sprawdzone, a co nie

---

## Dokumentacja Referencyjna

- **OWASP Top 10 (backend/Edge Functions)** -- `resources/owasp-react-supabase.md`
  (dziedzictwo webowe: sekcje XSS/CSP interpretuj przez krok 3 — powierzchnia mobilna)
- **Wzorce auth i bezpieczenstwa Supabase** -- `resources/auth-security-patterns.md`
  (wzorce RLS/JWT/policies uniwersalne; fragmenty o cookies/SSR nie dotycza mobile —
  w Expo sesja zyje w SecureStore, nie w cookies)
