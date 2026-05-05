# OWASP Top 10 (2021) -- Mapowanie na React + Supabase + Edge Functions

Przewodnik mapujacy kazda kategorie OWASP Top 10 na konkretne scenariusze, checklisty i wzorce kodu dla stacku React 19 + Supabase + Edge Functions.

---

## A01: Broken Access Control

Najczestszy problem bezpieczenstwa. W naszym stacku manifestuje sie przez bledna lub brakujaca konfiguracje RLS.

**Scenariusze w naszym stacku:**
- RLS wylaczone na tabeli -- kazdy z anon key ma pelny dostep
- Brak policy na operacje DELETE -- uzytkownik moze usuwac cudze dane
- `service_role` key w zmiennych `VITE_*` -- przegladarka omija RLS
- Edge Function bez weryfikacji JWT -- anonimowy dostep do chronionych operacji
- Policy oparta na `auth.email()` zamiast `auth.uid()` -- email jest mutowalny

**Checklist:**
- [ ] Kazda tabela ma `ENABLE ROW LEVEL SECURITY`
- [ ] Policies pokrywaja SELECT, INSERT, UPDATE, DELETE
- [ ] Policies uzywaja `(SELECT auth.uid()) = user_id`
- [ ] `service_role` key NIE jest w zmiennych `VITE_*`
- [ ] Edge Functions weryfikuja JWT przez `supabase.auth.getUser()`
- [ ] Brak hardcoded user ID / email w logice autoryzacji
- [ ] Macierz dostepu (kto moze co) jest udokumentowana i zweryfikowana

**Zly wzorzec:**
```sql
-- Tabela bez RLS -- pelny dostep dla kazdego z anon key
CREATE TABLE user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Brak ALTER TABLE ... ENABLE ROW LEVEL SECURITY
-- Brak policies
```

**Dobry wzorzec:**
```sql
CREATE TABLE user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_documents"
ON user_documents FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "users_insert_own_documents"
ON user_documents FOR INSERT
TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "users_delete_own_documents"
ON user_documents FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);
```

---

## A02: Cryptographic Failures

Wycieki danych wrazliwych przez brak lub bledne szyfrowanie / zarzadzanie secretami.

**Scenariusze w naszym stacku:**
- Secrets (API keys, service_role) commitowane do repozytorium
- PII (email, imie) w logach `console.error` lub w payloadach Sentry
- Brak HTTPS (Supabase wymusza domyslnie, ale custom domeny moga nie miec)
- Tokeny w URL query params (widoczne w logach serwera, referer headers)

**Checklist:**
- [ ] `.env` i `.env.local` sa w `.gitignore`
- [ ] `.env.example` zawiera TYLKO klucze bez wartosci
- [ ] Brak secretow w kodzie zrodlowym (szukaj: `sk_`, `secret`, `password`, `token`)
- [ ] `console.error` / `console.log` nie loguja obiektow user/session
- [ ] Sentry `beforeSend` filtruje PII
- [ ] Custom domeny maja wazny certyfikat SSL
- [ ] Tokeny nie sa przekazywane w URL query params

**Zly wzorzec:**
```typescript
// Hardcoded secret w kodzie
const STRIPE_KEY = 'sk_live_abc123def456';

// PII w logach
console.error('User error:', { email: user.email, session });

// Secret w VITE_ (dostepny w przegladarce)
const supabase = createClient(url, import.meta.env.VITE_SERVICE_ROLE_KEY);
```

**Dobry wzorzec:**
```typescript
// Secret w zmiennej srodowiskowej (Edge Function)
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

// Logowanie bez PII
logger.error('Blad aktualizacji profilu', { userId: user.id, errorCode: error.code });

// Anon key na froncie, service_role tylko server-side
const supabase = createClient(url, import.meta.env.VITE_SUPABASE_ANON_KEY);
```

---

## A03: Injection

SQL injection i XSS -- dwa glowne wektory ataku przez wstrzykiwanie kodu.

**Scenariusze w naszym stacku:**
- Raw SQL w funkcjach `.rpc()` -- konkatenacja stringow w PostgreSQL
- Niebezpieczne renderowanie raw HTML z user content -- XSS
- User-generated URLs w `href` -- `javascript:` protocol injection
- Template literals w zapytaniach SQL wewnatrz SECURITY DEFINER functions

**Checklist:**
- [ ] Brak konkatenacji stringow w funkcjach PostgreSQL (uzyj `$1`, `$2` parametrow)
- [ ] Brak niebezpiecznego renderowania raw HTML z niezaufanymi danymi
- [ ] Walidacja protokolu dla user-provided URLs (whitelist: `https:`, `http:`)
- [ ] Brak `EXECUTE format(...)` z user input bez `%L` (literal quoting)
- [ ] Content Security Policy blokuje inline scripts

**Zly wzorzec -- SQL Injection:**
```sql
-- Konkatenacja w funkcji PostgreSQL
CREATE FUNCTION search_posts(search_term TEXT)
RETURNS SETOF posts
LANGUAGE plpgsql AS $$
BEGIN
    -- NIEBEZPIECZNE: SQL injection
    RETURN QUERY EXECUTE 'SELECT * FROM posts WHERE title LIKE ''%' || search_term || '%''';
END;
$$;
```

**Dobry wzorzec -- SQL Injection:**
```sql
CREATE FUNCTION search_posts(search_term TEXT)
RETURNS SETOF posts
LANGUAGE plpgsql AS $$
BEGIN
    -- BEZPIECZNE: parametryzowane zapytanie
    RETURN QUERY SELECT * FROM posts WHERE title ILIKE '%' || search_term || '%';
    -- Lub z EXECUTE i %L:
    -- RETURN QUERY EXECUTE format('SELECT * FROM posts WHERE title ILIKE %L', '%' || search_term || '%');
END;
$$;
```

**Zly wzorzec -- XSS:**
```typescript
// User-provided URL bez walidacji
function UserLink({ url }: { url: string }) {
    return <a href={url}>Link</a>; // javascript:alert('xss') zadziala
}

// Wstawianie niezaufanego HTML do DOM -- podatne na XSS
// Np. przypisanie user content do elementu DOM przez raw HTML API
// lub uzycie React API do renderowania nieczyszczonego HTML
```

**Dobry wzorzec -- XSS:**
```typescript
// Uzyj biblioteki do sanityzacji (DOMPurify) jesli musisz renderowac HTML
import DOMPurify from 'dompurify';

function Comment({ content }: { content: string }) {
    const sanitized = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
    return <div>{sanitized}</div>;
}

// Walidacja protokolu URL
function UserLink({ url }: { url: string }) {
    const isSafeUrl = /^https?:\/\//i.test(url);
    if (!isSafeUrl) return null;
    return <a href={url} rel="noopener noreferrer">Link</a>;
}
```

---

## A04: Insecure Design

Brak mechanizmow bezpieczenstwa na poziomie architektury.

**Scenariusze w naszym stacku:**
- Brak rate limiting na Edge Functions (brute force, DDoS)
- Brak CSRF protection na mutujacych endpointach
- Brak limitu prob logowania
- Brak mechanizmu lockout po nieudanych probach

**Checklist:**
- [ ] Rate limiting na publicznych Edge Functions
- [ ] Limit prob logowania (Supabase ma wbudowany, zweryfikuj konfiguracje)
- [ ] CORS restrykcyjny (nie `*`) na Edge Functions
- [ ] Timeout na operacjach (AbortController, statement_timeout w PostgreSQL)
- [ ] Limity rozmiaru plikow przy uploadzie
- [ ] Limity dlugosci inputow (Zod `.max()`)

**Zly wzorzec:**
```typescript
// Edge Function bez rate limiting i z otwartym CORS
Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*', // Kazda domena
        'Access-Control-Allow-Methods': 'POST',
    };
    // Brak limitu wywolan
    const { email } = await req.json();
    await sendPasswordReset(email); // Brute force enumeration
    return new Response('OK', { headers: corsHeaders });
});
```

**Dobry wzorzec:**
```typescript
import { corsHeaders } from '../_shared/cors.ts';

// CORS z konkretna domena
const allowedOrigins = [Deno.env.get('ALLOWED_ORIGIN')!];

Deno.serve(async (req) => {
    const origin = req.headers.get('Origin') ?? '';
    if (!allowedOrigins.includes(origin)) {
        return new Response('Forbidden', { status: 403 });
    }

    // Walidacja inputu z limitem
    const body = await req.json();
    const parsed = z.object({
        email: z.string().email().max(255),
    }).safeParse(body);

    if (!parsed.success) {
        return new Response('Bad Request', { status: 400 });
    }

    return new Response('OK', { headers: corsHeaders });
});
```

---

## A05: Security Misconfiguration

Domyslne lub bledne ustawienia otwierajace luki.

**Scenariusze w naszym stacku:**
- Domyslne ustawienia Supabase bez dodatkowego hardeningu
- CORS `Access-Control-Allow-Origin: *` na Edge Functions
- Zmienne srodowiskowe niedopasowane miedzy srodowiskami (dev/staging/prod)
- Brak Content Security Policy headers
- Debug mode wlaczony na produkcji

**Checklist:**
- [ ] CORS ograniczony do konkretnych domen (nie `*`)
- [ ] CSP header skonfigurowany (przynajmniej `default-src 'self'`)
- [ ] `X-Content-Type-Options: nosniff` ustawiony
- [ ] `X-Frame-Options: DENY` (lub CSP `frame-ancestors 'none'`)
- [ ] Supabase Dashboard: Email enumeration protection wlaczone
- [ ] Supabase Dashboard: Redirect URLs ograniczone do znanych domen
- [ ] Zmienne srodowiskowe rozne miedzy dev/staging/prod
- [ ] Brak `console.log` / debug output na produkcji

**Zly wzorzec:**
```typescript
// _shared/cors.ts -- zbyt otwarty
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
};
```

**Dobry wzorzec:**
```typescript
// _shared/cors.ts -- restrykcyjny
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? 'https://myapp.com';

export const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

---

## A06: Vulnerable and Outdated Components

Zaleznosci z znanymi lukami bezpieczenstwa.

**Scenariusze w naszym stacku:**
- Outdated `@supabase/supabase-js` z znanymi CVE
- Stare wersje React z lukami bezpieczenstwa
- Zaleznosci dev ktore wyciekaja do produkcji
- Brak regularnego audytu zaleznosci

**Checklist:**
- [ ] `npm audit` / `bun audit` nie zwraca krytycznych luk
- [ ] Zaleznosci aktualizowane przynajmniej kwartalnie
- [ ] `package-lock.json` / `bun.lockb` commitowany (reproducible builds)
- [ ] Brak `dependencies` ktore powinny byc w `devDependencies`
- [ ] Dependabot / Renovate skonfigurowany do automatycznych PR

**Komendy do sprawdzenia:**
```bash
# Audit zaleznosci
npm audit
# lub
bun audit

# Sprawdz outdated
npm outdated
```

---

## A07: Identification and Authentication Failures

Slabe mechanizmy autentykacji i zarzadzania sesjami.

**Scenariusze w naszym stacku:**
- Brak wymuszenia minimalnej dlugosci hasla
- Brak MFA (Multi-Factor Authentication)
- `getSession()` uzywane do autoryzacji server-side (token nie jest weryfikowany)
- Session fixation po zmianie uprawnien
- Brak re-autentykacji przed krytycznymi operacjami

**Checklist:**
- [ ] Minimalna dlugosc hasla >= 8 znakow (Supabase Dashboard)
- [ ] `getUser()` lub `getClaims()` do autoryzacji server-side (nie `getSession()`)
- [ ] Re-autentykacja przed: zmiana hasla, zmiana email, usuniecie konta
- [ ] Generyczne komunikaty bledow logowania (nie ujawniaj czy email istnieje)
- [ ] OAuth redirect URLs ograniczone do znanych domen
- [ ] Token refresh dziala poprawnie (Supabase JS automatycznie)

**Zly wzorzec:**
```typescript
// getSession() do autoryzacji -- token nie jest weryfikowany
const { data: { session } } = await supabase.auth.getSession();
if (session) {
    // Zaufanie nieveryfikowanemu tokenowi
    await performCriticalAction(session.user.id);
}
```

**Dobry wzorzec:**
```typescript
// getUser() weryfikuje token z serwerem
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
    return new Response('Unauthorized', { status: 401 });
}
await performCriticalAction(user.id);
```

---

## A08: Software and Data Integrity Failures

Brak weryfikacji integralnosci danych z zewnetrznych zrodel.

**Scenariusze w naszym stacku:**
- Stripe webhook bez weryfikacji sygnatury -- falszywe eventy
- Dane z zewnetrznych API uzywane bez walidacji Zod
- Brak SRI (Subresource Integrity) dla CDN scripts
- CI/CD pipeline bez weryfikacji artefaktow

**Checklist:**
- [ ] Stripe webhooks weryfikowane przez `constructEventAsync` z webhook secret
- [ ] Dane z zewnetrznych API walidowane Zod przed uzyciem
- [ ] CDN scripts maja atrybut `integrity` (SRI)
- [ ] Brak dynamicznego wykonywania kodu z user input (brak niebezpiecznych funkcji ewaluujacych)

**Zly wzorzec:**
```typescript
// Stripe webhook bez weryfikacji sygnatury
Deno.serve(async (req) => {
    const event = await req.json(); // Kazdy moze wyslac falszywy event
    if (event.type === 'checkout.session.completed') {
        await activateSubscription(event.data.object.customer);
    }
});
```

**Dobry wzorzec:**
```typescript
import Stripe from 'npm:stripe@17';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

Deno.serve(async (req) => {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    const event = await stripe.webhooks.constructEventAsync(
        body, signature, webhookSecret
    );

    if (event.type === 'checkout.session.completed') {
        await activateSubscription(event.data.object.customer);
    }
});
```

---

## A09: Security Logging and Monitoring Failures

Brak lub niewystarczajace logowanie zdarzen bezpieczenstwa.

**Scenariusze w naszym stacku:**
- Brak audit logu dla krytycznych operacji (usuniecie konta, zmiana uprawnien)
- PII w logach (email, IP, session tokens)
- `console.log` zamiast structured logging
- Brak alertow na podejrzane aktywnosci

**Checklist:**
- [ ] Audit log dla krytycznych operacji (lista w supabase-dev-guidelines)
- [ ] `logger.error()` zamiast `console.error()` na produkcji
- [ ] Logi NIE zawieraja: hasel, tokenow, pelnych obiektow sesji, PII
- [ ] Sentry skonfigurowany z `beforeSend` filtrujacym wrazliwe dane
- [ ] Failed login attempts logowane (Supabase robi to domyslnie)
- [ ] Edge Functions loguja bledy do Sentry (nie do console)

**Zly wzorzec:**
```typescript
// PII w logach
console.error('Login failed:', { email, password, ip: req.headers.get('x-forwarded-for') });

// Brak logowania krytycznej operacji
async function deleteUserAccount(userId: string) {
    await supabase.from('profiles').delete().eq('id', userId);
    // Brak wpisu w audit_log
}
```

**Dobry wzorzec:**
```typescript
// Bezpieczne logowanie
logger.error('Login failed', { userId: user?.id, errorCode: error.code });

// Krytyczna operacja z audit logiem
async function deleteUserAccount(userId: string) {
    // Audit log PRZED usunieciem (SECURITY DEFINER function)
    await supabase.rpc('delete_user_account');
    // Funkcja PostgreSQL loguje do audit_log i usuwa dane
}
```

---

## A10: Server-Side Request Forgery (SSRF)

Edge Functions fetchujace zasoby na podstawie URL od uzytkownika.

**Scenariusze w naszym stacku:**
- Edge Function pobierajaca dane z URL podanego przez uzytkownika
- Proxy endpoint bez walidacji docelowego adresu
- Fetch do wewnetrznych serwisow (metadata endpoint, localhost)

**Checklist:**
- [ ] Walidacja URL przed `fetch()` w Edge Functions
- [ ] Whitelist dozwolonych domen (jesli to mozliwe)
- [ ] Blokada adresow wewnetrznych: `localhost`, `127.0.0.1`, `169.254.169.254`, `10.*`, `172.16-31.*`, `192.168.*`
- [ ] Timeout na fetch requests
- [ ] Brak przekazywania wewnetrznych headerow (Authorization) do zewnetrznych URL

**Zly wzorzec:**
```typescript
// Fetch na URL od uzytkownika bez walidacji
Deno.serve(async (req) => {
    const { url } = await req.json();
    // Atakujacy moze podac: http://169.254.169.254/latest/meta-data/
    const response = await fetch(url);
    const data = await response.text();
    return new Response(data);
});
```

**Dobry wzorzec:**
```typescript
const ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com'];

function isUrlAllowed(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        if (url.protocol !== 'https:') return false;
        if (!ALLOWED_DOMAINS.includes(url.hostname)) return false;
        // Blokuj wewnetrzne adresy
        if (['localhost', '127.0.0.1'].includes(url.hostname)) return false;
        if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(url.hostname)) return false;
        return true;
    } catch {
        return false;
    }
}

Deno.serve(async (req) => {
    const { url } = await req.json();
    if (!isUrlAllowed(url)) {
        return new Response('Forbidden URL', { status: 403 });
    }
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return new Response(response.body);
});
```

---

## Podsumowanie

**Najwyzsze ryzyko w stacku React + Supabase + Edge Functions:**

| Priorytet | Kategoria | Glowne ryzyko |
|-----------|-----------|----------------|
| 1 | A01 Broken Access Control | RLS wylaczone lub bledne policies |
| 2 | A07 Auth Failures | `getSession()` zamiast `getUser()` server-side |
| 3 | A03 Injection | Raw SQL w `.rpc()`, XSS przez user content |
| 4 | A02 Cryptographic Failures | Service role key na froncie, secrets w kodzie |
| 5 | A08 Data Integrity | Stripe webhook bez weryfikacji sygnatury |

**Zobacz takze:**
- [auth-security-patterns.md](auth-security-patterns.md) -- Wzorce auth i bezpieczenstwa
