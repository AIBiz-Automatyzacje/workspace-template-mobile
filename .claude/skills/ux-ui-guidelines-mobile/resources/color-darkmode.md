# Color & Dark Mode — semantic system

System kolorów to architektura, nie estetyka. Decyzje wpływają na accessibility, dark mode, dynamic color i to czy użytkownik intuicyjnie rozumie co jest klikalne. Dark mode to redesign, nie inwersja.

---

## Functional vs semantic colors

**Functional color** = konkretna wartość (`#3B82F6`, `oklch(0.6 0.2 250)`).
**Semantic color** = znaczenie (`primary`, `destructive`, `success`).

Najczęstszy błąd amatorskich apek to mieszanie tych warstw — pozwalanie komponentom używać arbitralnych wartości. Efekt: niespójność, trudna zmiana, brak wsparcia dla dark mode.

**Reguła:** komponenty NIGDY nie używają hex/rgb. Tylko tokeny semantyczne. Functional values żyją w jednym miejscu (theme), tokeny semantyczne mapują na nie.

```tsx
// ZŁE — hardcoded color
<View style={{ backgroundColor: "#3B82F6" }} />

// DOBRE — semantic token
<View className="bg-primary" />
```

---

## Standardowe role semantyczne

Kompletny system semantyczny dla mobile apki:

| Token | Rola | Przykład użycia |
|-------|------|-----------------|
| `primary` | Główne CTA, focus states | "Continue" button, link active |
| `primary-foreground` | Tekst na tle primary | Białe na niebieskim |
| `secondary` | Drugorzędne akcje | "Cancel" button (outlined) |
| `tertiary` | Akcent dla wyróżnienia | Badge, highlight |
| `success` | Pozytywne potwierdzenia | "Saved", checkmark |
| `warning` | Uwaga, ale nie błąd | "Almost full", upcoming deadline |
| `error` | Błędy, destrukcja | "Delete", "Failed" |
| `info` | Informacja neutralna | "Tip:", help text |
| `surface` | Tło kart, kontenerów | Card background |
| `surface-elevated` | Wyniesione powierzchnie | Modal, sheet, tooltip |
| `background` | Tło ekranu | Screen background |
| `foreground` | Główny tekst | Body, headlines |
| `muted` | Drugorzędne tła | Disabled background |
| `muted-foreground` | Drugorzędny tekst | Captions, helpers |
| `border` | Obramowania, dividers | Card borders, separator |
| `ring` | Focus ring | Outline na focus |

**Reguła par foreground/background:** każdy background ma sparowany `*-foreground`, żeby tekst zawsze miał wystarczający kontrast.

---

## Light + Dark — nie inwersja, a redesign

Najczęstszy błąd amatorskiego dark mode: inwersja wartości HSL/RGB. Wysoko nasycony niebieski, który wygląda świetnie w light mode, jest za jasny i zbyt nasycony w dark mode.

**Każdy semantic color potrzebuje OSOBNYCH wartości light + dark.** Premium dark mode (np. Bear, Linear) nie jest "ciemną wersją" — to równoległa specyfikacja wizualna.

### Reguła kalibracji

| Element | Light mode | Dark mode |
|---------|-----------|-----------|
| Primary action | Średnia jasność (`L: 0.55-0.6`) | Lżejsza, mniej nasycona (`L: 0.65-0.7`) |
| Background | Czyste białe (`L: 1.0`) | NIGDY pure black, użyj `L: 0.08-0.12` |
| Foreground | Bardzo ciemny, ale nie pure black (`L: 0.15-0.2`) | Off-white (`L: 0.92-0.95`) |
| Border | Light gray (`L: 0.9`) | Subtle white (`L: 0.2`, opacity 10-15%) |
| Surface elevated | Białe + cień | Lżejszy odcień szarości NIŻ background |

**Pure black tło to błąd na OLED.** OLED wyłącza piksele = pure black, ale przejście od UI do "wyłączonego" piksela jest wizualnie ostre. Użyj `oklch(0.08 0.005 250)` zamiast `#000`.

---

## Layering w dark mode — surface levels

Amatorski dark mode = solidne czarne tło wszędzie. Płaski, martwy interfejs. Premium dark mode używa **layering** — kilka poziomów jasności, hierarchia wizualna.

### 4 poziomy surface

```
Background (L: 0.08)   — najgłębsza warstwa
└── Surface (L: 0.12)  — karta, sekcja
    └── Surface elevated (L: 0.16)  — modal, dropdown
        └── Surface highest (L: 0.20)  — tooltip, najwyższa warstwa
```

**Reguła:** im wyżej element w hierarchii (modal nad sheet nad screen), tym jaśniejszy. To imitacja iOS UIElevation i Material elevation.

### Implementacja w OKLCH (CSS variables)

```css
:root {
  /* Light mode */
  --color-background: oklch(1 0 0);
  --color-surface: oklch(0.98 0.005 250);
  --color-surface-elevated: oklch(1 0 0);
  --color-foreground: oklch(0.18 0.02 250);
  --color-muted-foreground: oklch(0.5 0.02 250);
  --color-border: oklch(0.9 0.01 250);
  --color-primary: oklch(0.55 0.2 250);
  --color-success: oklch(0.6 0.15 145);
  --color-warning: oklch(0.7 0.15 70);
  --color-error: oklch(0.6 0.2 25);
}

.dark {
  /* Dark mode — kalibracja, nie inwersja */
  --color-background: oklch(0.1 0.01 250);
  --color-surface: oklch(0.14 0.01 250);
  --color-surface-elevated: oklch(0.18 0.01 250);
  --color-foreground: oklch(0.93 0.005 250);
  --color-muted-foreground: oklch(0.62 0.01 250);
  --color-border: oklch(0.25 0.01 250);
  --color-primary: oklch(0.7 0.18 250);   /* lżejszy + mniej nasycony */
  --color-success: oklch(0.7 0.13 145);
  --color-warning: oklch(0.78 0.12 70);
  --color-error: oklch(0.7 0.18 25);
}
```

### Elevation overlays (Material approach)

Material zamiast osobnych light/dark surface levels stosuje **overlay** — białą warstwę z rosnącym opacity dla wyższych elewacji. W dark mode imituje to świetlne odbicie.

```css
/* Material 3 dark mode elevation overlays */
--elevation-1: rgba(255, 255, 255, 0.05);
--elevation-2: rgba(255, 255, 255, 0.08);
--elevation-3: rgba(255, 255, 255, 0.11);
--elevation-4: rgba(255, 255, 255, 0.12);
--elevation-5: rgba(255, 255, 255, 0.14);
```

**Kiedy używać blur** (`BlurView` z Expo): tylko nad treścią dynamiczną (image, gradient). Nad statycznym kolorem blur dodaje koszt GPU bez wartości wizualnej. iOS 26 Liquid Glass nadużywa blur — accessibility krytykuje, bo psuje kontrast tekstu.

---

## Liquid Glass po 3 miesiącach — to teraz problem WYDAJNOŚCI

Pierwotny zarzut wobec Liquid Glass (iOS 26) dotyczył czytelności — contrast ratio spadający do 2.1:1 na zmieniającym się tle (Notes, Maps, Photos). Po 3 miesiącach pojawiły się dane długoterminowego użytkowania (r/Design 253↑, 201 komentarzy) i obraz jest gorszy niż samo accessibility:

| Symptom | Skala |
|---------|-------|
| Battery drain iPhone 16 Pro | <50% pod koniec dnia zamiast ~70% sprzed iOS 26 |
| ProMotion na home screen | "basically doesn't happen anymore" |
| Keyboard w Messages | losowo znika |
| Camera app | losowo czarny ekran |

Cytat z 472 głosami: *"It un-'pro'd my phone."* Inny (143 głosów): *"The glass look already feels dated."*

**Implikacja dla buildera:** jeśli sam Apple nie potrafi zoptymalizować Liquid Glass na flagowcu, **custom implementacja w indie apce będzie jeszcze gorsza**. Solid surfaces wygrywają na trzech wymiarach: accessibility, performance, longevity (trend już dziś "feels dated").

**Cross-platform implementacje Liquid Glass** (jeśli mimo wszystko chcesz):

| Biblioteka | Platforma | Status |
|------------|-----------|--------|
| **Expo UI** (Liquid Glass modifier) | iOS | Oficjalne wsparcie od zespołu Expo, najbezpieczniejsza ścieżka |
| `@callstack/liquid-glass` + Reanimated | iOS (RN) | Działa, kontrolowane efekty (277↑) |
| `expo-liquid-glass-view` | iOS (RN) | Demo wygląda jak "LSD trip" wg autora — komentarze 208↑ jednoznacznie negatywne |
| `Liquid` (Jetpack Compose) | Android | Od 1.0.0 z Compose Multiplatform support |

**Reguła:** nie mieszaj Liquid Glass z flat design w jednym ekranie. Albo cały ekran jest "glassy" (z kontrolą tła), albo cały solid. Mieszanka czyta się jak niedopracowanie.

---

## WCAG 2.2 — wymagania kontrastu

Standardy non-negotiable:

| Tekst | Minimum AA | Recommended AAA |
|-------|-----------|-----------------|
| Body text (< 18pt) | **4.5:1** | 7:1 |
| Large text (≥ 18pt lub ≥ 14pt bold) | **3:1** | 4.5:1 |
| UI components (buttons, borders) | 3:1 | — |
| Decorative elements | brak wymogu | brak wymogu |

### Narzędzia (must-use during dev)

- **oklch.com** — wizualizacja OKLCH + porównanie kontrastu
- **contrast-ratio.com** — szybki check dwóch kolorów
- **accessible-colors.com** — generuje accessible kombinacje
- **WebAIM Contrast Checker** — klasyk, wsparcie dla AA i AAA

**Reguła:** "wizualnie OK" nie wystarcza. ZAWSZE waliduj programatycznie. Dark mode szczególnie wrażliwy — białe na ciemnym łatwo osiąga 7:1, ale starannie dobrane akcenty mogą failować.

### `muted-foreground` — pułapka

Najczęstszy błąd: `muted-foreground` ustawiany "estetycznie" z kontrastem 3-4:1. Dla dużego tekstu OK (3:1 wystarczy), ale jeśli używasz tego na 14pt body — failujesz WCAG AA.

```css
/* ZŁE — wygląda subtelnie, ale failuje 4.5:1 na 14px text */
--color-muted-foreground: oklch(0.6 0.01 250);

/* DOBRE — 4.7:1 contrast na białym tle */
--color-muted-foreground: oklch(0.5 0.02 250);
```

---

## Color blindness — fiolet i róż NIE jako semantic

Red-green color blindness dotyka **8% mężczyzn** i **0.5% kobiet**. Najczęstszy typ — protanopia / deuteranopia — utrudnia rozróżnianie czerwonych, zielonych, brązowych i FIOLETOWYCH.

**Konsekwencja:**
- Fiolet ≠ widoczny semantyczny kolor — często myli się z niebieskim lub czarnym
- Róż ≠ "ostrzeżenie" — wielu nie widzi go jako "alarm"
- Czerwony i zielony obok siebie — protanopia widzi oba jako żółto-brązowe

**Bezpieczne pary semantyczne** (rozróżnialne dla większości typów color blindness):

| Rola | Bezpieczny kolor | Unikaj |
|------|------------------|--------|
| Success | Zielony z dużą jasnością + wzór (✓) | Sam ciemny zielony |
| Error | Czerwony Z DODATKOWYM SYGNAŁEM (ikona, wytłuszczenie, wzór) | Sam czerwony |
| Warning | Pomarańczowy lub żółty | Czerwony obok zielonego |
| Info | Niebieski (rozróżnialny dla większości) | Fiolet |

**Reguła:** kolor NIGDY nie jest jedynym sygnałem semantycznym. Zawsze dublej z ikoną, etykietą, wzorem lub typografią.

```tsx
// ZŁE — info tylko przez kolor
<Text className="text-error">Field is required</Text>

// DOBRE — kolor + ikona + tekst
<View className="flex-row items-center gap-2">
  <ErrorIcon className="text-error" />
  <Text className="text-error">Field is required</Text>
</View>
```

**Fiolet i róż w brandingu** są OK — używaj jako dekoracja, hero, akcent. NIE używaj jako semantic action color.

---

## iOS Dynamic Color vs Material You

Obie platformy w 2025-2026 promują kolory ADAPTUJĄCE SIĘ do preferencji użytkownika.

### iOS — UIColor system

iOS 13+ ma `UIColor.systemBlue`, `systemRed`, etc. — automatycznie adaptują się do light/dark mode i increase contrast settings. Apka deklaruje *intencję* (system blue), iOS mapuje na konkretną wartość.

W RN/Expo:

```tsx
import { Platform, useColorScheme } from "react-native";

const colorScheme = useColorScheme();  // "light" | "dark"

// PlatformColor (iOS only)
import { PlatformColor } from "react-native";

<View style={{ backgroundColor: Platform.OS === "ios" ? PlatformColor("systemBlue") : "#3B82F6" }} />
```

### Material You — dynamic color

Android 12+ generuje paletę z TAPETY użytkownika. Twoja apka deklaruje "primary" — system mapuje na kolor harmonizujący z wallpaperem.

W Expo SDK 55+:

```tsx
import { Platform } from "react-native";
import { useDynamicColor } from "@expo/ui/jetpack-compose";  // Android
```

**Implikacja dla brand-strong apek:** dynamic color rezygnuje z pełnej kontroli. Akceptuj, że Twój brand purple może na czyimś urządzeniu wyrenderować się jako fiolet-różowy. Apka MUSI wyglądać dobrze niezależnie od konkretnego koloru.

**Większość brand-strong apek wyłącza dynamic color** (Linear, Notion, Bear) i używa fixed brand palette. To OK — ale zrób to świadomie.

---

## `useColorScheme()` w Expo — automatic + manual

Expo daje hook `useColorScheme()` z Reactowego context.

```tsx
// app/_layout.tsx
import { useColorScheme } from "react-native";
import { vars } from "nativewind";

const lightTheme = vars({
  "--color-background": "oklch(1 0 0)",
  "--color-foreground": "oklch(0.18 0.02 250)",
  "--color-primary": "oklch(0.55 0.2 250)",
});

const darkTheme = vars({
  "--color-background": "oklch(0.1 0.01 250)",
  "--color-foreground": "oklch(0.93 0.005 250)",
  "--color-primary": "oklch(0.7 0.18 250)",
});

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <View style={scheme === "dark" ? darkTheme : lightTheme} className="flex-1">
      <Slot />
    </View>
  );
}
```

### Manual override

```tsx
// hooks/use-theme-mode.ts
import { create } from "zustand";

type ThemeMode = "system" | "light" | "dark";

export const useThemeMode = create<{ mode: ThemeMode; setMode: (m: ThemeMode) => void }>(
  (set) => ({
    mode: "system",
    setMode: (mode) => set({ mode }),
  })
);

// W komponencie
const { mode } = useThemeMode();
const systemScheme = useColorScheme();
const effectiveScheme = mode === "system" ? systemScheme : mode;
```

---

## Brand color jako primary — pułapka

Wiele apek robi błąd: brand color = primary action color. Efekt: każdy klikalny element jest brandowo zabarwiony, użytkownik traci hierarchię "to jest CTA, to jest tylko link".

**Premium pattern (np. Wellspoken):**
- Brand color → akcent, hero, dekoracja, header
- Primary action color → niebieski (system blue) lub neutralny — w ZGODZIE z platform conventions

```tsx
// ZŁE — wszystko burgundowe (jeśli brand to burgundy)
<Pressable className="bg-brand-burgundy">  {/* Continue */}
<Pressable className="bg-brand-burgundy">  {/* Save */}
<Text className="text-brand-burgundy">     {/* Settings link */}

// DOBRE — brand jako akcent, system blue jako CTA
<Pressable className="bg-primary">         {/* Continue — systemBlue */}
<Pressable className="bg-secondary">       {/* Save — secondary */}
<Text className="text-foreground underline">  {/* Settings link */}
<View className="bg-brand-burgundy">       {/* Hero header — brand */}
```

**Wyjątek:** kiedy apka to silne brand experience (gra, kreatywny tool), brand jako primary OK. Reguła kciuka: jeśli brand color spełnia WCAG AA na białym i ciemnym tle z białym tekstem — może być primary. Jeśli nie — niech będzie akcentem.

---

## Centralizacja — single source of truth

Nigdy nie definiuj kolorów inline w komponentach.

```tsx
// ZŁE
<View style={{ backgroundColor: "#3B82F6" }} />

// ZŁE też — żadna semantyka
<View className="bg-blue-500" />

// DOBRE — semantic token z theme
<View className="bg-primary" />
```

**Zalety centralizacji:**
- Globalna zmiana brandu = zmiana 1 wartości w theme
- Dark mode darmowo (token mapuje na inną wartość per scheme)
- Dynamic color support
- Audyt accessibility — sprawdzisz wszystkie pary tokenów raz, nie każdy komponent osobno

---

## Checklist color & dark mode

- [ ] Wszystkie kolory są tokenami semantycznymi, NIGDY hex inline
- [ ] Każdy kolor ma sparowane `*-foreground` (kontrast guaranted)
- [ ] Dark mode ma OSOBNE wartości, nie inwersję (calibrated, not inverted)
- [ ] Background dark mode NIGDY pure black (użyj `L: 0.08-0.12`)
- [ ] Primary dark = lżejszy + mniej nasycony niż primary light
- [ ] Surface levels (background → surface → elevated) mają subtelną hierarchię
- [ ] WCAG AA: body text 4.5:1, large text 3:1, UI components 3:1
- [ ] `muted-foreground` zwalidowany na 4.5:1 (pułapka — często failuje)
- [ ] Fiolet/róż NIE używane jako semantic action color (color blindness)
- [ ] Każdy semantic state (error, success, warning) ma DODATKOWY sygnał (ikona, tekst)
- [ ] Brand color jako akcent, NIE wymuszany jako primary action
- [ ] `useColorScheme()` wsparte + opcjonalny manual override
- [ ] Centralna definicja w theme (NativeWind config / CSS variables)

---

## Powiązane

- [[resources/typography.md]] — text contrast w typography
- [[resources/platform-conventions.md]] — iOS Dynamic Color vs Material You
- [[resources/visual-polish-mobile.md]] — shadow vs border w light/dark
- [[resources/ai-pitfalls.md]] — chaotyczny system kolorów jako AI signature

*Źródła: Apple HIG Color (developer.apple.com/design/human-interface-guidelines/color), Material 3 Color (m3.material.io/styles/color), oklch.com, contrast-ratio.com, accessible-colors.com, WCAG 2.2 (w3.org/TR/WCAG22), wiki/kolory-i-dark-mode. Ostatni update: 2026-05-10.*
