---
name: mobile-e2e-maestro
description: "Automatyzacja testów E2E mobile przez Maestro CLI. Nawigacja, tap, scroll, gesty (swipe, long press, pinch), input, asercje, screenshoty na emulatorze iOS/Android. Deep linking, OAuth flow, biometry. Używaj przy 'testuj UI mobilne', 'zrób screenshot apki', 'agent-mobile', 'E2E mobile', weryfikacji checkboxów Weryfikacja: w fazie review."
---

# Mobile E2E Testing with Maestro

CLI do automatyzacji testów E2E aplikacji mobilnych iOS/Android. Działa na zbudowanej aplikacji w emulatorze/symulatorze (jak agent-browser dla web — testuje to co user faktycznie widzi i klika).

## Setup Check

```bash
command -v maestro >/dev/null 2>&1 && echo "Installed: $(maestro --version)" || echo "NOT INSTALLED — instalacja: curl -Ls 'https://get.maestro.mobile.dev' | bash"
```

**Wymagania platformowe:**
- **iOS:** macOS + Xcode + iOS Simulator (otwarte: `open -a Simulator`)
- **Android:** Android Studio + emulator AVD (uruchomiony: `emulator -avd <name>`)
- Aplikacja zbudowana i zainstalowana (przez `eas build --local` lub `expo run:ios` / `expo run:android`)

## Core Workflow

1. **Launch:** uruchom emulator + zainstaluj aplikację (build z dev clienta wystarczy)
2. **Flow YAML:** zapisz scenariusz w pliku `.yaml` (folder `.maestro/`)
3. **Run:** `maestro test .maestro/login-flow.yaml`
4. **Inspect:** screenshoty + video w `.maestro/screenshots/` po każdym `takeScreenshot`

```yaml
# .maestro/login-flow.yaml
appId: com.example.myapp     # iOS bundle ID albo Android package name
---
- launchApp
- assertVisible: "Zaloguj się"
- tapOn: "Email"
- inputText: "test@example.com"
- tapOn: "Hasło"
- inputText: "haslo123"
- tapOn:
    text: "Zaloguj"
    enabled: true
- waitForAnimationToEnd
- assertVisible: "Witaj, Test"
- takeScreenshot: login-success
```

```bash
maestro test .maestro/login-flow.yaml
```

## Common Commands (cheat sheet)

```yaml
# Nawigacja
- launchApp
- launchApp:
    arguments:
      isFirstLaunch: true
- stopApp
- pressKey: Back
- pressKey: Home

# Interakcje
- tapOn: "Submit"
- tapOn:
    id: "submit-button"      # testID prop w RN
- tapOn:
    text: "Submit"
    index: 1                 # gdy wiele matchy
- doubleTapOn: "Item"
- longPressOn: "Item"
- inputText: "hello world"
- eraseText                  # czyści TextInput
- copyTextFrom: "Item"       # kopiuje do clipboard

# Gesty
- swipe:
    direction: UP
    duration: 500
- swipe:
    from:
      id: "card-1"
    direction: LEFT          # swipe-to-delete
- scroll
- scrollUntilVisible:
    element:
      text: "Footer"

# Asercje
- assertVisible: "Welcome"
- assertNotVisible: "Loading"
- assertVisible:
    id: "user-avatar"

# Wait
- waitForAnimationToEnd
- waitForAnimationToEnd:
    timeout: 5000
- extendedWaitUntil:
    visible: "Loaded"
    timeout: 10000

# Screenshot / Video
- takeScreenshot: name-without-extension
- startRecording: my-flow
- stopRecording

# Deep linking (KRYTYCZNE dla OAuth flow)
- openLink: "myapp://auth/callback?code=xyz"

# Permissions (system dialogs iOS/Android)
- launchApp:
    permissions:
      all: allow             # albo deny / unset
```

## Maestro Studio (interactive recording)

Analog do Playwright codegen / agent-browser snapshot. Otwiera GUI, klikasz na ekranie, generuje YAML.

```bash
maestro studio
# Otwiera browser na http://localhost:9999
# Każdy tap/swipe/input → live preview YAML
# Skopiuj wygenerowany YAML do flow file
```

Używaj przy projektowaniu nowego flow — szybciej niż pisanie YAML ręcznie.

## Deep Linking (OAuth, push notifications)

```yaml
appId: com.example.myapp
---
- launchApp
- tapOn: "Zaloguj przez Google"
# Symulujemy redirect z OAuth providera (zamiast prawdziwego browser flow)
- openLink: "myapp://auth/callback?code=mock-auth-code-123"
- waitForAnimationToEnd
- assertVisible: "Witaj, Test"
```

To kluczowy use case mobile, którego **nie da się przetestować** w expo-router-testing (in-process) — Maestro woła OS przez `xcrun simctl openurl` / `adb shell am start`, więc deep link idzie przez prawdziwy router OS.

## iOS vs Android — różnice

| Aspekt | iOS | Android |
|---|---|---|
| `appId` | `com.example.myapp` (bundle ID z Xcode) | `com.example.myapp` (package name z `app.json` android.package) |
| Emulator setup | iOS Simulator (Xcode) | AVD przez Android Studio / `emulator` CLI |
| System dialogs | `permissions: all: allow` | `permissions: all: allow` |
| Back gesture | `pressKey: Back` no-op (iOS bez Back) | `pressKey: Back` działa |
| Status bar | Maestro ignoruje | Maestro ignoruje |

Pisz flow **cross-platform** gdy się da. Gdy musisz różnicować, użyj osobnych plików `.maestro/ios/` i `.maestro/android/`.

## Cloud vs Local

**Local (default):**
- Twój sprzęt (macOS dla iOS), emulator/symulator otwarty
- Free, ale wolne (~30s-2min per flow)
- Idealne do pracy lokalnej i przed-commit verification

**Maestro Cloud (`maestro cloud`):**
- Build apki + flow uploadowane do chmury
- Equal devices, parallel runs
- Płatne (po free tier)
- Dla CI / cross-device matrix

```bash
# Local
maestro test .maestro/

# Cloud (cały folder testów)
maestro cloud --apiKey "$MAESTRO_API_KEY" build/MyApp.app .maestro/
```

W tym repo **default = local**. Cloud rozważ dopiero gdy masz CI pipeline.

## Integracja z `feature-tester-mobile-e2e`

`feature-tester-mobile-e2e` (subagent) wywołuje ten skill w fazie review. Workflow:

1. Czyta checklistę zadania (sekcja "Weryfikacja:")
2. Każdy checkbox = jeden flow YAML w `.maestro/`
3. Uruchamia `maestro test .maestro/<flow>.yaml`
4. Zbiera screenshoty
5. Raportuje pass/fail per checkbox z linkami do screenshotów

Naming convention: `.maestro/<feature>-<scenario>.yaml`, np. `.maestro/auth-login-success.yaml`, `.maestro/auth-login-empty-fields.yaml`.

## Common gotchas

- **Tekst polski:** Maestro obsługuje UTF-8, nie escape'uj diakrytyków. `tapOn: "Zaloguj się"` działa.
- **Animacje:** zawsze `waitForAnimationToEnd` po nawigacji, w przeciwnym razie tap na nieobecny element zwraca timeout.
- **Toast / alerty:** zniknią same — łap je przez `extendedWaitUntil: visible: "..." timeout: 3000`.
- **`testID`:** w RN dodawaj `testID="submit-button"` na komponentach żeby `id:` matchowało. Inaczej Maestro polega na tekście, co łamie się przy tłumaczeniach.
- **Hot reload:** Maestro NIE działa na devbuild z hot reloadu — buduj release/preview build (`eas build --profile preview`).

## Quick reference

```bash
# Health check
maestro --version

# Run single flow
maestro test .maestro/login.yaml

# Run wszystkie w folderze
maestro test .maestro/

# Interactive recording
maestro studio

# Hierarchia UI (debugging)
maestro hierarchy

# List devices
maestro device list
```
