---
name: expo-overview
description: "Hub stack guidelines dla projektu Expo (React Native). Decision tree: który expo-*/eas-* skill wybrać. Konwencje RN vs web (View vs div, Link z expo-router, NativeWind, brak DOM). Używaj na początku każdej rozmowy o projekcie mobilnym, przy 'projekt Expo', 'mobile app', 'React Native', 'jak to zrobić w Expo'."
---

# Expo Overview — Mobile Stack Hub

Ten skill jest **pierwszym przystankiem** gdy pracujesz w repo mobilnym (Expo). Pełni rolę indeksu / routera dla 13 stack-specific skilli Expo (upstream: [`expo/skills`](https://github.com/expo/skills), konwencja nazw `expo-*` = framework OSS, `eas-*` = płatny serwis EAS). Zaczynaj tu, potem deleguj do konkretnego skilla.

## Detekcja stacku

Jesteś w projekcie Expo gdy:
- Istnieje `app.json`, `app.config.ts`, lub `app.config.js`
- `package.json` zawiera `"expo": "..."` w `dependencies`
- Jest folder `app/` (Expo Router) lub `App.tsx` (entry point)

**To NIE jest projekt webowy.** Nie używaj skilla `tailwind-react-guidelines` (tu go nie ma — wycięty w transformacji). Nie używaj `agent-browser` (tu go nie ma — używaj `mobile-e2e-maestro`).

## Decision tree — który skill?

| Co budujesz / nad czym pracujesz | Skill |
|---|---|
| Ekran, komponent UI, animacja, kontrolki, SF Symbols, media | `expo-native-ui` |
| Nawigacja, routing, taby, modale, form sheets, headery | `expo-router` |
| Setup Tailwinda / NativeWind / `className` w RN | `expo-tailwind-setup` |
| Fetch z API, React Query, SWR, data loaders, offline cache | `expo-data-fetching` |
| Natywne UI przez `@expo/ui` (SwiftUI iOS / Jetpack Compose Android) | `expo-ui` |
| Custom dev client przez EAS Build (gdy Expo Go nie wystarcza) | `expo-dev-client` |
| Pisanie natywnych modułów Swift/Kotlin/TS, config plugins | `expo-module` |
| Reuse webowego kodu (recharts, web libs) przez webview | `expo-dom` |
| Build + submit do App Store / Google Play | `eas-app-stores` |
| YAML pipeline w `.eas/workflows/` | `eas-workflows` |
| Deploy web bundle / API routes (`+api.ts`) na EAS Hosting | `eas-hosting` |
| Health metryki OTA updateów (crash rate, payload size) | `eas-update-insights` |
| Upgrade SDK Expo (53/54/55) | `expo-upgrade` |

**Server-side code (webhooki, proxy do API, server-side auth):** domyślnie `supabase-dev-guidelines` (Edge Functions — Decyzja architektoniczna #3 z transformacji). `eas-hosting` (`+api.ts`) używaj gdy projekt świadomie wybiera backend na EAS zamiast Supabase.

**Mobile E2E testing:** `mobile-e2e-maestro` (analog `agent-browser` z web).

**W upstream `expo/skills` są też skille nie zaimportowane do tego szablonu** (nisza poza core flow): `expo-brownfield` (Expo w istniejącej apce natywnej), `expo-app-clip` (iOS App Clips), `expo-web-to-native` (migracja całej apki web), `expo-examples` (repo expo/examples), `eas-simulator` (zdalny simulator w chmurze EAS), `eas-observe` (metryki `expo-observe`). Gdy temat ich dotyczy — pobierz z upstreamu.

## Konwencje RN vs web (dla osób z webowego stacku)

| Web | Mobile (Expo + RN) |
|---|---|
| `<div>` | `<View>` |
| `<span>`, `<p>` | `<Text>` (KAŻDY tekst musi być w `<Text>`, inaczej crash) |
| `<a href="/page">` | `<Link href="/page">` z `expo-router` |
| `useNavigate()` | `useRouter()` z `expo-router` |
| `localStorage`, `sessionStorage` | `expo-secure-store` (sekrety) lub `AsyncStorage` (zwykłe dane) |
| `window`, `document`, `DOM` | brak — używaj `Platform.OS`, native APIs |
| `<button>` | `<Pressable>` lub `<TouchableOpacity>` |
| `<input>` | `<TextInput>` |
| `<img src=...>` | `<Image source={{ uri }}>` z `expo-image` |
| CSS classes (Tailwind) | `className` przez NativeWind v5 (v4 składnia + RN style props) |
| `prefers-reduced-motion` | `AccessibilityInfo.isReduceMotionEnabled()` |
| `aria-label` | `accessibilityLabel`, `accessibilityRole`, `accessibilityHint` |
| Browser deep link `https://...` | App scheme `yourapp://...` (deep linking via `expo-router`) |

## Mental model — kiedy native vs cross-platform

**Domyślnie:** używaj cross-platform RN + NativeWind. To 90% UI. Spójność, jeden codebase, łatwiejsze utrzymanie.

**Native (`@expo/ui`, skill `expo-ui`):** tylko gdy potrzebujesz **prawdziwego native feel** który cross-platform nie da:
- Native pickers (data, czas, kontakty) — mają inne zachowanie per platforma
- Haptyki specyficzne dla platformy
- Dark mode platformy (automatyczny iOS dynamic colors)
- Material You (Android 12+) z user theming
- Liquid Glass (iOS 26+) — szkło z kontekstu wallpaperu

To **nie jest** "na wszystko" — to specjalistyczne narzędzie. Vendor lock realny: wyjście z Expo wymaga przepisania ekranów używających `@expo/ui`.

## Linki do 13 skilli (alfabetycznie)

- **`eas-app-stores`** — build + submit do storeów (App Store / Google Play / TestFlight)
- **`eas-hosting`** — deploy web bundle + API routes (`+api.ts`) na EAS Hosting
- **`eas-update-insights`** — health metryki OTA updateów
- **`eas-workflows`** — EAS workflow YAML (CI/CD)
- **`expo-data-fetching`** — networking, React Query, offline cache
- **`expo-dev-client`** — custom dev client przez EAS Build
- **`expo-dom`** — web kod w webview na natywie
- **`expo-module`** — natywne moduły (Swift/Kotlin/TS)
- **`expo-native-ui`** — kompletny przewodnik UI (HIG, kontrolki, media, animacje)
- **`expo-router`** — nawigacja i routing (stack, taby, modale, headery)
- **`expo-tailwind-setup`** — TailwindCSS v4 + NativeWind v5 preview
- **`expo-ui`** — natywne UI przez `@expo/ui` (SwiftUI / Jetpack Compose)
- **`expo-upgrade`** — upgrade SDK Expo
