---
name: sentry-integration
description: Sentry error tracking i performance monitoring dla React + Supabase Edge Functions. Aktywuje się przy pracy z błędami, monitoringiem, captureException, error boundary, śledzeniem błędów, diagnostyką, loggerem, Edge Functions, crash, awaria, wydajność, raportowanie błędów, exception, wyjątek.
---

# Sentry Integration Guidelines

Kompleksowy przewodnik integracji Sentry error tracking i performance monitoring dla projektu React + Supabase Edge Functions.

> **📅 Ostatnia aktualizacja: Marzec 2026**
>
> - **React SDK:** v10+ (funkcyjne integracje, React 19 error hooks) ✅
> - **Edge Functions:** Ograniczone wsparcie ⚠️ (wymaga `withScope` + `flush`)

## Table of Contents

- [Critical Rules](#critical-rules)
- [Known Limitations](#known-limitations)
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

## Known Limitations

### Edge Functions (Supabase)

⚠️ **Sentry Deno SDK ma ograniczenia:**

| Problem | Przyczyna | Rozwiązanie |
|---------|-----------|-------------|
| Brak izolacji scope między requestami | SDK nie wspiera `Deno.serve` instrumentation | Zawsze używaj `Sentry.withScope()` |
| Wymagana wersja Deno 2.0+ | Supabase używa Deno 1.45.2 | Używaj `defaultIntegrations: false` |
| Kontekst współdzielony | Runtime reużywany między requestami | Nie ustawiaj globalnych tagów per-request |

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

### Frontend (React)

**Inicjalizacja w `main.tsx`:**
```typescript
import { initSentry } from '@/lib/sentry';
import * as Sentry from '@sentry/react';

initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <AppWrapper />
  </Sentry.ErrorBoundary>
);
```

**Użycie loggera (preferowane):**
```typescript
import { logger } from '@/lib/logger';

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operacja nie powiodła się', error);
  toast.error('Wystąpił błąd');
}
```

**Bezpośrednie Sentry (gdy potrzeba więcej kontekstu):**
```typescript
import * as Sentry from '@sentry/react';

Sentry.withScope((scope) => {
  scope.setTag('operation', 'payment');
  scope.setContext('order', { orderId: '123', amount: 100 });
  Sentry.captureException(error);
});
```

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
  toast.error('Wystąpił błąd. Spróbuj ponownie.');
}

// Bezpieczny kontekst
Sentry.setContext('auth', {
  userId: user.id,
  provider: 'google' // OK - nie wrażliwe
});
```

---

## React Native (Expo)

Sentry w aplikacji mobilnej różni się od React + Vite — inny SDK, inny sourcemaps flow, inna integracja z navigation.

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

```typescript
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { useNavigationContainerRef } from 'expo-router';

const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNative: !isRunningInExpoGo(),  // crashy native — tylko w dev clients/preview/release
  tracesSampleRate: 1.0,
  integrations: [navigationIntegration],
  enableAutoSessionTracking: true,
});

function RootLayout() {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    if (ref) navigationIntegration.registerNavigationContainer(ref);
  }, [ref]);
  // ...
}

export default Sentry.wrap(RootLayout);
```

### Sourcemaps przez EAS Build

Plugin Sentry (skonfigurowany powyżej) automatycznie uploaduje sourcemaps przy każdym `eas build` na podstawie `SENTRY_AUTH_TOKEN` w EAS secrets:

```bash
eas secret:create --name SENTRY_AUTH_TOKEN --value "$TOKEN" --type string
```

**Bez tokena:** stack traces w Sentry pokażą minified bundle (nieczytelny). Token jest wymagany dla każdego release/preview profilu.

### Crash capture — JS errors + native crashes

`@sentry/react-native` łapie:
- **JS errors:** automatycznie (przez globalErrorHandler)
- **Native crashes (iOS Swift / Android Kotlin):** automatycznie pod warunkiem `enableNative: true` i build z dev-client / preview / release. Expo Go **nie raportuje** native crashy (sandbox).
- **ANR (Application Not Responding) Android:** wbudowane od `@sentry/react-native@5+`
- **Promise rejections:** automatycznie

### Navigation breadcrumbs

`reactNavigationIntegration` automatycznie loguje każdą zmianę route jako breadcrumb. W panelu Sentry zobaczysz: `Login → Dashboard → Settings → [crash]`. Krytyczne dla diagnozy "co user robił przed crashem".

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

- **[react-sentry-patterns.md](resources/react-sentry-patterns.md)** - Pełna konfiguracja React + Vite, ErrorBoundary, performance, session replay (zostaje jako referencja)
- **[edge-functions-sentry.md](resources/edge-functions-sentry.md)** - Wzorce dla Supabase Edge Functions (Deno), shared helpers, Stripe tracking

---

**Skill Status**: COMPLETE + sekcja React Native (Expo) maj 2026
**Progressive Disclosure**: Reference files for detailed patterns
