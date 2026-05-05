---
name: expo-overview
description: "Hub stack guidelines dla projektu Expo (React Native). Decision tree: który expo-* skill wybrać. Konwencje RN vs web (View vs div, Link z expo-router, NativeWind, brak DOM). Używaj na początku każdej rozmowy o projekcie mobilnym, przy 'projekt Expo', 'mobile app', 'React Native', 'jak to zrobić w Expo'."
---

# Expo Overview — Mobile Stack Hub

Ten skill jest **pierwszym przystankiem** gdy pracujesz w repo mobilnym (Expo). Pełni rolę indeksu / routera dla 12 stack-specific skilli Expo. Zaczynaj tu, potem deleguj do konkretnego `expo-*` skilla.

## Detekcja stacku

Jesteś w projekcie Expo gdy:
- Istnieje `app.json`, `app.config.ts`, lub `app.config.js`
- `package.json` zawiera `"expo": "..."` w `dependencies`
- Jest folder `app/` (Expo Router) lub `App.tsx` (entry point)

**To NIE jest projekt webowy.** Nie używaj skilla `tailwind-react-guidelines` (tu go nie ma — wycięty w transformacji). Nie używaj `agent-browser` (tu go nie ma — używaj `mobile-e2e-maestro`).

## Decision tree — który expo-* skill?

| Co budujesz / nad czym pracujesz | Skill |
|---|---|
| Ekran, komponent UI, nawigacja, animacja, native tabs | `expo-building-native-ui` |
| Setup Tailwinda / NativeWind / `className` w RN | `expo-tailwind-setup` |
| Fetch z API, React Query, SWR, Expo Router data loaders, offline cache | `expo-native-data-fetching` |
| Natywne komponenty Android (Material You, native pickers) | `expo-ui-jetpack-compose` |
| Natywne komponenty iOS (SwiftUI, dynamic type, Liquid Glass) | `expo-ui-swift-ui` |
| Custom dev client przez EAS Build (gdy Expo Go nie wystarcza) | `expo-dev-client` |
| Pisanie natywnych modułów Swift/Kotlin/TS, config plugins | `expo-module` |
| Reuse webowego kodu (recharts, web libs) przez webview | `expo-use-dom` |
| Build + submit do App Store / Google Play | `expo-deployment` |
| YAML pipeline w `.eas/workflows/` | `expo-cicd-workflows` |
| Health metryki OTA updateów (crash rate, payload size) | `eas-update-insights` |
| Upgrade SDK Expo (53/54/55) | `expo-upgrading` |

**Server-side code (webhooki, proxy do API, server-side auth):** używaj `supabase-dev-guidelines` (sekcja Mobile/Edge Functions). NIE adoptujemy `expo-api-routes` w tym repo (Decyzja architektoniczna #3 z transformacji).

**Mobile E2E testing:** `mobile-e2e-maestro` (analog `agent-browser` z web).

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

**Domyślnie:** używaj cross-platform RN + NativeWind. To 90% UI. Spójność, jeden codebase, łatwiejsza utrzymanie.

**Native (`@expo/ui`):** tylko gdy potrzebujesz **prawdziwego native feel** który cross-platform nie da:
- Native pickers (data, czas, kontakty) — mają inny zachowanie per platforma
- Haptyki specyficzne dla platformy
- Dark mode platformy (automatyczny iOS dynamic colors)
- Material You (Android 12+) z user theming
- Liquid Glass (iOS 26+) — szkło z kontekstu wallpaperu

To **nie jest** "na wszystko" — to specjalistyczne narzędzie. Vendor lock realny: wyjście z Expo wymaga przepisania ekranów używających `@expo/ui`.

## Linki do 12 skilli (alfabetycznie)

- **`eas-update-insights`** — health metryki OTA updateów
- **`expo-building-native-ui`** — kompletny przewodnik UI dla Expo Router
- **`expo-cicd-workflows`** — EAS workflow YAML
- **`expo-deployment`** — submit do storeów
- **`expo-dev-client`** — custom dev client przez EAS Build
- **`expo-module`** — natywne moduły (Swift/Kotlin/TS)
- **`expo-native-data-fetching`** — networking, React Query, offline cache
- **`expo-tailwind-setup`** — TailwindCSS v4 + NativeWind v5 preview
- **`expo-ui-jetpack-compose`** — natywne komponenty Android (SDK 55+)
- **`expo-ui-swift-ui`** — natywne komponenty iOS (SDK 55+)
- **`expo-upgrading`** — upgrade SDK Expo
- **`expo-use-dom`** — web kod w webview na natywie
