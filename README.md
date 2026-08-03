# Workspace Template Mobile

> Opiniowany starter Claude Code dla product engineering **mobile** na stacku **Expo (React Native) + TypeScript + Supabase + NativeWind**.
> Kompletny katalog `.claude/` (skille, agenci, workflowy, reguły, hooki) + pipeline `dev-*` od pomysłu do wdrożenia — z autonomicznym autopilotem, code review multi-agent, E2E na emulatorze przez Maestro i kumulowaniem wiedzy.

**Ostatnia aktualizacja:** 2026-07-12 · **Repo:** `AIBiz-Automatyzacje/workspace-template-mobile` · Wariant webowy: [`claude-code-starter`](https://github.com/AIBiz-Automatyzacje/claude-code-starter)

---

## Szybki start

Sklonuj → skopiuj katalog `.claude/` do swojego projektu Expo → masz gotowy, spójny system pracy z Claude Code.

```bash
npx degit AIBiz-Automatyzacje/workspace-template-mobile/.claude .claude
```

Albo bez terminala — wklej w asystencie AI:

```
Pobierz folder `.claude/` z brancha main repo
https://github.com/AIBiz-Automatyzacje/workspace-template-mobile
i skopiuj go do głównego katalogu mojego projektu. Jeśli `.claude/` już
istnieje — najpierw pokaż mi diff i poczekaj na potwierdzenie. Na koniec
podsumuj co wylądowało (skille/agenci/hooki/workflowy).
```

Co dostajesz:

- **Pipeline `dev-*`** — od ideacji, przez plan, po autonomiczną implementację z review i naprawami (`dev-autopilot-wf`).
- **Skille `expo-*` / `eas-*`** — 13 oficjalnych skilli Expo (upstream: [`expo/skills`](https://github.com/expo/skills), konwencja `expo-*` = framework OSS, `eas-*` = płatny serwis EAS) + hub `expo-overview` z decision tree.
- **Skille techniczne** pod stack — Supabase, UX/UI mobile (iOS HIG vs Material 3), bezpieczeństwo (OWASP + Mobile Top 10), Sentry, Maestro E2E, EAS Update.
- **15 wyspecjalizowanych agentów** — buildery warstw mobile, reviewerzy, tester E2E, research.
- **Knowledge compounding** — rozwiązane problemy (`docs/solutions/`), reguły (`learned-patterns.md`) i żywy słownik domenowy (`docs/CONCEPTS.md`).
- **Reguły kodowania** i katalog anty-patternów AI (`.claude/rules/coding-rules.md`).

---

## Bonus: Output Style „adhd"

Masz dość gadatliwych odpowiedzi? W [`output-styles/adhd.md`](output-styles/adhd.md) znajdziesz
gotowy Output Style, który sprawia, że Claude zaczyna od konkretu zamiast ściany tekstu.
Napisany według wytycznych Anthropic dla modeli z serii 5 (zero zakazów — opisany cel,
resztę model wyprowadza sam). Inspiracja: skill [i-have-adhd](https://github.com/ayghri/i-have-adhd)
z wiralowego wątku na r/ClaudeAI.

1. Skopiuj `output-styles/adhd.md` do folderu `.claude/output-styles/` w swoim projekcie
   (albo do `~/.claude/output-styles/` globalnie).
2. Zrestartuj sesję Claude Code.
3. Wpisz `/config`, wybierz **Output style → adhd** i zatwierdź enterem.

---

## Changelog

| Data | Zmiana |
|------|--------|
| **2026-08-03** | **Port ulepszeń z `claude-code-starter` (web, commity `eb5ad6c..cc29eb5`):** **routing reviewerów v2 (domenowy)** — flagi warstw od context-packagera zamiast progu „≤2 pliki" (rdzeń security/spec/simplicity/test zawsze; perf/arch/ts/E2E warunkowo, fail-open bez flag; E2E z drugą furtką na checkboxy `[E2E]`), sekcja `## Przebieg review` w raporcie + metryki routingu/dedupu/verify w stanie i telemetrii, **bloki GRANICE ZAUFANIA** (skrypty migracyjne/ETL/seedy = granica API; też w `security-sentinel` i `coding-rules §9`) i **LIMIT P3** (max 5 akcyjnych nitów per reviewer), **zrzut diffu fazy jako artefakt** (packager pisze do /tmp, reviewerzy czytają 1 Readem), **odzyskiwanie scribe'a** (inspektor dysku po padzie — raport kompletny = nie powtarzamy review), **guard plików binarnych po fixie** (surowe bajty sterujące w pliku źródłowym = STOP zamiast serii APIErrorów), **tokeny per etap** (execute/review/fix osobno) i telemetria całego zadania (fazy z wcześniejszych runów ze stanu). Nowe skille: **`sync-template`** (aktualizacja `.claude/` z szablonu w projektach potomnych), **`coderabbit-setup`** (AI review PR-ów), Output Style **`adhd`**. **Sync `expo/skills`:** housekeeping linków wersjonowanych docs w `expo-upgrade`, wskazanie na `expo-migrate-module` w `expo-module`, nowy skill **`expo-project-structure`** (struktura greenfield). |
| **2026-07-12** | **Port ulepszeń z `claude-code-starter` (web):** słownik domenowy `docs/CONCEPTS.md` (writer w `dev-compound`, readerzy w plan/docs/builderach, scoped `compound-refresh` w autopilocie), audyt skilli technicznych (OWASP Top 10:2025, `user_metadata` → reguła w `coding-rules §9`, Stripe v22, `search_path=''`, Sentry Deno 2.x, `getClaims()`), **8. reviewer** (`code-simplicity-reviewer`) + **routing reviewerów wg mapy zmian** + **dedup semantyczny (Haiku)** w review-wf, **targeted verify P1/KOD po fixie**, retry scribe'a + flaga `scribeFail`, warmup degraduje zamiast STOP, readerzy `learned-patterns.md` (planner/reviewerzy/buildery), audyt console.log/Sentry w domknięciu fazy, poprawna semantyka RESUME (świeży run po STOP bramki vs resume po awarii), skille `/dev-docs-execute`+`/dev-docs-review` = cienkie wrappery na workflowy, `web-research-specialist` w brainstorm/ideate, usunięty skażony `auto-error-resolver`, lokalny skill `figma-design-to-code` (poprzednia nazwa nie istniała), ujednolicona ścieżka `docs/brainstorms/`, **`/freshness-audit`** (cykliczny audyt skilli w żywych źródłach; `expo-*` poza zakresem — upstream-owned), telemetria runów autopilota (`~/.claude/telemetry/autopilot-runs.jsonl`), pola `paths` w skillach guideline. **Sync skilli Expo z upstream po reorganizacji `expo/skills` (2026-07-07, PR #98):** nowa konwencja nazw `expo-*`/`eas-*` (m.in. `expo-building-native-ui`→`expo-native-ui`, `expo-native-data-fetching`→`expo-data-fetching`, `expo-api-routes`→`eas-hosting`, `expo-deployment`→`eas-app-stores`, `expo-cicd-workflows`→`eas-workflows`, `expo-upgrading`→`expo-upgrade`, `expo-use-dom`→`expo-dom`, `expo-ui-swift-ui`+`expo-ui-jetpack-compose`→`expo-ui`), **nowy skill `expo-router`** (nawigacja), aktualizacja treści wszystkich skilli do stanu upstream, polskie opisy zachowane. |
| 2026-06-24 | Domknięte trzy fałszywe zielone, przez które autopilot cicho pomijał E2E; wcześniej: flow Maestro + seed jako deliverables buildera, bramka opt-in E2E (twardy STOP zamiast cichego pominięcia). |
| 2026-06-11 | **Autonomiczne E2E w autopilocie** — środowisko zarządzane z `.env.e2e` (dedykowany projekt Supabase e2e, Metro + simulator z dev-clientem, seedy per faza). |
| 2026-06-09 | **Przebudowa 4 filarów po audycie (27 findingów)** + smoke-harness: stan maszynowy `.autopilot-state.json`, BLOK długich komend (watchdog), gate'y liczone w JS, `.claude/templates/smoke-autopilot/`. |
| 2026-06-04 | Synchronizacja pipeline z szablonem web: reviewer spec-compliance, frame'y ideacji, reguły TDD (tracer bullets), seam rule. |
| 2026-05-31 | Dev Autopilot jako **Dynamic Workflows** (`.claude/workflows/*-wf.js`) — mobilka była tu pierwsza; web przejął ten model 2026-06-21. |
| 2026-05-20 | Sync skilli Expo z upstream (`expo/skills @ main`): + `expo-api-routes`, re-sync `expo-module`. |
| 2026-05-11 | Skill `ux-ui-guidelines-mobile` (research: Apple/Google official, Hoober, teardowny premium apek); `sentry-integration` w builderach mobile. |
| 2026-05-05 | Wyprowadzenie mobile template z `workspace-template` (web → Expo + EAS + Maestro). |

---

## Pipeline `dev-*` — przegląd

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → [ dev-autopilot-wf ] → gotowe
  (pomysły)     (CO budować)     (JAK)      (struktura)   (cały pipeline auto)

dev-autopilot-wf orkiestruje:
  bootstrap → per faza( execute-wf → review-wf + adversarial verify → fix ) → compound-wf → compound-refresh(scoped) → complete-wf
```

Zasady ogólne:
- Skille `dev-*` **działają BEZ argumentów** (wyciągają kontekst z sesji). Argumenty są opcjonalne.
- Fazę implementacji domyślnie prowadzi **`dev-autopilot-wf`** (dynamic workflow). Skille `/dev-docs-execute` i `/dev-docs-review` możesz odpalać też ręcznie, faza po fazie.

### Dynamic Workflows (`-wf`)

Deterministyczne orkiestratory w JavaScript w `.claude/workflows/*.js` (suffix `-wf`, by uniknąć kolizji nazw ze skillami). Orkiestrator trzyma plan i sterowanie w kodzie, a buildery/reviewerzy to **leaf-agenci** wołani przez `agentType`.

| Workflow | Co robi |
|----------|---------|
| `dev-autopilot-wf` | Autonomiczny pipeline: bootstrap (stan z `.autopilot-state.json` + rozgrzewka cache testów + środowisko E2E) → per faza (execute → review + adversarial verify → fix + targeted verify P1) → compound → **compound-refresh (scoped)** → complete → **telemetria** (1 linia JSONL do globalnego `~/.claude/telemetry/autopilot-runs.jsonl`). |
| `dev-docs-execute-wf` | Wykonanie JEDNEJ fazy: planner czyta Implementation Units z `docs/plans/`, buildery `feature-builder-mobile-*` implementują je przez `agentType`, potem walidacja + commit + aktualizacja docs. |
| `dev-docs-review-wf` | Review jednej fazy: context-packager → routing reviewerów wg mapy zmian (rdzeń zawsze; perf/architektura warunkowo na małych fazach) → do 8 reviewerów równolegle (w tym E2E Maestro) → dedup 2-przebiegowy (JS + semantyczny Haiku) → adversarial verify P1/P2 → scribe zapisuje raport + bookkeeping checkboxów `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | Archiwizacja: `docs/active/<zadanie>` → `docs/completed/`, podsumowanie, aktualizacja docs projektu, commit. |
| `dev-compound-wf` | Dokumentuje rozwiązane problemy do `docs/solutions/`, ocenia rule-worthy do `learned-patterns.md`, aktualizuje `docs/CONCEPTS.md`. |
| `freshness-audit-wf` | Cykliczny audyt aktualności skilli technicznych: twierdzenia o świecie (wersje, piny, wzorce API) → weryfikacja w **żywych** źródłach (docs, changelogi GitHub, npm — zakaz pamięci modelu) → adversarial verify P1/P2 → raport do `docs/reviews/freshness-<data>.md`. Nic nie zmienia w skillach. Skille `expo-*` poza zakresem (upstream-owned). |

**Jak odpalać:** toolem `Workflow`, np. `Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js"}, args)`.
**RESUME po przerwanym runie:** `Workflow({scriptPath, resumeFromRunId})` + **ZAWSZE przekaż `args` ponownie** (nie przeżywają między wywołaniami). Po **STOP bramki** (środowisko E2E, fix FAIL, nierozwiązane P1), gdy coś naprawiłeś — **świeży run bez resume** (stan faz wznowi się z `.autopilot-state.json`; resume zwróciłby porażkę bramki z cache).

---

## Skille — pełna lista

### Pipeline `dev-*`

#### Discovery

**`/dev-ideate`** — generowanie pomysłów na ulepszenia. Agenty skanują projekt z różnych perspektyw (+ opcjonalny zewnętrzny grounding przez `web-research-specialist`), Devil's Advocate filtruje słabe. → `docs/ideation/`

**`/dev-brainstorm`** — walidacja pomysłu (**CO** budować). Interaktywny dialog: jedno pytanie na raz, pressure test, eksploracja podejść, opcjonalny research prior art. → `docs/brainstorms/*-requirements.md`

#### Planowanie

**`/dev-plan`** — planowanie techniczne (**JAK** budować). Szuka requirements w `docs/brainstorms/`, skanuje repo agentami research, tworzy Implementation Units (Goal, Files, Approach, Test scenarios, Verification). Czyta `docs/CONCEPTS.md`. Dla scenariuszy `[E2E]` stosuje konwencję zarządzanego harnessu (§3.4b): flow `.maestro/<flow>.yaml` + idempotentny seed jako deliverables **buildera**, granice możliwości Maestro (natywne powierzchnie OS → inject przez service_role albo `[Manual]`). → `docs/plans/`

**`/dev-docs`** — struktura zarządzania zadaniem. Tworzy branch `feature/[nazwa]` + 3 pliki w `docs/active/[nazwa]/` (plan, kontekst, zadania). Wciąga kontekst designerski (SPEC.md/DESIGN.md/Figma) do `kontekst.md`.

#### Implementacja

**`dev-autopilot-wf docs/active/[nazwa]`** *(workflow, domyślna ścieżka)* — automatyczne wykonanie WSZYSTKICH faz z review i naprawami. Bootstrap stawia środowisko E2E (gdy `.env.e2e` istnieje: **twardy STOP** dopóki Metro + simulator z dev-clientem nie są gotowe — zamiast cichej degradacji E2E do OPERATOR).
- **Stop conditions:** P1 po cyklu fix (limit fix = 1; każdy P1/KOD po fixie przechodzi dodatkowo **niezależny targeted verify**), błąd buildu/testów, scribe padł 2x, środowisko E2E niegotowe przy opt-in.
- **Myk:** walidację brancha robisz **w sesji PRZED** odpaleniem — workflow nie pyta o branch switch.

**`/dev-docs-execute docs/active/[nazwa]`** *(workflow: `dev-docs-execute-wf`)* — wykonanie jednej fazy. Każdy IU delegowany przez `agentType` (pole `Delegate to:`): `feature-builder-mobile-ui` | `feature-builder-mobile-data` | `feature-builder-mobile-fullstack`. Dla IU dotykających UI doklejany mandatory kontekst designerski (1pt Figma = 1px NativeWind).

**`/dev-docs-review docs/active/[nazwa] [faza]`** *(workflow: `dev-docs-review-wf`)* — code review fazy: do **8 reviewerów równolegle** (Security, Performance, Architecture, TypeScript, Spec-compliance, Simplicity/YAGNI, Test-coverage, E2E Maestro) → dedup → **adversarial verify** P1/P2 (**P1 = 3 sceptyków, P2 = 1**) → scribe + severity gate.
- **Myk E2E:** `feature-tester-mobile-e2e` testuje na **emulatorze** (Maestro CLI) przez Metro na bazie `.env.e2e`. Zbiera checkboxy `[E2E]` z OBU prefiksów (`Test:` + `Weryfikacja:`). Przy `figma_screens` robi side-by-side visual diff z mockupami. Bez `.env.e2e` weryfikacje E2E lądują jako OPERATOR.

**`/dev-docs-update docs/active/[nazwa]`** — zapis stanu przed kompaktowaniem kontekstu.

#### Zamknięcie i knowledge capture

**`/dev-docs-complete [nazwa]`** — archiwizacja ukończonego zadania → `docs/completed/`.

**`/dev-compound`** — dokumentowanie rozwiązanego problemu → `docs/solutions/[category]/`. Rule-worthy → `learned-patterns.md`; termin domenowy → `docs/CONCEPTS.md` (Krok 4.5).

**`/dev-compound-refresh`** — przegląd aktualności bazy wiedzy (Keep / Update / Replace / Archive; dedup `learned-patterns.md` i `CONCEPTS.md`). W autopilocie odpala się **automatycznie, ale scoped**.

### Skille `expo-*` / `eas-*` (upstream-owned)

14 skilli z oficjalnego repo **[`expo/skills`](https://github.com/expo/skills)** (stan po reorganizacji upstream 2026-07-07: `expo-*` = framework OSS, `eas-*` = płatny serwis EAS) + polskie opisy we frontmatter (nasza jedyna lokalna warstwa). **Nie modyfikujemy ich treści własnoręcznie** — aktualizacja wyłącznie przez sync diff z upstreamem (pomijamy katalogi `agents/` i sekcje „Submitting Feedback" z telemetrią upstreamu).

Hub: **`expo-overview`** (decision tree: który skill wybrać) → `expo-project-structure`, `expo-native-ui`, `expo-router`, `expo-tailwind-setup`, `expo-data-fetching`, `expo-ui`, `expo-dev-client`, `expo-module`, `expo-dom`, `expo-upgrade`, `eas-app-stores`, `eas-workflows`, `eas-hosting`, `eas-update-insights`.

W upstreamie są też skille nie zaimportowane (nisza poza core flow): `expo-brownfield`, `expo-app-clip`, `expo-web-to-native`, `expo-examples`, `eas-simulator`, `eas-observe`, `expo-skill-feedback` oraz plugin `expo-experiments` (m.in. `expo-migrate-module`).

### Skille techniczne (guidelines pod stack)

| Skill | Zakres |
|-------|--------|
| **`supabase-dev-guidelines`** | Auth (OAuth przez deep linking `yourapp://`, PKCE z jawnym exchange), `expo-secure-store` jako storage sesji, PostgreSQL, RLS (`(SELECT auth.uid())`), SECURITY DEFINER (`search_path=''`), Edge Functions (Deno, Stripe v22), Realtime + AppState lifecycle, offline-first. |
| **`ux-ui-guidelines-mobile`** | iOS HIG vs Material 3, typografia natywna (SF Pro/Roboto, Dynamic Type), 8pt grid + safe areas, dark mode, motion (Reanimated 3), haptics, FlashList, bottom sheets, accessibility (VoiceOver/TalkBack), pułapki AI-generowanego UI, teardowny premium apek. |
| **`security`** | Audyt bezpieczeństwa mobile: **OWASP Top 10:2025 + Mobile Top 10 (2024)**, RLS, `app_metadata` vs `user_metadata`, sekrety w bundlu (`EXPO_PUBLIC_*` jest publiczne!), SecureStore, deep linking, WebView. |
| **`sentry-integration`** | Error tracking dla React Native + Edge Functions (Deno 2.x): `beforeSend`, `withScope`, `defaultIntegrations: false`, GDPR maskowanie. |
| **`mobile-e2e-maestro`** | E2E na emulatorze przez Maestro CLI: tap/scroll/gesty, deep linking, asercje, screenshoty, **granice możliwości** (natywnych powierzchni OS nie dotknie — inject przez service_role). |
| **`eas-update-insights`** | Health check OTA updateów EAS: crash rate, install/launch counts, embedded vs OTA per channel. |
| **`code-quality`** | Audyt jakości (stack-agnostic): architektura, performance, prostota (YAGNI), wzorce. |
| **`code-review`** | Code review pod stack — raport z klasyfikacją problemów. |
| **`bugfix`** | Systematyczna naprawa bugów (Sentry, failujące E2E, zgłoszenia). |

### Skille narzędziowe

| Skill | Do czego |
|-------|----------|
| **`figma-design-to-code`** | Implementacja designu Figma jako kod (design→code). Zaimportowany lokalnie z oficjalnego pluginu Figma — działa też bez pluginu. Preładowany do builderów UI/fullstack. |
| **`sync-template`** | Aktualizacja maszynerii `.claude/` z tego repo szablonu w projektach potomnych (klon → diff SHA → backup → apply; „szablon zawsze wygrywa", pliki lokalne projektu nietknięte). |
| **`coderabbit-setup`** | Generuje `.coderabbit.yaml` pod stack projektu (Expo/RN, Supabase…) + weryfikuje instalację aplikacji GitHub CodeRabbit — AI review każdego PR-a. |
| **`zroastuj-mnie`** | Bezlitosny wywiad stress-testujący plan/projekt; sugeruje utrwalenie terminów do `docs/CONCEPTS.md`. |
| **`gemini`** | Gemini CLI jako subagent (druga opinia: analiza kodu, audyt UX/security). |
| **`freshness-audit`** *(workflow: `freshness-audit-wf`)* | Cykliczny audyt aktualności skilli technicznych w **żywych** źródłach. Odpalaj okresowo (np. raz w miesiącu). `expo-*` poza zakresem — ich świeżość to sync z upstreamem. |
| **`dev-autopilot`** *(legacy)* | Ręczna orkiestracja pipeline'u. Domyślną ścieżką jest `dev-autopilot-wf`. |

---

## Agenci — pełna lista (15)

### Buildery warstw mobile (wołane przez `dev-docs-execute-wf`)

| Agent | Rola |
|-------|------|
| `feature-builder-mobile-ui` | Warstwa UI: komponenty RN, Expo Router, NativeWind, native tabs, Reanimated, VoiceOver/TalkBack. Czyta kontekst designerski + `docs/CONCEPTS.md` + `learned-patterns.md`. |
| `feature-builder-mobile-data` | Warstwa danych: Supabase queries z mobile-aware secure storage, RLS, migracje, Zod, Edge Functions, deep linking OAuth. |
| `feature-builder-mobile-fullstack` | Cross-layer (UI + dane naraz): formularze z auth + deep linking, ekrany z fetchem, CRUD end-to-end. |

### Reviewerzy i tester (wołani przez `dev-docs-review-wf` — do 8 równolegle)

| Agent | Rola |
|-------|------|
| `security-sentinel` | Auth, RLS, ekspozycja sekretów, walidacja Zod, OWASP. |
| `performance-oracle` | N+1, bundle size, memoizacja, cleanup `useEffect`. |
| `kieran-typescript-reviewer` | Type safety, brak `any`, modern patterns. |
| `architecture-strategist` | SOLID, granice warstw, coupling, circular deps. |
| `spec-flow-analyzer` | Zgodność ze spec/planem IU: under-implementation, scope creep, błędna implementacja. |
| `code-simplicity-reviewer` | YAGNI, zbędna złożoność, martwy kod. |
| `feature-tester-mobile-e2e` | E2E na emulatorze (Maestro) — checkboxy `[E2E]`, visual diff z Figmą. |

> Test-coverage w review-wf pokrywa domyślny agent (happy path, invalid inputs, boundary, brakujące testy).

### Research (wołani przez `dev-plan`, `dev-brainstorm`, `dev-ideate`)

| Agent | Rola |
|-------|------|
| `repo-research-analyst` | Struktura repo, konwencje, wzorce implementacyjne. |
| `learnings-researcher` | Szuka w `docs/solutions/` + `docs/CONCEPTS.md` powiązanych wniosków. |
| `best-practices-researcher` | Best practices online (Context7, WebSearch). |
| `framework-docs-researcher` | Dokumentacja frameworków/bibliotek, wersje, ograniczenia. |
| `web-research-specialist` | Iteracyjny research w sieci — prior art, wzorce konkurencji. |

---

## Słownik domenowy — `docs/CONCEPTS.md`

Żywy glosariusz pojęć o znaczeniu **specyficznym dla projektu** (encje, nazwane procesy, statusy/enumy o niestandardowym sensie). Forma: **cienki indeks** — `## Termin` + 1-2 zdania + link do szczegółów w `CLAUDE.md`.

- **Zasilany** przez `/dev-compound` (Krok 4.5).
- **Czytany** przez `dev-plan`, `dev-docs`, buildery i `learnings-researcher` — żeby nie „naprawiać" zachowania wbrew definicjom.
- **Utrzymywany** przez `/dev-compound-refresh` (dedup, usuwanie martwych haseł).

---

## Reguły, hooki, szablony

- **`.claude/rules/coding-rules.md`** — 14 sekcji reguł + **katalog 10 anty-patternów AI**. Ładowane do każdej sesji.
- **`.claude/rules/learned-patterns.md`** — reguły wyprodukowane przez `/dev-compound` (per projekt, limit ~50).
- **`.claude/hooks/`** — `mobile-anti-pattern-check.sh`, `error-handling-reminder.sh`, `stop-build-check-enhanced.sh`.
- **`.claude/templates/e2e-env/`** — opcjonalne środowisko E2E (Maestro na dedykowanym projekcie Supabase e2e). Opt-in przez `.env.e2e`. Lekcje z boju: pooler zamiast direct (IPv6), kompletne seedy.
- **`.claude/templates/smoke-autopilot/`** — smoke-test po każdej zmianie `.claude/workflows/*-wf.js`.

---

## Struktura katalogów

```
docs/
├── ideation/                 ← pomysły z /dev-ideate
├── brainstorms/              ← requirements docs z /dev-brainstorm
├── plans/                    ← plany techniczne z /dev-plan
├── CONCEPTS.md               ← słownik domenowy (żywy)
├── solutions/                ← rozwiązane problemy z /dev-compound
├── reviews/                  ← raporty freshness-audit
├── active/                   ← aktywne zadania z /dev-docs
│   └── [nazwa]/  { plan.md · kontekst.md · zadania.md · .autopilot-state.json }
└── completed/                ← zarchiwizowane z /dev-docs-complete

.maestro/                     ← flow E2E (<flow>.yaml) + seedy (<flow>-seed.sql) + inject-*.js
```

---

## Typowe scenariusze

**1. Pełny autopilot (rekomendowane dla większych zmian)**
```
/dev-brainstorm ekran onboardingu        ← doprecyzuj CO
/dev-plan                                ← plan techniczny (IU)
/dev-docs                                ← struktura zadań + branch
# zwaliduj branch w sesji, potem:
dev-autopilot-wf docs/active/onboarding  ← execute→review→fix→compound→refresh→complete
```

**2. Nowy feature krok po kroku (ręczna kontrola)**
```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs
/dev-docs-execute docs/active/nazwa
/dev-docs-review  docs/active/nazwa 1
/dev-docs-complete nazwa
```

**3. Bugfix z dokumentacją**
```
/bugfix [opis lub link Sentry]
/dev-compound
```

**4. Maintenance**
```
/dev-compound-refresh                    ← przejrzyj bazę wiedzy
/freshness-audit                         ← audyt aktualności skilli (raz w miesiącu)
# sync skilli expo-*: diff z github.com/expo/skills (zachowaj polskie opisy frontmatter)
```

---

## Myki i pułapki (najważniejsze)

- **Autopilot: waliduj branch PRZED odpaleniem** — workflow nie pyta o branch switch.
- **RESUME tylko po awarii runu** (zawsze z tymi samymi `args`). Po **STOP bramki** (środowisko E2E, fix FAIL), gdy coś naprawiłeś — **świeży run bez `resumeFromRunId`**: resume zwróciłby porażkę bramki z cache; stan faz wznowi się z `.autopilot-state.json`.
- **E2E to prawdziwy emulator** (Maestro), nie symulacja — wymaga Metro na bazie `.env.e2e` + simulatora z dev-clientem. Bez `.env.e2e` weryfikacje E2E → OPERATOR. **Ręczny Metro na `.env.local` sabotuje run** (apka celuje w dev zamiast e2e).
- **Maestro nie steruje natywnymi powierzchniami OS** (picker zdjęć, kamera, share sheet, natywny Alert, biometria) — dane wstrzykuj przez service_role (`runScript: .maestro/inject-*.js`, GraalJS: binarki inline, nie ścieżką pliku), natywny confirm → `[Manual]`.
- **`EXPO_PUBLIC_*` jest publiczne w bundlu** — tylko anon key i jawne URL-e; klucze płatne za Edge Function (lub API route — skill `eas-hosting`).
- **Limit cyklu fix = 1** — po fixie każdy P1/KOD przechodzi **niezależny targeted verify** (weryfikator sprawdza kod, nie self-report fixa).
- **Nie autoryzuj po `user_metadata`** (Supabase) — edytowalne przez usera; używaj `app_metadata` lub tabeli ról (reguła w `coding-rules §9`).
- **Po każdej zmianie `.claude/workflows/*-wf.js`** odpal smoke-test z `.claude/templates/smoke-autopilot/`.
- **Skille `expo-*` są upstream-owned** — nie edytuj ich treści; aktualizuj przez sync z `expo/skills`.

---

## Licencja

MIT.
