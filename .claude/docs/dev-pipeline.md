# Pipeline dev-* — dokumentacja (mobile)

Data utworzenia: 2026-06-04
Źródło: compound-engineering-plugin (zaadaptowane do stacku Expo + React Native + TypeScript + NativeWind + Supabase)

---

## Pipeline — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → /dev-docs-execute ↔ /dev-docs-review → /dev-docs-complete → /dev-compound
                                                                                                                        ↓
                                                       dev-autopilot-wf (orkiestruje execute↔review→complete→compound)
                                                                                                          /dev-compound-refresh
```

Skille dev-* mogą być wywoływane programowo przez inne skille i agenty (bez `disable-model-invocation`).
Każdy skill działa BEZ argumentów (wyciąga kontekst z sesji). Argumenty są opcjonalne.

### Specyfika mobile — pipeline jako Dynamic Workflows

W tym szablonie część fazy implementacji jest zaimplementowana jako **Dynamic Workflows** —
deterministyczne orkiestratory w JavaScript w `.claude/workflows/*.js` (suffix `-wf`, żeby uniknąć
kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery i reviewerzy
to **leaf-agenci** wołani przez `agentType`. Pliki workflowów:

| Workflow | Plik | Co robi |
|----------|------|---------|
| `dev-autopilot-wf` | `.claude/workflows/dev-autopilot-wf.js` | Autonomiczny pipeline: bootstrap → per faza (execute → review → adversarial verify → fix) → complete → compound. Trzyma `PlanState` w kodzie, resume z checkboxów. |
| `dev-docs-execute-wf` | `.claude/workflows/dev-docs-execute-wf.js` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-mobile-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja dokumentacji. |
| `dev-docs-review-wf` | `.claude/workflows/dev-docs-review-wf.js` | Code review jednej fazy: 6 reviewerów równolegle (+ E2E) → dedup → adversarial verify każdego P1/P2 → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | `.claude/workflows/dev-docs-complete-wf.js` | Archiwizacja ukończonego zadania: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja dokumentacji projektu. |
| `dev-compound-wf` | `.claude/workflows/dev-compound-wf.js` | Dokumentuje rozwiązane problemy z sesji do `docs/solutions/` (tryb compact) i ocenia rule-worthy do `.claude/rules/learned-patterns.md`. |

Workflowy `*-wf` można odpalić standalone (z argumentami, np. `{sciezka, faza}`), albo dają się
orkiestrować przez `dev-autopilot-wf`. **Git walidujesz w sesji PRZED odpaleniem autopilota** —
workflow nie pyta o branch switch.

Skille fazy discovery/planowania (`/dev-ideate`, `/dev-brainstorm`, `/dev-plan`, `/dev-docs`,
`/dev-docs-update`, `/dev-compound-refresh`) pozostają zwykłymi skillami — nie mają wariantu `-wf`.

---

## Skille i workflowy — co robi każdy

### Faza discovery

#### `/dev-ideate`
**Cel:** Generowanie pomysłów na ulepszenia projektu.
**Kiedy:** Nie wiesz co budować. Chcesz zobaczyć co można poprawić.
**Jak działa:** 4 agenty skanują projekt z różnych perspektyw (tech debt, UX, performance, product), potem Devil's Advocate filtruje słabe pomysły.
**Output:** `docs/ideation/YYYY-MM-DD-topic-ideation.md`
**Następny krok:** `/dev-brainstorm [wybrany pomysł]`

#### `/dev-brainstorm`
**Cel:** Walidacja i doprecyzowanie pomysłu. Odpowiada na pytanie CO budować.
**Kiedy:** Masz pomysł ale nie masz jasnych wymagań. Chcesz przegadać scope, ryzyka, alternatywy.
**Jak działa:** Interaktywny dialog — jedno pytanie na raz, pressure test, eksploracja podejść.
**Output:** `docs/brainstorms/YYYY-MM-DD-topic-requirements.md` (requirements doc z: Problem, Wymagania R1/R2, Kryteria sukcesu, Granice scope'u)
**Następny krok:** `/dev-plan`

### Faza planowania

#### `/dev-plan`
**Cel:** Planowanie techniczne. Odpowiada na pytanie JAK budować.
**Kiedy:** Masz jasne wymagania (z brainstormu lub własne). Potrzebujesz planu technicznego z konkretnymi plikami, podejściem, testami.
**Jak działa:** Szuka requirements doc w `docs/brainstorms/`, skanuje repo (agenty research), tworzy Implementation Units. Każdy IU ma pole `Delegate to:` (builder mobile) i scenariusze E2E do weryfikacji na emulatorze.
**Output:** `docs/plans/YYYY-MM-DD-NNN-type-name-plan.md` z Implementation Units (Goal, Files, Approach, Test scenarios, Verification)
**Następny krok:** `/dev-docs`

#### `/dev-docs`
**Cel:** Tworzenie struktury zarządzania zadaniami do implementacji.
**Kiedy:** Masz plan (z dev-plan lub z rozmowy w plan mode). Chcesz zacząć implementację.
**Jak działa:** Szuka plan/requirements docs, tworzy branch git, generuje 3 pliki w `docs/active/[nazwa]/`.
**Output:** `docs/active/[nazwa]/` z: plan.md, kontekst.md, zadania.md + branch `feature/[nazwa]`
**Następny krok:** `dev-autopilot-wf docs/active/[nazwa]` lub `/dev-docs-execute docs/active/[nazwa]`

### Faza implementacji

#### `dev-autopilot-wf docs/active/[nazwa]`
**Cel:** Automatyczne wykonanie WSZYSTKICH faz implementacji z review i naprawami.
**Kiedy:** Masz gotową dokumentację w `docs/active/` i chcesz uruchomić cały pipeline bez ręcznej interwencji.
**Jak działa:** Dynamic Workflow (`.claude/workflows/dev-autopilot-wf.js`). Czyta plan, buduje `PlanState` i kolejkę faz. Per faza woła pod-workflowy: `dev-docs-execute-wf` → `dev-docs-review-wf` → (przy P1/P2) cykl fix. Po wszystkich fazach: `dev-docs-complete-wf` + `dev-compound-wf`.
**Output:** Zaimplementowany kod + archiwum w `docs/completed/` + wpis w `docs/solutions/`
**Resumability:** Ponowne wywołanie czyta stan z checkboxów i kontynuuje od ostatniej niekompletnej fazy.
**Stop conditions:** P1 po cyklu fix (limit cykli fix = 1 — drugi cykl naprawiał 0 findingów, a kosztował pełny re-review), błąd buildu/testów, git conflict. Walidację brancha robisz w sesji PRZED odpaleniem.

#### `/dev-docs-execute docs/active/[nazwa]` (workflow: `dev-docs-execute-wf`)
**Cel:** Wykonanie jednej fazy implementacji.
**Kiedy:** Masz gotową dokumentację w `docs/active/`. Chcesz zaimplementować kolejną fazę.
**Jak działa:** Planner czyta Implementation Units z planu, znajduje następną fazę. Każdy IU jest delegowany do buildera mobile przez `agentType` (`feature-builder-mobile-ui` | `feature-builder-mobile-data` | `feature-builder-mobile-fullstack`) — wartość z pola `Delegate to:` w IU. Strategia: inline (1-2 taski) lub równolegli sub-agenci (3+ tasków). Dla IU dotykających UI/fullstack doklejany jest mandatory kontekst designerski. Po zakończeniu: System-Wide Test Check, aktualizacja checkboxów, incremental commits.
**Output:** Zaimplementowany kod + zaktualizowana dokumentacja + commit(y)
**Następny krok:** `/dev-docs-review docs/active/[nazwa] [numer-fazy]` lub kolejny `/dev-docs-execute`

#### `/dev-docs-review docs/active/[nazwa] [numer-fazy]` (workflow: `dev-docs-review-wf`)
**Cel:** Code review wykonanej fazy.
**Kiedy:** Po `/dev-docs-execute` — chcesz sprawdzić jakość kodu przed kontynuacją.
**Jak działa:** 6 reviewerów równolegle (Security, Performance, Architecture, TypeScript, Spec-compliance) + osobny agent E2E. Następnie dedup → adversarial verify każdego P1/P2 (sceptycy próbują obalić finding) → scribe zapisuje raport i robi bookkeeping checkboxów `Weryfikacja:` → severity gate: P1 (blokuje) / P2 (zastrzeżenia) / P3 (OK).
**Weryfikacja E2E:** Agent `feature-tester-mobile-e2e` (skill `mobile-e2e-maestro`) — testuje na emulatorze iOS/Android przez **Maestro CLI**, NIE przez agent-browser/Playwright. Sprawdza checkboxy `Weryfikacja:` z checklisty: interakcje, nawigację, gesty (swipe, scroll, long press), deep linking, accessibility (VoiceOver/TalkBack), visual regression. Jeśli zadanie ma `figma_screens` — robi side-by-side visual comparison z mockupami przez screenshot Maestro. Najpierw sprawdza czy emulator/Metro żyje (`curl localhost:8081/status`).
**Output:** `docs/active/[nazwa]/review-faza-X.md` + checkboxy do poprawy w zadaniach
**Następny krok:** `/dev-docs-execute` (poprawki) lub kolejna faza

#### `/dev-docs-update docs/active/[nazwa]`
**Cel:** Zapisanie stanu pracy przed resetem kontekstu (kompaktowanie).
**Kiedy:** Sesja się kończy, kontekst się zapełnia, chcesz zabezpieczyć postęp.
**Jak działa:** Commituje WIP, aktualizuje 3 pliki zadania, dokumentuje niedokończoną pracę.
**Output:** Zaktualizowana dokumentacja + WIP commit

### Faza zamknięcia

#### `/dev-docs-complete [nazwa]` (workflow: `dev-docs-complete-wf`)
**Cel:** Archiwizacja ukończonego zadania.
**Kiedy:** Wszystkie fazy zrobione, testy przechodzą, feature gotowy.
**Jak działa:** Weryfikuje ukończenie, wyciąga wnioski, przenosi `docs/active/<zadanie>` → `docs/completed/`, aktualizuje dokumentację projektu.
**Output:** `docs/completed/[nazwa]/` z podsumowaniem
**Następny krok:** Sugestia `/dev-compound` do udokumentowania rozwiązanych problemów

### Knowledge capture

#### `/dev-compound` (workflow: `dev-compound-wf`)
**Cel:** Dokumentowanie rozwiązanego problemu do bazy wiedzy.
**Kiedy:** Po rozwiązaniu problemu — bugfix, workaround, konfiguracja. Chcesz żeby następnym razem ten problem nie zabierał czasu.
**Jak działa:** Bez argumentów = wyciąga kontekst z sesji autonomicznie. Z argumentem = użyj jako opis. Compact mode domyślny, `--full` dla pełnego formatu. Dodatkowo, jeśli problem jest "rule-worthy", dodaje regułę do `.claude/rules/learned-patterns.md` (ładowana automatycznie do każdej sesji).
**Output:** `docs/solutions/[category]/YYYY-MM-DD-title.md` + opcjonalnie reguła w `.claude/rules/learned-patterns.md`
**Kategorie:** build-errors, runtime-errors, supabase-issues, auth-issues, ui-bugs, performance-issues, typescript-errors, deployment-issues, testing-issues

#### `/dev-compound-refresh`
**Cel:** Przegląd aktualności bazy wiedzy.
**Kiedy:** Co kilka tygodni, po dużym refaktorze, po upgrade'ach dependencies (np. SDK Expo).
**Jak działa:** Autonomicznie przegląda WSZYSTKIE docs/solutions/. Dla każdego: Keep (aktualne) / Update (drobne zmiany) / Replace (nowe rozwiązanie) / Archive (problem nie istnieje). Archiwizuje do `docs/solutions/_archived/`. Dodatkowo przegląda `.claude/rules/learned-patterns.md`: usuwa reguły po Archive, aktualizuje po Replace, deduplikuje, pilnuje limitu ~50.
**Output:** Raport z akcjami + zarchiwizowane/zaktualizowane dokumenty + zaktualizowany learned-patterns.md

---

## Agenty — kto co robi

### Buildery mobile (używane przez `dev-docs-execute-wf`)
| Agent | Rola |
|-------|------|
| `feature-builder-mobile-ui` | Warstwa UI mobile: komponenty React Native, Expo Router, NativeWind, native tabs, animacje Reanimated, safe-area, dostępność iOS VoiceOver / Android TalkBack. Wybierany gdy IU dotyka tylko prezentacji (`*.tsx` w `app/`, `components/`, `screens/`, native config). |
| `feature-builder-mobile-data` | Warstwa danych mobile: Supabase queries z mobile-aware secure storage, RLS, walidacja Zod, Edge Functions, deep linking dla OAuth, expo-secure-store. Wybierany gdy IU dotyka tylko danych (`lib/`, `hooks/use<X>Data.ts`, `supabase/migrations`, `supabase/functions`). |
| `feature-builder-mobile-fullstack` | Feature dotykający równolegle UI i danych (formularze z auth + deep linking, ekrany z fetchem, CRUD end-to-end). Wybierany gdy IU jest cross-layer i nie da się go rozsądnie podzielić. |

### Tester E2E mobile (używany przez `dev-docs-review-wf`)
| Agent | Rola |
|-------|------|
| `feature-tester-mobile-e2e` | Weryfikuje scenariusze E2E na emulatorze iOS/Android przez **Maestro CLI** (skill `mobile-e2e-maestro`). Interakcje, nawigacja, gesty (swipe, scroll, long press, pinch), input, deep linking, OAuth flow, biometry, accessibility, visual regression. Sprawdza checkboxy `Weryfikacja:`. To mobilny odpowiednik webowego agent-browser — w mobile **nie używamy** agent-browser/Playwright. |

### Research (używane przez `/dev-plan`)
| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Skanuje strukturę repo, konwencje, wzorce |
| `learnings-researcher` | Szuka w `docs/solutions/` powiązanych rozwiązań |
| `best-practices-researcher` | Szuka best practices online (Context7, WebSearch) |
| `framework-docs-researcher` | Szuka dokumentacji framework'ów/bibliotek (Expo, React Native, NativeWind, Supabase) |

### Review (używane przez `dev-docs-review-wf`)
| Agent | Rola |
|-------|------|
| `security-sentinel` | Auth, RLS, XSS, Zod validation, API key exposure, expo-secure-store |
| `performance-oracle` | N+1, bundle size, lazy loading, memoizacja, useEffect cleanup |
| `kieran-typescript-reviewer` | Type safety, brak `any`/`as`/`!`, discriminated unions, explicit return types, naming |
| `architecture-strategist` | SOLID, component boundaries, coupling, circular deps, import organization, granice warstw |
| `spec-flow-analyzer` | Zgodność implementacji ze spec/planem IU: under-implementation, scope creep / over-implementation, błędna implementacja. Cytuje linie spec/IU |
| `code-simplicity-reviewer` | YAGNI, redundancja, uproszczenia |

---

## Struktura katalogów

```
docs/
├── brainstorms/              ← requirements docs z /dev-brainstorm
├── plans/                    ← plany techniczne z /dev-plan
├── ideation/                 ← pomysły z /dev-ideate
├── decisions/                ← decyzje architektoniczne projektu
└── solutions/                ← rozwiązane problemy z /dev-compound
    ├── build-errors/
    ├── runtime-errors/
    ├── supabase-issues/
    ├── auth-issues/
    ├── ui-bugs/
    ├── performance-issues/
    ├── typescript-errors/
    ├── deployment-issues/
    ├── testing-issues/
    └── _archived/

    active/                   ← aktywne zadania z /dev-docs
    │   └── [nazwa-zadania]/
    │       ├── [nazwa]-plan.md
    │       ├── [nazwa]-kontekst.md
    │       └── [nazwa]-zadania.md
    └── completed/                ← zarchiwizowane z /dev-docs-complete
        └── [nazwa-zadania]/
            ├── [nazwa]-plan.md
            ├── [nazwa]-kontekst.md
            ├── [nazwa]-zadania.md
            └── [nazwa]-podsumowanie.md
```

---

## Typowe scenariusze użycia

### Scenariusz 1: Nowy feature od zera
```
/dev-ideate                          ← "co można poprawić?"
/dev-brainstorm offline sync         ← doprecyzuj wybrany pomysł
/dev-plan                            ← plan techniczny (IU z Delegate to: builder mobile)
/dev-docs                            ← struktura zadań
/dev-docs-execute docs/active/offline-sync   ← faza 1 (buildery mobile)
/dev-docs-review docs/active/offline-sync 1  ← review (6 reviewerów + Maestro E2E)
/dev-docs-execute docs/active/offline-sync   ← faza 2
/dev-docs-complete offline-sync      ← archiwizacja
```

### Scenariusz 2: Bugfix z dokumentacją
```
[rozmowa: naprawiasz buga]
/dev-compound                        ← udokumentuj rozwiązanie do docs/solutions/
```

### Scenariusz 3: Szybki feature (bez pełnego pipeline'u)
```
[rozmowa + plan mode]
/dev-docs                            ← od razu do struktury zadań
/dev-docs-execute docs/active/nazwa   ← implementuj (builder mobile)
/dev-docs-complete nazwa             ← zamknij
```

### Scenariusz 4: Maintenance bazy wiedzy
```
/dev-compound-refresh                ← przejrzyj wszystkie docs/solutions/
/dev-compound-refresh supabase-issues ← przejrzyj tylko jedną kategorię
```

### Scenariusz 5: Pełny autopilot (Dynamic Workflow)
```
/dev-brainstorm offline sync         ← doprecyzuj pomysł
/dev-plan                            ← plan techniczny
/dev-docs                            ← struktura zadań
[zwaliduj git/branch w sesji]        ← autopilot nie pyta o branch switch
dev-autopilot-wf docs/active/offline-sync   ← WSZYSTKO automatycznie:
                                          dev-docs-execute-wf fazy 1..N (buildery mobile)
                                          dev-docs-review-wf każdej fazy (6 reviewerów + Maestro E2E)
                                          adversarial verify + fix jeśli P1/P2 (1 cykl)
                                          dev-docs-complete-wf + dev-compound-wf
```
