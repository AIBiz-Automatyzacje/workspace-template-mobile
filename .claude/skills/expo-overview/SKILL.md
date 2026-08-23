---
name: expo-overview
description: "Hub stack guidelines dla projektu Expo (React Native). Decision tree: który expo-*/eas-* skill wybrać. Konwencje RN vs web (View vs div, Link z expo-router, NativeWind, brak DOM). Używaj na początku każdej rozmowy o projekcie mobilnym, przy 'projekt Expo', 'mobile app', 'React Native', 'jak to zrobić w Expo'."
---

# Expo Overview — Mobile Stack Hub

Ten skill jest **pierwszym przystankiem** gdy pracujesz w repo mobilnym (Expo). Pełni rolę indeksu / routera dla 16 stack-specific skilli Expo (upstream: [`expo/skills`](https://github.com/expo/skills), konwencja nazw `expo-*` = framework OSS, `eas-*` = płatny serwis EAS). Zaczynaj tu, potem deleguj do konkretnego skilla.

## Detekcja stacku

Jesteś w projekcie Expo gdy:
- Istnieje `app.json`, `app.config.ts`, lub `app.config.js`
- `package.json` zawiera `"expo": "..."` w `dependencies`
- Jest folder `app/` (Expo Router) lub `App.tsx` (entry point)

**To NIE jest projekt webowy.** Nie używaj skilla `tailwind-react-guidelines` (tu go nie ma — wycięty w transformacji). Nie używaj `agent-browser` (tu go nie ma — używaj `mobile-e2e-maestro`).

## Decision tree — który skill?

| Co budujesz / nad czym pracujesz | Skill |
|---|---|
| Struktura folderów NOWEGO projektu Expo, gdzie ma żyć plik | `expo-project-structure` |
| Ekran, komponent UI, kontrolki, SF Symbols, media, HIG styling | `expo-native-ui` |
| **Komponent UI: sheet, picker, slider, toggle, menu, sekcja formularza** | **`expo-ui` (sprawdź PIERWSZY — patrz reguła niżej)** |
| Animacja, gest, przejście między ekranami, haptics, „ruch tnie na urządzeniu" | `expo-animation` |
| Design tokeny, motyw, spójność wizualna ekranów, audyt driftu | `expo-design-system` |
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

## Reguła wyboru komponentu — `@expo/ui` najpierw

**Zanim sięgniesz po komponent UI — sheet, picker, slider, toggle, menu, segmented control, sekcję
formularza, grouped rows — sprawdź `expo-ui`, czy `@expo/ui` ma natywny odpowiednik.** Dopiero gdy go
nie ma, schodź do wbudowanych komponentów RN albo biblioteki community. Powód: `@expo/ui` renderuje
prawdziwe SwiftUI / Jetpack Compose, a warstwa uniwersalna od SDK 56+ działa **w Expo Go**, bez
custom builda.

Konkretnie — do tych rzeczy **nie** bierz Reanimated, `@gorhom/bottom-sheet` ani wbudowanych RN
`Picker`/`Switch`:

| Potrzeba | Weź |
|---|---|
| Sheet wysuwany od dołu | `BottomSheet` z `@expo/ui` |
| Toggle | `Switch` z `@expo/ui` |
| Slider | `Slider` z `@expo/ui` |
| Picker daty/czasu | `@expo/ui/community/datetimepicker` |
| Menu | `Menu` z `@expo/ui` |
| Sekcja formularza z labelem | `FieldGroup` z `@expo/ui` |
| Grouped rows (ekran ustawień, panel szczegółów) | `List` + `ListItem` z `@expo/ui` |

> **`List` z `@expo/ui` NIE jest listą wirtualizowaną.** Renderuje natywne grouped rows — wygląd ekranu
> Ustawień iOS. Każdy `ListItem` to natywny węzeł na wątku JS, wiersze nie są recyklowane. Do list
> o dużym lub nieznanym rozmiarze (feedy, wyniki wyszukiwania, katalogi) użyj `FlatList` albo
> `FlashList`. `List` jest dobry do krótkich, stałych grup.

> **`BottomSheet` sterujesz przez `isPresented` / `onDismiss`** — **nie** przez `isOpen`, `isOpened`,
> `onIsOpenedChange` ani `onChange`. To propsy `@gorhom/bottom-sheet`; podane tutaj **cicho nic nie
> zrobią**. Nie myl też uniwersalnego `BottomSheet` z drop-in zamiennikiem
> `@expo/ui/community/bottom-sheet` (ten jest wyłącznie ścieżką migracji z gorhoma).

**Reszta UI (layout, listy, własne komponenty, styling):** cross-platform RN + NativeWind, jak dotąd —
patrz `expo-native-ui` i `expo-design-system`.

**Vendor lock jest realny:** wyjście z Expo wymaga przepisania ekranów używających `@expo/ui`. To
świadomy koszt tego szablonu, nie przeoczenie — ale nie jest powodem, żeby omijać regułę wyżej
w pojedynczym komponencie.

## Linki do 16 skilli (alfabetycznie)

- **`eas-app-stores`** — build + submit do storeów (App Store / Google Play / TestFlight)
- **`eas-hosting`** — deploy web bundle + API routes (`+api.ts`) na EAS Hosting
- **`eas-update-insights`** — health metryki OTA updateów
- **`eas-workflows`** — EAS workflow YAML (CI/CD)
- **`expo-animation`** — animacje i gesty (Reanimated worklety, Gesture Handler, haptics, przejścia)
- **`expo-data-fetching`** — networking, React Query, offline cache
- **`expo-design-system`** — design tokeny, motyw, komponenty wielokrotnego użytku, audyt driftu
- **`expo-dev-client`** — custom dev client przez EAS Build
- **`expo-dom`** — web kod w webview na natywie
- **`expo-module`** — natywne moduły (Swift/Kotlin/TS)
- **`expo-native-ui`** — przewodnik UI platformowego (HIG, semantic colors, kontrolki, media)
- **`expo-project-structure`** — struktura folderów nowego projektu (Expo Router, src/)
- **`expo-router`** — nawigacja i routing (stack, taby, modale, headery)
- **`expo-tailwind-setup`** — TailwindCSS v4 + NativeWind v5 preview
- **`expo-ui`** — natywne UI przez `@expo/ui` (SwiftUI / Jetpack Compose) — **sprawdzaj pierwszy przy wyborze komponentu**
- **`expo-upgrade`** — upgrade SDK Expo
