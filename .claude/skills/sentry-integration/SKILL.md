---
name: sentry-integration
description: Sentry error tracking i performance monitoring dla React Native (Expo) + Supabase Edge Functions. Aktywuje się przy pracy z błędami, monitoringiem, captureException, error boundary, śledzeniem błędów, diagnostyką, loggerem, Edge Functions, crash, native crash, awaria, wydajność, raportowanie błędów, exception, wyjątek, React Native, Expo.
---

# Sentry Integration Guidelines

Kompleksowy przewodnik integracji Sentry error tracking i performance monitoring dla projektu React Native (Expo) + Supabase Edge Functions.

> **Stan SDK**
>
> - **React Native SDK:** `@sentry/react-native` 8.x (`Sentry.wrap`, `expoRouterIntegration`, `mobileReplayIntegration`) ✅
> - **Edge Functions:** `@sentry/deno` na Deno 2.x (`beforeSend` działa; SDK **NIE instrumentuje** `Deno.serve` i nie daje scope separation między requestami w tym samym isolate — tak mówi dokumentacja Supabase) ⚠️ — ustaw `defaultIntegrations: false`, używaj `withScope` dla izolacji i `await flush()` przed `Response`

## Table of Contents

- [Critical Rules](#critical-rules)
- [Dobre praktyki (Edge Functions / Supabase)](#dobre-praktyki-edge-functions--supabase)
- [Error Levels](#error-levels)
- [Quick Reference](#quick-reference)
- [Context Enrichment](#context-enrichment)
- [GDPR Compliance](#gdpr-compliance)
- [Checklist dla Nowego Kodu](#checklist-dla-nowego-kodu)
- [Common Mistakes](#common-mistakes)
- [Resources](#resources)

---

## Critical Rules

**NIGDY NIE ŁAMIESZ TYCH ZASAD:**

1. **ALL ERRORS MUST BE CAPTURED TO SENTRY** - w produkcji każdy błąd musi trafić do Sentry
2. **NIGDY `console.error` bez Sentry** - w Edge Functions każdy `console.error` musi mieć `captureError()`
3. **MASKUJ DANE OSOBOWE** - email musi być maskowany: `user@example.com` → `us***@example.com`
4. **NIE WYSYŁAJ WRAŻLIWYCH DANYCH** - hasła, tokeny, klucze API NIGDY nie trafiają do Sentry
5. **UŻYWAJ ODPOWIEDNICH POZIOMÓW** - `fatal` tylko dla krytycznych, `error` dla operacji

---

## Dobre praktyki (Edge Functions / Supabase)

`@sentry/deno` działa na Supabase Edge Runtime (Deno 2.x) i wspiera `beforeSend`, ale
**nie instrumentuje `Deno.serve`** — oficjalna dokumentacja Supabase mówi wprost, że SDK nie
zapewnia scope separation między requestami w tym samym isolate. Dlatego izolację kontekstu
trzeba robić ręcznie przez `withScope()`. Nadal stosuj:

| Zasada | Dlaczego |
|--------|----------|
| `defaultIntegrations: false` w `Sentry.init()` | Bezpieczny default, bo SDK i tak nie instrumentuje `Deno.serve` ani nie daje scope separation |
| Ustawiaj kontekst przez `Sentry.withScope()` | Izolacja per operacja; unikasz wycieku tagów między requestami |
| Nie ustawiaj globalnych tagów per-request | Globalny scope jest współdzielony w obrębie isolate'u |
| `await Sentry.flush()` przed `Response` | Isolate może zostać zamrożony zaraz po odpowiedzi |
| Maskuj PII w `beforeSend` | Jeden centralny punkt dla wszystkich zdarzeń |

**Zawsze używaj tego wzorca:**
```typescript
// ŹLE - kontekst wycieknie do innych requestów
Sentry.setTag('user_id', userId);
Sentry.captureException(error);

// DOBRZE - izolowany scope
Sentry.withScope((scope) => {
  scope.setTag('user_id', userId);
  Sentry.captureException(error);
});
```

Szczegóły: [edge-functions-sentry.md](resources/edge-functions-sentry.md)

---

## Error Levels

| Level | Kiedy używać | Przykład |
|-------|--------------|----------|
| `fatal` | System nie działa, wymaga natychmiastowej interwencji | Brak połączenia z bazą |
| `error` | Operacja nie powiodła się, użytkownik dotknięty | Płatność Stripe nie przeszła |
| `warning` | Problem odwracalny, nie wymaga natychmiastowej akcji | Retry po timeout |
| `info` | Informacje operacyjne | Użytkownik zalogowany |

---

## Quick Reference

### Mobile (React Native / Expo)

**Inicjalizacja w `app/_layout.tsx` (Expo Router root, `Sentry.wrap`):**
```typescript
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% — nie 1.0, patrz sekcja RN niżej
  integrations: [
    Sentry.expoRouterIntegration({
      enableTimeToInitialDisplay: !isRunningInExpoGo(),
    }),
  ],
});

function RootLayout() {
  // ...
}

export default Sentry.wrap(RootLayout);
```

**Użycie loggera (preferowane):**
```typescript
import { logger } from '@/lib/logger';
import { Alert } from 'react-native';

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operacja nie powiodła się', error);
  Alert.alert('Błąd', 'Wystąpił błąd. Spróbuj ponownie.');
}
```

**Bezpośrednie Sentry (gdy potrzeba więcej kontekstu):**
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.withScope((scope) => {
  scope.setTag('operation', 'payment');
  scope.setContext('order', { orderId: '123', amount: 100 });
  Sentry.captureException(error);
});
```

Pełny setup (plugin Expo, sourcemaps build+OTA, Session Replay, crash capture natywny vs Expo Go) —
sekcja [React Native (Expo)](#react-native-expo) niżej i
[react-native-sentry-patterns.md](resources/react-native-sentry-patterns.md).

### Edge Functions (Deno)

**Każda funkcja MUSI mieć Sentry z `withScope`:**
```typescript
import { initSentry, captureError } from '../_shared/sentry.ts';

const Sentry = initSentry('function-name');

// WAŻNE: Deno.serve zamiast serve z deno.land/std
Deno.serve(async (req) => {
  try {
    // logika
  } catch (error) {
    // ZAWSZE używaj captureError (używa withScope wewnętrznie)
    captureError(error, {
      operation: 'checkout',
      user_id: userId  // NIE user_email (GDPR)
    });
    return new Response(JSON.stringify({ error: 'Error' }), { status: 500 });
  }
});
```

---

## Context Enrichment

**ZAWSZE dodawaj kontekst do błędów:**

```typescript
// DOBRZE - bogaty kontekst
Sentry.withScope((scope) => {
  scope.setUser({ id: userId, email: maskedEmail });
  scope.setTag('service', 'payments');
  scope.setTag('endpoint', '/checkout');
  scope.setContext('operation', {
    type: 'stripe_checkout',
    sessionId: session.id,
    amount: amount
  });
  scope.addBreadcrumb({
    category: 'payment',
    message: 'Starting checkout',
    level: 'info'
  });
  Sentry.captureException(error);
});

// ŹLE - brak kontekstu
Sentry.captureException(error); // Skąd? Co? Dla kogo?
```

---

## GDPR Compliance

**Maskowanie emaili - OBOWIĄZKOWE:**

```typescript
// W beforeSend
beforeSend(event) {
  if (event.user?.email) {
    event.user.email = event.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
  }
  return event;
}

// W setSentryUser
export function setSentryUser(user: { id: string; email: string } | null) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    });
  } else {
    Sentry.setUser(null);
  }
}
```

---

## Checklist dla Nowego Kodu

Przed każdym PR sprawdź:

- [ ] Zaimportowano Sentry lub odpowiedni helper
- [ ] Wszystkie bloki try/catch wysyłają do Sentry
- [ ] Dodano znaczący kontekst (tagi, breadcrumbs)
- [ ] Użyto odpowiedniego poziomu błędu
- [ ] Brak wrażliwych danych w event (hasła, tokeny)
- [ ] Email użytkownika jest maskowany
- [ ] Przetestowano ścieżki błędów

---

## Common Mistakes

**NIE RÓB:**
```typescript
// Połykanie błędów
try {
  await operation();
} catch (error) {
  // nic - użytkownik nie wie, my nie wiemy
}

// console.error bez Sentry
} catch (error) {
  console.error('Error:', error); // W produkcji nikt nie widzi!
}

// Wrażliwe dane
Sentry.setContext('auth', { token: userToken }); // NIE!
```

**RÓB:**
```typescript
// Zawsze capture + informacja dla użytkownika
try {
  await operation();
} catch (error) {
  logger.error('Operacja nie powiodła się', error);
  Alert.alert('Błąd', 'Wystąpił błąd. Spróbuj ponownie.');
}

// Bezpieczny kontekst
Sentry.setContext('auth', {
  userId: user.id,
  provider: 'google' // OK - nie wrażliwe
});
```

---

## React Native (Expo)

Sentry w aplikacji mobilnej ma inny SDK, inny sourcemaps flow i inną integrację z routingiem niż web.

### Setup `@sentry/react-native` (NIE `@sentry/react`)

```bash
bunx expo install @sentry/react-native
```

W `app.json` dodaj plugin Sentry żeby sourcemaps były automatycznie uploadowane przy `eas build`:

```json
{
  "expo": {
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "organization": "your-org",
          "project": "your-project",
          "url": "https://sentry.io/"
        }
      ]
    ]
  }
}
```

### Inicjalizacja w `app/_layout.tsx` (Expo Router root)

Kanoniczna integracja nawigacji dla Expo Router to `Sentry.expoRouterIntegration()` — czyta
wewnętrzny navigation ref Expo Router sama, **bez** ręcznego `useNavigationContainerRef` +
`registerNavigationContainer` (to był wzorzec dla `reactNavigationIntegration`, nieaktualny
dla tego szablonu). Źródło: https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/

```typescript
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNative: !isRunningInExpoGo(),  // crashy native — tylko w dev clients/preview/release
  tracesSampleRate: 0.1, // 10% transakcji — 1.0 tylko tymczasowo w dev do debugowania
  integrations: [
    Sentry.expoRouterIntegration({
      enableTimeToInitialDisplay: !isRunningInExpoGo(), // niewspierane w Expo Go
    }),
  ],
});

function RootLayout() {
  // ...
}

export default Sentry.wrap(RootLayout);
```

`enableAutoSessionTracking` nie jest tu potrzebne — sesje (release health) są włączone
domyślnie w `@sentry/react-native` od dawna, jawne ustawienie na `true` jest redundantne.

### Sourcemaps przez EAS Build

Plugin Sentry (skonfigurowany powyżej) automatycznie uploaduje sourcemaps **i debug symbole**
(dSYM na iOS, ProGuard/NDK mapping na Android) przy każdym `eas build` na podstawie
`SENTRY_AUTH_TOKEN` w EAS env:

```bash
eas env:create --name SENTRY_AUTH_TOKEN --value "$TOKEN" --visibility secret --environment production
```

Powtórz z `--environment preview` jeśli chcesz auto-upload też dla buildów preview.
`eas secret:create` jest nieaktualne — eas-cli ma dziś tylko rodzinę `eas env:*`.

**Bez tokena:** stack traces w Sentry pokażą minified bundle (nieczytelny). Token jest wymagany dla każdego release/preview profilu.

### Sourcemaps przy EAS Update (OTA)

Auto-upload z pluginu działa tylko przy natywnym `eas build` — **OTA update (`eas update`) go nie
wyzwala**. Po każdym OTA update wgraj sourcemapy ręcznie:

```bash
eas update --branch production
npx sentry-expo-upload-sourcemaps dist
```

Bez tego kroku crashe zgłoszone po OTA update pokażą zminifikowany stack trace mimo poprawnie
skonfigurowanego pluginu.

### Session Replay (Mobile)

Wymaga `@sentry/react-native >= 6.5.0`. Nagrywa sesje jako sekwencję klatek do diagnozy "co user
widział przed crashem" — dodaj `Sentry.mobileReplayIntegration()`:

```typescript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  replaysSessionSampleRate: 0.1, // 10% normalnych sesji
  replaysOnErrorSampleRate: 1.0, // 100% sesji z błędem
  integrations: [
    Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() }),
    Sentry.mobileReplayIntegration(),
  ],
});
```

**GDPR:** maskowanie tekstu, obrazów i webview jest **domyślnie włączone** (agresywne). Wyłączaj
tylko selektywnie (`maskAllText: false` itp.) i tylko dla ekranów bez PII — spójnie z maskowaniem
emaili z sekcji [GDPR Compliance](#gdpr-compliance).

### Crash capture — JS errors + native crashes

`@sentry/react-native` łapie:
- **JS errors:** automatycznie (przez globalErrorHandler)
- **Native crashes (iOS Swift / Android Kotlin):** automatycznie pod warunkiem `enableNative: true` i build z dev-client / preview / release. Expo Go **nie raportuje** native crashy (sandbox).
- **ANR (Application Not Responding) Android:** wbudowane od `@sentry/react-native@5+`
- **Promise rejections:** automatycznie

### Navigation breadcrumbs

`expoRouterIntegration` automatycznie loguje każdą zmianę route jako breadcrumb. W panelu Sentry zobaczysz: `Login → Dashboard → Settings → [crash]`. Krytyczne dla diagnozy "co user robił przed crashem".

### Mobile-specific context

```typescript
import * as Device from 'expo-device';
import * as Application from 'expo-application';

Sentry.setContext('device', {
  model: Device.modelName,                          // np. "iPhone 15 Pro"
  osName: Device.osName,                            // "iOS" / "Android"
  osVersion: Device.osVersion,                      // "18.0"
  appVersion: Application.nativeApplicationVersion, // "1.2.3"
  buildNumber: Application.nativeBuildVersion,      // "42"
});
```

To pomaga filtrować w Sentry per-platform / per-version.

---

## Resources

Szczegółowe wzorce znajdują się w:

- **[react-native-sentry-patterns.md](resources/react-native-sentry-patterns.md)** - Pełna konfiguracja `@sentry/react-native` dla tego szablonu: init, `Sentry.wrap`, expoRouterIntegration, mobileReplayIntegration, error boundary RN, native crashe vs Expo Go, sourcemaps (build + OTA), debug symbole, GDPR
- **[react-sentry-patterns.md](resources/react-sentry-patterns.md)** - ⚠️ TYLKO web (React + Vite) — zostaje jako referencja, nie dla tego szablonu mobile
- **[edge-functions-sentry.md](resources/edge-functions-sentry.md)** - Wzorce dla Supabase Edge Functions (Deno), shared helpers, Stripe tracking

---

**Skill Status**: COMPLETE + sekcja React Native (Expo) zaktualizowana lipiec 2026 (expoRouterIntegration, mobileReplayIntegration, eas env:*, OTA sourcemaps)
**Progressive Disclosure**: Szczegółowe wzorce w plikach `resources/`
