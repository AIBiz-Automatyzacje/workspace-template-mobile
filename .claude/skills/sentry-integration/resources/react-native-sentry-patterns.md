# React Native Sentry Patterns

Szczegółowe wzorce integracji Sentry z React Native (Expo Router) — SDK dla tego szablonu mobile.

> **Stan SDK:** `@sentry/react-native` 8.x. `Sentry.expoRouterIntegration()` jest kanoniczną
> integracją nawigacji dla Expo Router — czyta wewnętrzny navigation ref sama, bez ręcznego
> `useNavigationContainerRef` + `registerNavigationContainer` (to był wzorzec dla starszej
> `reactNavigationIntegration`). `Sentry.mobileReplayIntegration()` wymaga `@sentry/react-native
> >= 6.5.0`. Źródła: https://docs.sentry.io/platforms/react-native/ ·
> https://docs.expo.dev/guides/using-sentry/ ·
> https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/ ·
> https://docs.sentry.io/platforms/react-native/session-replay/

## Table of Contents

- [Instalacja](#instalacja)
- [Plugin Expo (app.json)](#plugin-expo-appjson)
- [Inicjalizacja pełna](#inicjalizacja-pełna)
- [Sentry.wrap](#sentrywrap)
- [Error Boundary (RN)](#error-boundary-rn)
- [Native crashe vs Expo Go](#native-crashe-vs-expo-go)
- [Sourcemaps — EAS Build vs EAS Update (OTA)](#sourcemaps--eas-build-vs-eas-update-ota)
- [Debug symbole (dSYM / ProGuard / NDK)](#debug-symbole-dsym--proguard--ndk)
- [Session Replay (Mobile)](#session-replay-mobile)
- [Mobile-specific context](#mobile-specific-context)
- [Zmienne środowiskowe](#zmienne-środowiskowe)
- [Ignorowane błędy](#ignorowane-błędy)

---

## Instalacja

```bash
bunx expo install @sentry/react-native
```

Alternatywa — kreator, który od razu doda plugin, config Metro i kod inicjalizacji:

```bash
npx @sentry/wizard@latest -i reactNative
```

Po instalacji kreatorem i tak zweryfikuj snippet `Sentry.init()` niżej — kreator nie zawsze
dobiera `expoRouterIntegration`/`mobileReplayIntegration` zgodnie z konwencją tego szablonu.

---

## Plugin Expo (app.json)

Wymagany, żeby sourcemapy i debug symbole uploadowały się automatycznie przy `eas build`:

```json
{
  "expo": {
    "plugins": [
      [
        "@sentry/react-native/expo",
        {
          "organization": "<slug-org-z-dashboardu-sentry>",
          "project": "<slug-projektu-z-dashboardu-sentry>",
          "url": "https://sentry.io/"
        }
      ]
    ]
  }
}
```

`SENTRY_AUTH_TOKEN` musi być dostępny w środowisku builda (patrz
[Zmienne środowiskowe](#zmienne-środowiskowe)) — bez niego plugin nie uploaduje niczego i stack
trace w Sentry zostaje zminifikowany.

---

## Inicjalizacja pełna

**Plik: `app/_layout.tsx` (Expo Router root)**

```typescript
import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENVIRONMENT ?? 'production',

  // crashe natywne — tylko w dev-client/preview/release; Expo Go ich nie zgłasza
  enableNative: !isRunningInExpoGo(),

  // Performance monitoring — 10% transakcji. 1.0 tylko tymczasowo w dev do debugowania.
  tracesSampleRate: 0.1,

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% normalnych sesji
  replaysOnErrorSampleRate: 1.0, // 100% sesji z błędem

  integrations: [
    Sentry.expoRouterIntegration({
      // Time to Initial Display niewspierane w Expo Go
      enableTimeToInitialDisplay: !isRunningInExpoGo(),
    }),
    Sentry.mobileReplayIntegration(),
    // maskAllText/maskAllImages/maskAllVectors są domyślnie true (GDPR) —
    // wyłączaj selektywnie tylko dla ekranów bez PII, patrz sekcja Session Replay niżej
  ],

  // GDPR: maskowanie danych osobowych — spójne z beforeSend w Edge Functions i web
  beforeSend(event) {
    if (event.user?.email) {
      event.user.email = event.user.email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
    }
    return event;
  },
});

function RootLayout() {
  // ... Stack / providery / routing
}

export default Sentry.wrap(RootLayout);
```

**Uwaga:** `enableAutoSessionTracking: true` nie jest tu potrzebne — release health (sesje) jest
włączony domyślnie w `@sentry/react-native`, jawne ustawienie jest redundantne.

---

## Sentry.wrap

`Sentry.wrap(RootLayout)` (na dole pliku, jako `export default`) to jedyny wymagany krok, żeby
Sentry owinął drzewo komponentów instrumentacją touch/render potrzebną dla performance
monitoringu i `expoRouterIntegration`. Nie zastępuj go ręcznym HOC-iem — integracje SDK zakładają
ten dokładny wrapper.

---

## Error Boundary (RN)

`Sentry.ErrorBoundary` działa tak samo jak w web SDK — łapie błędy renderu i pokazuje fallback UI,
uzupełniająco do globalnego error handlera (który łapie JS errors poza drzewem React):

```typescript
import * as Sentry from '@sentry/react-native';
import { View, Text, Button } from 'react-native';

function ErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
        Coś poszło nie tak
      </Text>
      <Button title="Spróbuj ponownie" onPress={resetError} />
    </View>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} resetError={resetError} />
      )}
      onError={(error, componentStack) => {
        Sentry.withScope((scope) => {
          scope.setTag('error.type', 'react_error_boundary');
          scope.setContext('componentStack', { stack: componentStack });
        });
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

Umieść `AppErrorBoundary` wewnątrz `RootLayout` (owija nawigację), nie na zewnątrz
`Sentry.wrap` — `Sentry.wrap` musi opakowywać cały komponent root, żeby instrumentacja
performance działała od pierwszego renderu.

---

## Native crashe vs Expo Go

| Środowisko | JS errors | Native crashes (Swift/Kotlin) | ANR (Android) |
|------------|-----------|-------------------------------|---------------|
| Expo Go | ✅ automatycznie | ❌ nie raportowane (sandbox) | ❌ |
| Dev client | ✅ | ✅ (`enableNative: true`) | ✅ (od `@sentry/react-native@5+`) |
| Preview / Release build | ✅ | ✅ | ✅ |

Testuj crash reporting zawsze na dev-client lub buildzie preview/release — Expo Go da fałszywe
poczucie bezpieczeństwa (JS errors owszem trafią do Sentry, native crashe nigdy).

---

## Sourcemaps — EAS Build vs EAS Update (OTA)

**EAS Build (natywny build):** plugin skonfigurowany wyżej uploaduje sourcemapy automatycznie,
pod warunkiem że `SENTRY_AUTH_TOKEN` jest dostępny w środowisku builda:

```bash
eas env:create --name SENTRY_AUTH_TOKEN --value "$TOKEN" --visibility secret --environment production
```

Powtórz z `--environment preview`, jeśli chcesz auto-upload też dla buildów preview.
`eas secret:create` jest nieaktualne — eas-cli ma dziś tylko rodzinę `eas env:*`.

**EAS Update (OTA):** auto-upload z pluginu **nie triggeruje się** przy `eas update` — to osobna
ścieżka dystrybucji, bez natywnego build stepu. Po każdym OTA update wgraj sourcemapy ręcznie:

```bash
eas update --branch production
npx sentry-expo-upload-sourcemaps dist
```

Pomijając ten krok, crashe zgłoszone po OTA update pokażą zminifikowany stack trace mimo
poprawnie skonfigurowanego pluginu i tokena.

---

## Debug symbole (dSYM / ProGuard / NDK)

Ten sam plugin (`@sentry/react-native/expo`) automatyzuje też upload natywnych debug symboli
przy `eas build`:
- **iOS:** dSYM — potrzebne do deobfuskacji natywnych stack trace'ów Swift/Objective-C
- **Android:** ProGuard/R8 mapping + NDK symbole — potrzebne dla crashy w kodzie natywnym/Kotlin

Bez tego natywne crashe w Sentry pokażą adresy pamięci zamiast czytelnych nazw funkcji/plików.
Nie wymaga osobnej konfiguracji poza tym, co już jest w sekcji
[Plugin Expo](#plugin-expo-appjson) — dzieje się automatycznie podczas `eas build`.

---

## Session Replay (Mobile)

Wymaga `@sentry/react-native >= 6.5.0`. Nagrywa sesję jako sekwencję klatek — pomaga zrozumieć
"co user robił/widział przed crashem", uzupełniająco do breadcrumbs nawigacji.

```typescript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  replaysSessionSampleRate: 0.1, // 10% normalnych sesji
  replaysOnErrorSampleRate: 1.0, // 100% sesji z błędem — zawsze wysoko
  integrations: [
    Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() }),
    Sentry.mobileReplayIntegration(),
  ],
});
```

**GDPR — domyślne zachowanie:** SDK **agresywnie maskuje cały tekst, obrazy i webview domyślnie**
(`maskAllText`, `maskAllImages`, `maskAllVectors` = `true` out of the box). To spójne z
maskowaniem emaili w [GDPR Compliance](../SKILL.md#gdpr-compliance) w głównym skillu. Wyłączaj
maskowanie tylko selektywnie i tylko dla ekranów bez PII:

```typescript
Sentry.mobileReplayIntegration({
  maskAllText: false,
  maskAllImages: false,
  maskAllVectors: false,
})
```

Nie wyłączaj globalnie dla całej aplikacji — Session Replay bez maskowania nagrywa dokładnie to,
co user widzi na ekranie (dane osobowe, treści formularzy, zdjęcia).

---

## Mobile-specific context

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

Pomaga filtrować w Sentry per-platform / per-wersję — np. czy crash dotyczy tylko starego builda
albo tylko Androida.

---

## Zmienne środowiskowe

**`.env.local` (klient, `EXPO_PUBLIC_*` — trafia do bundla, nie do sekretów):**
```env
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

**EAS env (build-time, sekret — NIGDY w repo):**
```bash
eas env:create --name SENTRY_AUTH_TOKEN --value "$TOKEN" --visibility secret --environment production
```

---

## Ignorowane błędy

Kategorie, które zwykle NIE powinny trafiać do Sentry na mobile (analogicznie do listy webowej w
`react-sentry-patterns.md`, ale bez web-izmów typu `ResizeObserver`/chunk loading):

| Kategoria | Przykłady | Dlaczego ignorować |
|-----------|-----------|---------------------|
| Network (offline/łącze usera) | `Network request failed`, timeouty fetch | Problem łącza użytkownika, nie kodu |
| User cancellation | `AbortError` | Świadome anulowanie żądania |
| Expo Go sandbox noise | ostrzeżenia dot. modułów niedostępnych w Expo Go | Nie dotyczy dev-client/release |

Skonfiguruj `ignoreErrors` w `Sentry.init()` analogicznie do wzorca w
[react-sentry-patterns.md](react-sentry-patterns.md#ignorowane-błędy) — sama lista wzorców
zależy od realnych szumów zaobserwowanych w Twoim projekcie.
