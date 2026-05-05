---
name: code-review
description: "Przeprowadza code review dla React 19, TailwindCSS v4, shadcn/ui, Supabase, Sentry. Używaj przy przeglądaniu PR, ocenie implementacji fazy/etapu, weryfikacji zgodności z planem. Generuje raport z klasyfikacją problemów (krytyczne/poważne/drobne/sugestie)."
---

# Code Review

Skill do przeprowadzania code review w projekcie React 19 + TailwindCSS v4 + shadcn/ui.

## Kiedy używać

- Review zmian po zakończeniu fazy/etapu zadania
- Przeglądanie Pull Requestów
- Weryfikacja implementacji przed merge
- Audyt jakości kodu

## Workflow

### Krok 1: Zbierz kontekst

Przed analizą kodu ustal:

1. **Co miało być zrobione?** — przeczytaj plan/zadanie/specyfikację
2. **Jakie pliki się zmieniły?** — `git diff --name-only` lub `git status`
3. **Jaki jest zakres?** — tylko zmiany z danej fazy, nie cały projekt

### Krok 2: Wybierz checklisty

Na podstawie zmienionych plików, załaduj odpowiednie sekcje z `references/tech-stack-checklist.md`:

| Pliki | Sekcje do sprawdzenia |
|-------|----------------------|
| `*.tsx`, `*.ts` w `src/` | React 19, TypeScript |
| `*.tsx` z hooks | React 19 (zbędne useMemo/useCallback jeśli React Compiler, stary forwardRef) |
| `src/lib/supabase.ts`, `supabase/**` | Supabase (RLS, auth, client) |
| `*.css` z `@theme` | Tailwind CSS 4 (konfiguracja, zmienne CSS) |
| Komponenty UI | Tailwind CSS 4, shadcn/ui, Dostępność |
| `src/lib/sentry.ts`, error handling | Sentry (captureException, Error Boundary) |

### Krok 3: Analizuj kod

Dla każdego zmienionego pliku:

1. **Zgodność z planem** — czy realizuje wymagania?
2. **Poprawność** — błędy logiczne, edge cases?
3. **Bezpieczeństwo** — walidacja, XSS, wycieki danych?
4. **Wydajność** — N+1, bundle size, lazy loading?
5. **Race conditions** — useEffect cleanup, AbortController, state machines dla async?
6. **Jakość** — czytelność, DRY, nazewnictwo?
7. **Filozofia** — istniejący kod = surowe review, nowy izolowany = pragmatyczne

Techniki i przykłady feedbacku → `references/review-patterns.md`
Częste błędy w tym stacku → `references/common-issues.md`

### Krok 4: Klasyfikuj problemy
````
🔴 [blocking] KRYTYCZNE — blokuje merge
   - Błędy bezpieczeństwa
   - Crash/utrata danych
   - Wycieki danych (np. select("*") bez filtrowania kolumn)
   - Brak Error Boundary opakowującego krytyczne sekcje
   - Supabase: brak RLS policies na tabelach z danymi użytkowników
   - Sentry: brak captureException w blokach catch

🟠 [important] POWAŻNE — wymaga poprawy
   - Supabase: zapytania bez filtrów (brak .eq(), .match())
   - Problemy wydajnościowe
   - Brak WCAG compliance
   - Niespełnione wymagania
   - React 19: `useEffect` do fetchowania zamiast React Query
   - Tailwind 4: nadużywanie arbitrary values (`w-[123px]`) zamiast tokenów

🟡 [nit] DROBNE — zalecane
   - Niespójność stylu
   - Lepsze nazewnictwo
   - Brakujące typy
   - Przestarzałe wzorce (forwardRef, Context.Provider)
   - Zbędne useMemo/useCallback (jeśli React Compiler włączony)

🔵 [suggestion] SUGESTIE — opcjonalne
   - Alternatywne podejścia
   - Propozycje refaktoryzacji
````

### Krok 5: Wygeneruj raport

Użyj formatu z sekcji "Format raportu" poniżej.

## Format raportu
````markdown
## Code Review: [nazwa fazy/zadania]

### Podsumowanie
[Krótka ocena: ✅ gotowe / ⚠️ wymaga poprawek / ❌ wymaga znaczących zmian]

### Statystyki
- Plików sprawdzonych: X
- 🔴 [blocking]: X
- 🟠 [important]: X
- 🟡 [nit]: X
- 🔵 [suggestion]: X

### Problemy

#### 🔴 [blocking] Krytyczne
1. **[plik:linia]** — [opis]
   - Problem: [co jest źle]
   - Rozwiązanie: [jak naprawić]

#### 🟠 [important] Poważne
[jak wyżej]

#### 🟡 [nit] Drobne
1. **[plik:linia]** — [opis]

#### 🔵 [suggestion] Sugestie
1. [propozycja]

### Co zrobiono dobrze
- [pozytywne aspekty]

### Rekomendacja
- [ ] Gotowe do merge
- [ ] Wymaga drobnych poprawek
- [ ] Wymaga znaczących zmian
- [ ] Wymaga przeprojektowania
````

## Integracja z /dev-docs-review

Ten skill jest wywoływany przez slash komendę `/dev-docs-review [ścieżka] [numer-fazy]`.

**Input od subagenta:**
- Ścieżka do folderu zadania
- Numer fazy do review
- Lista zmienionych plików (z git)

**Output:**
- Plik `review-faza-X.md` z pełnym raportem
- Aktualizacja pliku zadań o problemy do poprawy
- Podsumowanie dla użytkownika

## Zasady

1. **Skup się na zakresie** — reviewuj tylko zmiany z danej fazy
2. **Bądź konkretny** — podawaj pliki, linie, przykłady
3. **Proponuj rozwiązania** — nie tylko wskazuj problemy
4. **Doceniaj** — zauważaj dobre rozwiązania
5. **Priorytetyzuj** — blocking > important > nit
6. **Istniejący kod = surowo** — każda dodana złożoność wymaga uzasadnienia
7. **Nowy izolowany kod = pragmatycznie** — jeśli działa i jest testowalny, nie blokuj postępu
8. **5-sekundowa reguła** — jeśli nie rozumiesz co robi funkcja/komponent w 5 sekund od nazwy, to zła nazwa

## Dokumentacja referencyjna

- **Checklisty techniczne** → `references/tech-stack-checklist.md`
- **Techniki feedbacku** → `references/review-patterns.md`
- **Częste błędy** → `references/common-issues.md`