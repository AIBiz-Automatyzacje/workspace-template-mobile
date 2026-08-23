# Edge Functions

Wzorce dla Supabase Edge Functions - Deno runtime, autentykacja, CORS, Stripe.

---

## Kontrakt handlera (2026)

Supabase **wycofało `Deno.serve()`** jako wzorzec dla Edge Functions. Obowiązujący kontrakt to
`export default` z metodą `fetch`, owinięty w `withSupabase` z `npm:@supabase/server@^1`:

```typescript
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        const { data, error } = await ctx.supabase.from('countries').select('*');
        if (error) throw error;
        return Response.json({ data });
    }),
};
```

Jeden wrapper daje cztery rzeczy, których wcześniej trzeba było pisać ręcznie:

| Co załatwia `withSupabase` | Czego już NIE piszesz |
|---|---|
| Autentykacja — weryfikuje poświadczenia wywołującego | ręczne `getUser()` / `getClaims()` na `Authorization` |
| Autoryzacja — przepuszcza tylko tryb `auth`, który zadeklarujesz | `if (!authHeader) throw ...` |
| Gotowe klienty na `ctx` (`ctx.supabase` RLS-scoped, `ctx.supabaseAdmin` omija RLS) | `createClient(url, key, { global: { headers } })` |
| CORS — preflight `OPTIONS` + nagłówki na **wszystkich** odpowiedziach | `_shared/cors.ts`, `...corsHeaders` przy każdej odpowiedzi |

Handler uruchamia się **wyłącznie** po udanej autentykacji. Gdy auth zawiedzie, `withSupabase` sam
zwraca `{ message, code }` z właściwym statusem (401/500) i nagłówkami CORS.

Ten sam kontrakt (`export default { fetch }`) działa bez zmian na Cloudflare Workers i Bun.

### Struktura Katalogów
```
supabase/functions/
├── _shared/                 # Współdzielone utilsy (import relatywny)
│   └── validation.ts
├── create-checkout-session/
│   └── index.ts
├── create-billing-portal-session/
│   └── index.ts
└── stripe-webhook/
    └── index.ts
```

> `_shared/cors.ts` **nie jest już potrzebny** — CORS obsługuje `withSupabase`. Katalog `_shared`
> zostaje dla realnie współdzielonej logiki (walidacja, mapowanie błędów). Nigdy nie rób
> cross-importów między samymi Edge Functions.

### Podstawowy Szablon (2026)
```typescript
// supabase/functions/my-function/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        try {
            // ctx.supabase jest już scope'owany do RLS wywołującego użytkownika
            const result = await processRequest(req, ctx.supabase);

            return Response.json(result);
        } catch (error) {
            // Widoczne w Supabase Dashboard > Logs
            console.error('Function error:', error);

            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 400 });
        }
    }),
};
```

`Response.json()` to Web API — nie potrzeba już `new Response(JSON.stringify(...))` z ręcznym
`Content-Type`, a nagłówki CORS dokłada wrapper.

---

## Importy (2026)

### Preferowane Źródła
```typescript
// Wrapper handlera — domyślny import w KAŻDEJ Edge Function
import { withSupabase } from 'npm:@supabase/server@^1';

// Supabase SDK - npm: jest rekomendowane w docs Supabase ("NPM packages (recommended)");
// jsr:@supabase/supabase-js@2 to działająca alternatywa, ale nie ta polecana w docs.
// Bezpośredni createClient potrzebny TYLKO poza withSupabase (klienty masz na ctx).
import { createClient } from 'npm:@supabase/supabase-js@2';

// Stripe - użyj npm:
import Stripe from 'npm:stripe@22';

// Inne pakiety npm
import { z } from 'npm:zod@4';

// Deno std (jeśli potrzebne)
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
```

### Dlaczego npm:/jsr: zamiast esm.sh?

| Źródło | Status 2026 | Użycie |
|--------|-------------|--------|
| `npm:` | ✅ Rekomendowane | Pakiety npm, w tym `@supabase/supabase-js` |
| `jsr:` | ✅ Działająca alternatywa | Pakiety Deno-native; `@supabase/supabase-js` też działa przez jsr:, ale docs Supabase polecają npm: |
| `esm.sh` | ⚠️ Legacy | Tylko gdy jsr/npm nie działa |
| `deno.land/x` | ❌ Deprecated | Migruj do jsr:/npm: |
| `deno.land/std/http/server.ts` | ❌ Zakazane | `import { serve }` — wzorzec sprzed `export default { fetch }` |

Zasady importów z oficjalnych wytycznych Supabase: **żadnych bare specifiers** (zawsze prefiks
`npm:` / `jsr:` / `node:`), **zawsze wersja** (`npm:express@4.18.2`, nie `npm:express`).

### Konfiguracja `deno.json` (Preferowane)

Od Deno 2.x, `deno.json` jest preferowany nad import maps. Jeśli oba istnieją, `deno.json` ma pierwszeństwo.

```json
// supabase/functions/deno.json
{
  "imports": {
    "@supabase/server": "npm:@supabase/server@^1",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "stripe": "npm:stripe@22"
  }
}
```

Z `deno.json` importy w kodzie są czystsze:
```typescript
import { withSupabase } from '@supabase/server';
import Stripe from 'stripe';
```

---

## Autentykacja i autoryzacja (tryby `auth`)

Weryfikacja JWT nie jest już zadaniem kodu funkcji — robi ją `withSupabase`. Twoja jedyna decyzja to
**tryb `auth`**, dobrany po tym, KTO woła funkcję:

| Wywołujący | `auth` | `verify_jwt` | Klient do użycia |
|---|---|---|---|
| Zalogowany użytkownik (JWT w `Authorization`) | `'user'` | `true` (domyślne, pomiń) | `ctx.supabase` (RLS wg usera) |
| Cron, worker, `pg_net`, inna funkcja | `'secret'` | `false` | `ctx.supabaseAdmin` (omija RLS) |
| Klient publiczny przed logowaniem | `'publishable'` | `false` | `ctx.supabase` (anon, RLS działa) |
| Publiczny endpoint / webhook zewnętrzny (weryfikacja w kodzie) | `'none'` | `false` | `ctx.supabaseAdmin` jeśli potrzebny |

Dla **każdego trybu innego niż `'user'`** wyłącz platformową bramkę JWT w `supabase/config.toml` —
inaczej platforma odrzuci request, zanim dojdzie do funkcji:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

Warianty: `auth: 'secret:cron'` / `auth: 'publishable:web_app'` przyjmują tylko konkretny nazwany
klucz (rotacja bez ruszania innych serwisów), `auth: 'secret:*'` dowolny z zestawu, a tablica
`auth: ['user', 'secret']` przepuszcza oba — pierwszy pasujący wygrywa (brak poświadczeń spada do
kolejnego trybu, ale obecny-a-niepoprawny JWT odrzuca request, bez cichego downgrade'u).

### Kontekst `ctx`

```typescript
interface SupabaseContext {
    supabase: SupabaseClient;       // RLS-scoped (user albo anon, zależnie od trybu)
    supabaseAdmin: SupabaseClient;  // omija RLS (secret key)
    userClaims: UserClaims | null;  // tożsamość z JWT: { id, role?, email?, appMetadata?, userMetadata? }
    jwtClaims: JWTClaims | null;    // pełne claimy JWT (sub, exp, iat, ...)
    authMode: AuthMode;             // który tryb dopasował request
    authKeyName?: string;           // nazwa użytego klucza API (brak dla 'user' / 'none')
}
```

`ctx.supabase` to zawsze klient bezpieczny — respektuje RLS. `ctx.supabaseAdmin` zawsze RLS omija,
więc sięgaj po niego tylko tam, gdzie naprawdę potrzeba pełnego dostępu (webhooki, crony).

`ctx.userClaims.id` wystarcza do identyfikacji użytkownika — **nie wołaj `getUser()` tylko po UUID**
(to zbędny round-trip do serwera Auth). Pełny obiekt `User` (metadane, telefon, identities) pobierz
przez `ctx.supabase.auth.getUser()` dopiero gdy realnie go potrzebujesz.

> **Autoryzacja ról:** nigdy po `userMetadata` — to pole jest edytowalne przez samego użytkownika
> (`supabase.auth.updateUser`). Rolę czytaj z `appMetadata` albo z dedykowanej tabeli ról.

```typescript
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        // Tożsamość jest już zweryfikowana — handler nie odpali się bez ważnego JWT
        const userId = ctx.userClaims!.id;

        const { data, error } = await ctx.supabase
            .from('orders')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return Response.json({ data });
    }),
};
```

### Własny format błędu — `createSupabaseContext`

`withSupabase` sam odpowiada `{ message, code }` przy błędzie auth. Gdy potrzebujesz innego kształtu
odpowiedzi (np. ustandaryzowane `{ data, error: { code, message } }` z reguł projektu), użyj
`createSupabaseContext` — te same weryfikacje, ale w formie result tuple:

```typescript
import { createSupabaseContext } from 'npm:@supabase/server@^1';

export default {
    fetch: async (req: Request) => {
        const { data: ctx, error } = await createSupabaseContext(req, { auth: 'user' });

        if (error) {
            return Response.json(
                { data: null, error: { code: error.code, message: error.message } },
                { status: error.status }
            );
        }

        const { data } = await ctx!.supabase.from('orders').select('*');
        return Response.json({ data, error: null });
    },
};
```

Uwaga: ta ścieżka **nie dokłada nagłówków CORS** — obsłuż je sam albo wróć do `withSupabase`.

---

## Przykład: Stripe Checkout

> **`apiVersion` MUSI równać się wersji pinowanej przez zainstalowany major SDK.** W stripe-node typ
> `apiVersion` to `LatestApiVersion` — literal jednej konkretnej wersji, nie dowolny string. Podanie
> starszej wartości to **błąd typów w `deno check`/TS**, nie ostrzeżenie. Wartości poniżej odpowiadają
> `npm:stripe@22` (22.5.0 pinuje `'2026-07-29.dahlia'`). Po każdym podbiciu majora sprawdź
> `Stripe.LatestApiVersion` (albo `src/apiVersion.ts` w tagu wydania) i zsynchronizuj oba miejsca
> w tym pliku — inaczej przykłady przestaną się kompilować.

### create-checkout-session
```typescript
// supabase/functions/create-checkout-session/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';
import Stripe from 'npm:stripe@22';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2026-07-29.dahlia',
});

// auth: 'user' — handler odpali się tylko z ważnym JWT zalogowanego użytkownika.
// verify_jwt zostaje domyślnie true, więc config.toml bez zmian.
export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        try {
            // Tożsamość zweryfikowana przez wrapper — bez ręcznego getUser()
            const { id: userId, email } = ctx.userClaims!;

            // Pobierz dane z body
            const { priceId, successUrl, cancelUrl } = await req.json();

            // Utwórz sesję Stripe Checkout
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card', 'blik', 'p24'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                success_url: successUrl,
                cancel_url: cancelUrl,
                customer_email: email,
                metadata: {
                    user_id: userId,
                    user_email: email ?? '',
                },
            });

            return Response.json({ sessionId: session.id, url: session.url });
        } catch (error) {
            console.error('Checkout error:', error);

            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 400 });
        }
    }),
};
```

---

## Przykład: Stripe Webhook

### stripe-webhook
```typescript
// supabase/functions/stripe-webhook/index.ts
import { withSupabase } from 'npm:@supabase/server@^1';
import Stripe from 'npm:stripe@22';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2026-07-29.dahlia',
});
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

// auth: 'none' — Stripe nie ma JWT Supabase. Zaufanie budujemy WYŁĄCZNIE na
// podpisie webhooka (constructEventAsync) weryfikowanym w kodzie niżej.
// cors: 'disabled' — wywołanie server-to-server, przeglądarka tu nie zagląda.
export default {
    fetch: withSupabase({ auth: 'none', cors: 'disabled' }, async (req, ctx) => {
        try {
            const body = await req.text();
            const signature = req.headers.get('stripe-signature');

            if (!signature) {
                throw new Error('Missing signature');
            }

            // Weryfikuj sygnaturę webhook — to jest tu jedyna autentykacja
            const event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                webhookSecret
            );

            // ctx.supabaseAdmin omija RLS — bez ręcznego createClient z service key
            const supabase = ctx.supabaseAdmin;

            // Obsłuż event
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    // Dopasowanie po UUID z metadata (ustawionym przy tworzeniu
                    // sesji), NIGDY po email — email jest mutowalny.
                    const userId = session.metadata?.user_id;
                    const customerId = session.customer as string;

                    if (!userId) {
                        throw new Error('Missing user_id in session metadata');
                    }

                    // Aktywuj dostęp
                    await supabase
                        .from('users')
                        .update({
                            paid: true,
                            stripe_customer_id: customerId,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', userId);

                    // Zapisz płatność
                    await supabase
                        .from('payments')
                        .insert({
                            user_id: userId,
                            stripe_payment_intent_id: session.payment_intent as string,
                            stripe_customer_id: customerId,
                            amount: session.amount_total ?? 0,
                            currency: session.currency ?? 'pln',
                            status: 'succeeded',
                            metadata: { session_id: session.id },
                        });

                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const customerId = subscription.customer as string;

                    // Deaktywuj dostęp
                    await supabase
                        .from('users')
                        .update({
                            paid: false,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('stripe_customer_id', customerId);

                    break;
                }
            }

            return Response.json({ received: true });
        } catch (error) {
            console.error('Webhook error:', error);

            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 400 });
        }
    }),
};
```

**Wymagany wpis w `supabase/config.toml`** — bez niego platforma odrzuci request Stripe'a
(brak JWT) zanim funkcja się uruchomi:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

**Uwaga:** Webhook nie używa CORS (`cors: 'disabled'`) - jest wywoływany przez Stripe server-to-server.

---

## Wywołanie Edge Function z Frontend

### Użycie supabase.functions.invoke (Expo / React Native)

Mobile nie ma `window` ani `import.meta.env` — Stripe Checkout otwieramy w in-app browserze
(`expo-web-browser`), a `successUrl`/`cancelUrl` muszą wskazywać na deep link aplikacji
(`yourapp://...`), nie na `window.location.origin` (nie istnieje na natywie).

```typescript
// lib/stripe.ts
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export async function redirectToCheckout() {
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
            priceId: process.env.EXPO_PUBLIC_STRIPE_PRICE_ID,
            // Deep linki app scheme — Stripe po zakończeniu checkoutu
            // przekierowuje z powrotem do aplikacji, nie do przeglądarki
            successUrl: 'yourapp://checkout/success',
            cancelUrl: 'yourapp://checkout/cancel',
        },
    });

    if (error) {
        throw error;
    }

    // Otwórz Stripe Checkout w in-app browserze (SFSafariViewController / Custom Tabs)
    await WebBrowser.openBrowserAsync(data.url);
}

export async function redirectToBillingPortal() {
    const { data, error } = await supabase.functions.invoke('create-billing-portal-session', {
        body: {
            returnUrl: 'yourapp://settings/billing',
        },
    });

    if (error) {
        throw error;
    }

    await WebBrowser.openBrowserAsync(data.url);
}
```

---

## Zmienne Środowiskowe

### Ustawianie Secrets
```bash
# Przez CLI
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Lista secrets
supabase secrets list

# Lub przez Supabase Dashboard:
# Project Settings > Edge Functions > Secrets
```

### Dostęp w Funkcji

Kluczy Supabase **nie czytaj ręcznie** — `withSupabase` sam je rozwiązuje i wstrzykuje do
`ctx.supabase` / `ctx.supabaseAdmin`. Poniższe zmienne są pre-populowane w środowisku lokalnym
i hostowanym; użytkownik nie musi ich ustawiać:

| Zmienna | Format | Opis |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | URL projektu |
| `SUPABASE_PUBLISHABLE_KEYS` | `{"default":"sb_publishable_..."}` | Mapa nazwanych kluczy publishable (JSON) |
| `SUPABASE_SECRET_KEYS` | `{"default":"sb_secret_..."}` | Mapa nazwanych kluczy secret (JSON) |
| `SUPABASE_DB_URL` | connection string | Bezpośrednie połączenie do Postgresa |

```typescript
// Gdy MUSISZ sięgnąć po klucz poza SDK — to mapa JSON, nie goły string
const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!);
const secretKey = SUPABASE_SECRET_KEYS['default'];

// Custom secrets (ustawione przez `supabase secrets set`)
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
```

> Stare `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` to poprzednia generacja kluczy. Nowy
> model to nazwane klucze publishable/secret w mapach JSON — dlatego rotacja klucza dla jednego
> serwisu (`auth: 'secret:cron'`) nie rusza pozostałych.

---

## Lokalne Testowanie

### Uruchomienie Funkcji
```bash
# Uruchom wszystkie funkcje
supabase functions serve

# Uruchom konkretną funkcję
supabase functions serve create-checkout-session

# Z env file
supabase functions serve --env-file .env.local

# Z debugowaniem
supabase functions serve --debug
```

### Testowanie z curl
```bash
# Test funkcji z JWT
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/create-checkout-session' \
  --header 'Authorization: Bearer <JWT_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"priceId": "price_..."}'

# Test webhook (bez auth)
curl -i --location --request POST \
  'http://localhost:54321/functions/v1/stripe-webhook' \
  --header 'Content-Type: application/json' \
  --header 'stripe-signature: <SIGNATURE>' \
  --data '{"type": "checkout.session.completed", ...}'
```

### Stripe CLI dla Webhooków
```bash
# Przekieruj webhooki lokalnie
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Wyślij test event
stripe trigger checkout.session.completed
```

---

## Deploy

### Deploy Pojedynczej Funkcji
```bash
supabase functions deploy create-checkout-session
```

### Deploy Wszystkich Funkcji
```bash
supabase functions deploy
```

### Weryfikacja
```bash
# Lista deployowanych funkcji
supabase functions list
```

---

## Error Handling

### Standardowy Pattern
```typescript
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
        // Błędy auth (401/500) obsługuje wrapper ZANIM handler wystartuje —
        // tu zostają wyłącznie błędy logiki biznesowej.
        try {
            // Walidacja input na granicy funkcji
            const body = await req.json();

            if (!body.priceId) {
                return Response.json({ error: 'Missing priceId' }, { status: 400 });
            }

            // Logika...
            const result = await process(body, ctx.supabase);

            return Response.json(result);
        } catch (error) {
            // Loguj pełny błąd (widoczny w Supabase Dashboard > Logs)
            console.error('Function error:', error);

            // Zwróć bezpieczną wiadomość
            const message = error instanceof Error ? error.message : 'Internal error';
            return Response.json({ error: message }, { status: 500 });
        }
    }),
};
```

### Błędy z `withSupabase`

Gdy autentykacja zawiedzie, wrapper odpowiada sam — handler się nie uruchamia:

```json
{ "message": "Invalid credentials", "code": "INVALID_CREDENTIALS" }
```

| Klasa | Kod | Status | Znaczenie |
|---|---|---|---|
| `AuthError` | `INVALID_CREDENTIALS` | 401 | Brak poświadczeń pasujących do trybu `auth` albo JWT nie przeszedł weryfikacji |
| `AuthError` | `CREATE_SUPABASE_CLIENT_ERROR` | 500 | Auth OK, ale nie udało się stworzyć klienta |
| `EnvError` | `MISSING_SUPABASE_URL`, `MISSING_DEFAULT_SECRET_KEY`, ... | 500 | Brakująca/uszkodzona zmienna środowiskowa (błąd konfiguracji, nie klienta) |

Chcesz własny kształt odpowiedzi błędu — użyj `createSupabaseContext` (sekcja
„Autentykacja i autoryzacja").

---

## Podsumowanie

**Checklist Edge Function (2026):**
- [ ] `export default { fetch: withSupabase({ auth }, handler) }` — NIGDY `Deno.serve()`
- [ ] Dobierz tryb `auth` do wywołującego (`user` / `secret` / `publishable` / `none`)
- [ ] Tryb inny niż `'user'` → `verify_jwt = false` w `supabase/config.toml`
- [ ] Importy z wersją: `npm:@supabase/server@^1`, `npm:stripe@22` (bez bare specifiers)
- [ ] Klienty z `ctx` — `ctx.supabase` domyślnie, `ctx.supabaseAdmin` tylko gdy trzeba ominąć RLS
- [ ] CORS zostaw wrapperowi (`cors: 'disabled'` dla webhooków server-to-server)
- [ ] Waliduj input na granicy funkcji (Zod)
- [ ] Loguj błędy (widoczne w Dashboard > Logs)
- [ ] Zwracaj odpowiednie kody statusu przez `Response.json(..., { status })`
- [ ] Ustaw secrets przez CLI lub Dashboard
- [ ] Zapis plików tylko do `/tmp`; długie taski przez `EdgeRuntime.waitUntil()`
- [ ] Testuj lokalnie przed deployem

**Migracja ze Starego Kodu:**
```typescript
// ❌ NAJSTARSZY (Deno 1.x era)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
serve(async (req) => { ... });

// ❌ PRZESTARZAŁY (Deno.serve — wycofany przez Supabase)
import { createClient } from 'jsr:@supabase/supabase-js@2';
Deno.serve(async (req) => { ... });

// ✅ AKTUALNY kontrakt
import { withSupabase } from 'npm:@supabase/server@^1';

export default {
    fetch: withSupabase({ auth: 'user' }, async (req, ctx) => { ... }),
};
```

Co znika przy migracji: `_shared/cors.ts` i rozsypane `...corsHeaders`, gałąź
`if (req.method === 'OPTIONS')`, ręczne `createClient(...)` z `Authorization`/service key,
ręczne `getUser()`/`getClaims()` do samej weryfikacji tokenu.

**Zobacz Także:**
- [auth-patterns.md](auth-patterns.md) - Autentykacja po stronie klienta
- [security.md](security.md) - Service role