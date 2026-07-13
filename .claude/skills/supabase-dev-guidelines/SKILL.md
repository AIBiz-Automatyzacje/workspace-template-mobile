---
name: supabase-dev-guidelines
description: Auth (Google/Facebook OAuth, email), Database (PostgreSQL, RLS policies, SECURITY DEFINER), Edge Functions, Realtime subscriptions. Uzywaj przy pracy z autentykacja, baza danych, migracjami, bezpieczenstwem.
paths:
  - "supabase/**"
  - "**/*.sql"
  - "lib/**"
  - "hooks/**"
---

# Supabase Development Guidelines

## Cel

Kompleksowy przewodnik dla pracy z Supabase w aplikacjach Expo (React Native) - autentykacja, baza danych, RLS policies, Edge Functions i bezpieczeństwo.

## Kiedy Używać Tego Skilla

- Praca z autentykacją (login, rejestracja, OAuth)
- Tworzenie lub modyfikacja tabel bazy danych
- Pisanie RLS policies
- Tworzenie Edge Functions
- Migracje bazy danych
- Bezpieczeństwo i audit logging

---

## Quick Start

### Checklist Nowej Tabeli

- [ ] Utwórz tabelę w migracji SQL
- [ ] Włącz RLS: `ALTER TABLE tablename ENABLE ROW LEVEL SECURITY`
- [ ] Zdefiniuj RLS policies dla SELECT, INSERT, UPDATE, DELETE
- [ ] Używaj `(SELECT auth.uid())` w policies (nie email) — subquery dla wydajności
- [ ] Dodaj indeksy dla często używanych kolumn
- [ ] Wygeneruj typy: `supabase gen types typescript --local > src/types/database.ts`
- [ ] Utwórz funkcje API w `lib/supabase.ts`

### Checklist Edge Function

- [ ] Utwórz katalog `supabase/functions/function-name/`
- [ ] Użyj `Deno.serve()` (nie importuj serve)
- [ ] Importy: `jsr:@supabase/supabase-js@2`, `npm:stripe@22`
- [ ] CORS headers w `_shared/cors.ts`
- [ ] Zweryfikuj JWT jeśli wymagana autentykacja
- [ ] Loguj błędy (bez wrażliwych danych)
- [ ] Przetestuj lokalnie: `supabase functions serve`
- [ ] Deploy: `supabase functions deploy function-name`

### Checklist Bezpieczeństwa

- [ ] RLS włączony na każdej tabeli
- [ ] UUID (`auth.uid()`) w policies, nie email
- [ ] Audit log bez INSERT policy dla authenticated (tylko triggers/SECURITY DEFINER)
- [ ] `SET search_path = ''` (pusty) + w pełni kwalifikowane nazwy (`public.tabela`) w każdej funkcji SECURITY DEFINER
- [ ] Email enumeration protection włączone w Dashboard

---

## Klient Supabase

### Typed Client (Standard 2026)
```typescript
// lib/supabase.ts — pełna konfiguracja klienta (SecureStore, deep linking) w sekcji
// "Mobile (Expo / React Native)" niżej; tu tylko helper types.
import type { Database } from '@/types/database';

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];
```

### Generowanie Typów
```bash
# Z lokalnej bazy
supabase gen types typescript --local > src/types/database.ts

# Z produkcji
supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

### Podstawowe Operacje
```typescript
// SELECT
const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });

// INSERT
const { data, error } = await supabase
    .from('posts')
    .insert({ title, content, user_id: userId });

// UPDATE
const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: newName })
    .eq('id', userId);

// DELETE
const { data, error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('post_id', postId);

// RPC (wywołanie funkcji PostgreSQL)
const { data, error } = await supabase.rpc('ensure_user_profile');
```

---

## Topic Guides

### Autentykacja

**Dostępne metody:**
- OAuth (Google, Facebook, GitHub, Discord, etc.)
- Email/hasło

**Kluczowe Koncepcje:**
- PKCE wymaga jawnego `flowType: 'pkce'` przy `createClient` (implicit jest domyślny w `supabase-js`)
- Na mobile (deep link, `detectSessionInUrl: false`) wymiana kodu jest **zawsze jawna**:
  `exchangeCodeForSession(code)` albo `setSession({ access_token, refresh_token })` w callbacku —
  to jest poprawne dla natywnego flow (patrz sekcja Mobile niżej), inaczej niż w przeglądarce
- Hook `useAuth()` zarządza sesją
- Trigger `handle_new_user()` tworzy rekord w `public.profiles`
- Funkcja `ensure_user_profile()` jako fallback
- `getSession()` dla UI, `getUser()` lub `getClaims()` dla krytycznych operacji

> ⚠️ **resources/auth-patterns.md opisuje wzorce webowe (Vite SPA)** — react-router,
> `window.location.origin`, `localStorage`. Na mobile korzystaj z sekcji
> [„Mobile (Expo / React Native)"](#mobile-expo--react-native) niżej (deep linking +
> `WebBrowser.openAuthSessionAsync`), a resource traktuj jako materiał koncepcyjny do adaptacji.

**[Pełny Przewodnik (web/Vite SPA — wymaga adaptacji na mobile): resources/auth-patterns.md](resources/auth-patterns.md)**

---

### Baza Danych i RLS

**Wzorcowe Tabele:**
- `profiles` - dane użytkowników (1:1 z auth.users)
- `posts` - treści z własnością użytkownika
- `comments` - relacje do postów i użytkowników
- `bookmarks` - relacja many-to-many
- `audit_log` - logowanie krytycznych operacji (write-only)

**RLS Patterns:**
- Public read: `USING (true)`
- Own data: `USING ((SELECT auth.uid()) = user_id)`
- Conditional: `USING (published = true OR (SELECT auth.uid()) = user_id)`
- Service only: brak policies (tylko service_role)

**[Pełny Przewodnik: resources/database-patterns.md](resources/database-patterns.md)**

---

### Edge Functions

**Typowe Zastosowania:**
- Stripe Checkout / Webhooks
- Integracje z zewnętrznymi API
- Operacje wymagające service_role

**Wzorce 2026:**
- `Deno.serve()` (wbudowane, bez importu)
- `jsr:@supabase/supabase-js@2` (nie esm.sh)
- `npm:stripe@22` (nie esm.sh)
- `constructEventAsync` dla Stripe webhooks
- Runtime: **Deno 2.x** (upgrade z 1.45.2)
- `deno.json` preferowany nad import maps

**[Pełny Przewodnik: resources/edge-functions.md](resources/edge-functions.md)**

---

### Bezpieczeństwo

**Kluczowe Wzorce:**
- RLS dla izolacji danych
- UUID w policies (nie email - email jest mutowalny)
- SECURITY DEFINER dla uprawnionych operacji
- Audit log izolowany (bez INSERT dla authenticated)
- Logowanie przez triggers lub SECURITY DEFINER functions

**[Pełny Przewodnik: resources/security.md](resources/security.md)**

---

### Realtime (Opcjonalnie)

**Użycie:**
- Subscriptions dla zmian w tabelach
- Presence dla statusu użytkowników
- Broadcast dla custom events

**[Pełny Przewodnik: resources/realtime.md](resources/realtime.md)**

---

## Navigation Guide

| Potrzebujesz... | Przeczytaj |
|-----------------|------------|
| Autentykację OAuth/email | [auth-patterns.md](resources/auth-patterns.md) |
| Bazę danych i RLS | [database-patterns.md](resources/database-patterns.md) |
| Edge Functions | [edge-functions.md](resources/edge-functions.md) |
| Bezpieczeństwo | [security.md](resources/security.md) |
| Realtime subscriptions | [realtime.md](resources/realtime.md) |
| Supabase CLI | [cli-guide.md](resources/cli-guide.md) |

---

## Główne Zasady

1. **RLS Zawsze Włączony**: Każda tabela musi mieć RLS
2. **UUID w Policies**: `auth.uid() = user_id`, nigdy email
3. **Generated Types**: `supabase gen types` po każdej migracji
4. **SECURITY DEFINER Ostrożnie**: Zawsze `SET search_path = ''` (pusty) + w pełni kwalifikowane nazwy (`public.tabela`)
5. **Service Role Tylko w Edge Functions**: Nigdy nie eksponuj na froncie
6. **Audit Log Izolowany**: Wpisy tylko przez triggers/SECURITY DEFINER
7. **Logger dla Błędów**: `logger.error()` zamiast `console.error()`

---

## Zmienne Środowiskowe

### Klient (Expo)
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```
Prefix `EXPO_PUBLIC_` jest wymagany, żeby Expo zbundlował zmienną do klienta (patrz sekcja
Mobile niżej — `VITE_*` nie istnieje w tym środowisku, to pozostałość po szablonie webowym).

### Edge Functions
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...  # NIGDY nie commituj!
STRIPE_SECRET_KEY=...          # NIGDY nie commituj!
STRIPE_WEBHOOK_SECRET=...      # NIGDY nie commituj!
```

---

## Częste Błędy

### Unikaj
```typescript
// ❌ Service role na froncie
const supabase = createClient(url, SERVICE_ROLE_KEY);

// ❌ Email w RLS policy
USING (user_email = auth.email())  // Email może się zmienić!

// ❌ Brak typów
const { data } = await supabase.from('posts').select('*');  // data: any

// ❌ console.error w produkcji
console.error('DB error:', error);  // Wycieka info o strukturze DB

// ❌ Stary import w Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ❌ getSession() do autoryzacji server-side
const { data: { session } } = await supabase.auth.getSession();
if (session) { /* autoryzacja */ }  // Token nie jest zweryfikowany!
```

### Preferuj
```typescript
// ✅ Anon key na froncie
const supabase = createClient(url, ANON_KEY);

// ✅ UUID w RLS policy
USING (auth.uid() = user_id)  // UUID jest immutable

// ✅ Typed queries
const { data } = await supabase.from('posts').select('*');  // data: Tables[]

// ✅ Production-safe logger
logger.error('Błąd operacji', error);

// ✅ Nowy standard Edge Functions
Deno.serve(async (req) => { ... });

// ✅ getUser() lub getClaims() do autoryzacji
const { data: { user } } = await supabase.auth.getUser();
if (user) { /* autoryzacja */ }
```

---

## Mobile (Expo / React Native)

Specyfika Supabase w aplikacji mobilnej. Zapamiętaj: **server-side code → Edge Functions, NIE Expo API Routes** (Decyzja architektoniczna repo #3 — Edge Functions są bliżej bazy, mają natywną integrację z auth, jeden billing).

### Session persistence — `LargeSecureStore` (SecureStore + AsyncStorage), NIE `localStorage`

`localStorage` **nie istnieje** na natywie. Prosty adapter, który wrzuca całą sesję (JWT + refresh
token) bezpośrednio do `expo-secure-store`, **nie działa niezawodnie** — SecureStore odrzuca wartości
większe niż ok. 2048 bajtów, a sesja z JWT regularnie ten limit przekracza (cicha utrata sesji).
Oficjalny wzorzec Supabase to `LargeSecureStore`: 256-bitowy klucz AES trzymany w SecureStore
(mały, mieści się bez problemu), a nim zaszyfrowana sesja ląduje w `AsyncStorage` (bez limitu
rozmiaru). Wymaga dodatkowo `aes-js` i `react-native-get-random-values`:

```bash
npx expo install expo-secure-store @react-native-async-storage/async-storage
npm install aes-js react-native-get-random-values
```

```typescript
// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

// LargeSecureStore: klucz AES-256 w SecureStore (Keychain/Keystore),
// zaszyfrowana sesja w AsyncStorage — omija limit ~2048 B SecureStore.
class LargeSecureStore {
  private async _encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    // Klucz szyfrujący (mały) idzie do SecureStore — bezpiecznie mieści się w limicie
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async _decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return encryptionKeyHex;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1)
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return encrypted;
    }

    return await this._decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    // Sesja (potencjalnie > 2048 B) idzie zaszyfrowana do AsyncStorage — bez limitu rozmiaru
    const encrypted = await this._encrypt(key, value);

    await AsyncStorage.setItem(key, encrypted);
  }
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,  // mobile NIE używa URL detection
    },
  }
);
```

Źródło wzorca: [oficjalny tutorial Supabase dla Expo/React Native](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native?auth-store=secure-store).
`expo-secure-store` używa Keychain (iOS) / Keystore (Android) — klucz szyfrujący jest chroniony przez OS.
To jest **wymagane**, nie opcjonalne (kompromis na sesję = lekceważenie wymagań App Store / Play Store).

### AppState — auto-refresh tokena tylko gdy aplikacja jest aktywna

Bez podpięcia `AppState` autoRefreshToken próbuje odświeżać token nawet w tle, co marnuje baterię i
może kolidować z wybudzeniem aplikacji. Oficjalny quickstart RN Supabase startuje/zatrzymuje
auto-refresh na zmianach stanu aplikacji:

```typescript
// app/_layout.tsx (root, raz na cały cykl życia aplikacji)
import { AppState } from 'react-native';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => subscription.remove();
}, []);
```

### OAuth deep linking — schema `yourapp://`, NIE `https://`

Aplikacja mobilna nie ma URL-a, więc OAuth redirect musi iść na app scheme. W `app.json`:

```json
{
  "expo": {
    "scheme": "yourapp",
    "ios": { "bundleIdentifier": "com.example.yourapp" },
    "android": { "package": "com.example.yourapp" }
  }
}
```

Flow:

```typescript
// hooks/useGoogleAuth.ts
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

const redirectTo = makeRedirectUri({ scheme: 'yourapp', path: 'auth/callback' });
// → "yourapp://auth/callback"

const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo, skipBrowserRedirect: true },
});

if (data?.url) {
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success') {
    const { url } = result;
    const params = new URLSearchParams(url.split('#')[1]);
    await supabase.auth.setSession({
      access_token: params.get('access_token')!,
      refresh_token: params.get('refresh_token')!,
    });
  }
}
```

Konfiguracja dostawcy OAuth (Google Console / Supabase dashboard): dodaj `yourapp://auth/callback` jako Allowed redirect URL **obok** zwykłego `https://...supabase.co/auth/v1/callback`.

### Realtime lifecycle — AppState listener

Realtime socket rozłącza się gdy aplikacja idzie w background (system iOS/Android oszczędza baterii). Bez listenera channel zostanie offline po wakeup.

```typescript
// hooks/useRealtimeChannel.ts
import { AppState } from 'react-native';
import { useEffect } from 'react';

useEffect(() => {
  const channel = supabase.channel('messages')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, handleMessage)
    .subscribe();

  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      channel.subscribe();
    } else if (nextState === 'background') {
      channel.unsubscribe();
    }
  });

  return () => {
    channel.unsubscribe();
    subscription.remove();
  };
}, []);
```

### Offline-first — React Query persist do AsyncStorage

```typescript
// app/_layout.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}  // 24h
>
  {children}
</PersistQueryClientProvider>
```

Cache utrzymuje się po zamknięciu aplikacji — szybsze otwarcie + offline reads.

### Środowiskowe (env vars w Expo)

- **Klient (widoczne):** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Prefix `EXPO_PUBLIC_` jest wymagany żeby Expo zbundlował zmienną.
- **Server (Edge Functions):** `SUPABASE_SERVICE_ROLE_KEY` — TYLKO w `supabase/functions/<x>/`. NIGDY z prefiksem `EXPO_PUBLIC_*` (klient by zobaczył).

---

**Status Skilla**: Modułowa struktura z progressive loading dla optymalnego zarządzania kontekstem. Zaktualizowany do standardów Marzec 2026 + sekcja Mobile (Expo) maj 2026.
