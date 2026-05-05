# Mobile Repo Transformation Plan

Self-contained plan transformacji `workspace-template` (web) na `workspace-template-mobile` (Expo). Ten dokument jest **promptem startowym dla nowej sesji Claude Code** otwartej w sklonowanym, świeżym mobile repo.

---

## Kontekst

`workspace-template` to repo szablonowe pod aplikacje webowe (React 19 + Vite + TailwindCSS v4 + shadcn/ui + Supabase). Zawiera dojrzały pipeline `dev-*` (brainstorm → docs → plan → execute → review → complete) z delegacją per-IU do subagentów-builderów ze skillami wstrzykniętymi przez `skills:` w frontmatter.

Mobile repo ma **identyczny pipeline** (proces myślenia jest stack-agnostic), ale **inny stack guidelines**:
- Stack: Expo (React Native) + NativeWind + Supabase + EAS Build/Submit
- Skille stack-specific: 13 oficjalnych skilli Expo z https://github.com/expo/skills (folder `plugins/expo/skills/`) + nowy `expo-overview` + `mobile-e2e-maestro`
- Builderzy: 4 nowe (`feature-builder-mobile-ui`, `feature-builder-mobile-data`, `feature-builder-mobile-fullstack`, `feature-tester-mobile-e2e`)

**Decyzje architektoniczne podjęte w sesji web (zachowane dla mobile):**
- 5 cienkich subagentów (mobile odpowiedniki: ui/data/fullstack/tester-e2e + reviewerzy zostają obecni, niewzruszani)
- Pipeline dev-plan deklaruje per IU pola `Delegate to:` i `Skills in play:`
- dev-docs-execute deleguje przez Agent tool zamiast implementować inline
- Format raportu zwrotnego od subagenta: `Status` (completed/partial/blocked), `Walidacja`, `Decyzje implementacyjne`, `Odchylenia od planu`, `Następne kroki dla orkiestratora`
- Hook `UserPromptSubmit` z `skill-activation-prompt.sh` usunięty (false-positive na meta-pytaniach)
- Polskie `description` w frontmatter Expo skilli, body EN (łatwy upstream sync z `git pull` z expo/skills)

---

## Decyzje podjęte (sesja walidacyjna 2026-05-05)

Te 6 pytań było otwartych w pierwszej wersji planu. Zostały rozstrzygnięte w dialogu z userem przed wykonaniem transformacji. Każda decyzja jest wbudowana w odpowiednie kroki poniżej.

| # | Pytanie | Decyzja | Konsekwencja w planie |
|---|---------|---------|----------------------|
| 1 | NativeWind v5 preview | **Adoptujemy** z ostrzeżeniem o pinowaniu exact preview version (`5.0.0-preview.2`) | Krok 1: `expo-tailwind-setup` description wzbogacony o "pinuj exact preview version" |
| 2 | `@expo/ui` SDK 55-only (jetpack-compose, swift-ui) | **Adoptujemy oba** — user zawsze startuje na najnowszym SDK | Krok 1: oba w `SKILLS=`; Krok 2: `expo-overview` opisuje kiedy ich używać (native feel) |
| 3 | `expo-api-routes` vs Edge Functions | **Pomijamy** `expo-api-routes`. Wszystko server-side w Supabase Edge Functions | Krok 1: usunięte z `SKILLS=`; Krok 6: `supabase-dev-guidelines` mocniej akcentuje "Edge Functions = default" |
| 4 | Mobile E2E tooling | **Maestro** (prawdziwe E2E na emulatorze, gesty, deep links) | Krok 3: `mobile-e2e-maestro` projektowany pod Maestro CLI |
| 5 | `gemini`/`plan-review`/`skill-rules-manager` | `gemini` **keep**; `plan-review` **delete** (nieużywany); `skill-rules-manager` + `skill-rules.json` **delete** (dead code po usunięciu hooka) | Krok 4: rozszerzona lista plików do usunięcia |
| 6 | `dev-autopilot` build step | **Zamiana** `vite build` → `tsc --noEmit && bunx expo-doctor` (lekka walidacja). `eas build` ręcznie przed releasem, NIE w autopilocie | Krok 6: nowa sekcja modyfikacji `dev-autopilot/SKILL.md` |

---

## Setup repo (krok przed nową sesją Claude Code, robi user)

```bash
# 1. Sklonuj workspace-template z GitHuba do nowego folderu
cd /Users/kacper_trzepiecinski/Documents/Kodowanie/
git clone https://github.com/AIBiz-Automatyzacje/claude-code-zasoby.git workspace-template-mobile

# 2. Wejdź do folderu
cd workspace-template-mobile

# 3. Utwórz nowe repo na GitHubie (przez gh CLI lub UI)
gh repo create AIBiz-Automatyzacje/workspace-template-mobile --private --source=. --remote=mobile-origin --push=false

# 4. Zmień remote origin na nowe repo
git remote remove origin
git remote add origin <URL-nowego-repo>
git remote -v  # weryfikacja

# 5. Otwórz Claude Code w nowym folderze
cd /Users/kacper_trzepiecinski/Documents/Kodowanie/workspace-template-mobile/
claude  # start nowej sesji

# 6. W nowej sesji daj jako pierwszy prompt:
# "Wykonaj plan z docs/mobile-transformation-plan.md"
```

---

## Krok 1: Adopcja 12 skilli Expo

**Źródło:** https://github.com/expo/skills — oficjalne repo skilli Expo do Claude Code, ścieżka `plugins/expo/skills/`. Aktualna wersja jest źródłem prawdy; jeśli body skilla wygląda inaczej niż w tym planie, zaufaj upstream.

**Zmiana vs. pierwotny plan:** `expo-api-routes` został wykluczony (Decyzja #3). Server-side code idzie do Supabase Edge Functions, nie do EAS Hosting API Routes. Lista skilli to **12**, nie 13.

Sklonuj repo jako tymczasowe źródło i skopiuj 12 skilli do `.claude/skills/expo-*/`:

```bash
# Tymczasowy clone do /tmp
git clone https://github.com/expo/skills.git /tmp/expo-skills-source

# 12 skilli do skopiowania (każdy jako osobny folder w .claude/skills/)
SKILLS=(
  "building-native-ui"
  "eas-update-insights"
  "expo-cicd-workflows"
  "expo-deployment"
  "expo-dev-client"
  "expo-module"
  "expo-tailwind-setup"
  "expo-ui-jetpack-compose"
  "expo-ui-swift-ui"
  "native-data-fetching"
  "upgrading-expo"
  "use-dom"
)

# Kopia z prefiksem expo- gdzie nazwa go nie ma
for skill in "${SKILLS[@]}"; do
  if [[ "$skill" =~ ^expo- ]] || [[ "$skill" =~ ^eas- ]]; then
    target=".claude/skills/${skill}"
  else
    target=".claude/skills/expo-${skill}"
  fi
  cp -r "/tmp/expo-skills-source/plugins/expo/skills/${skill}" "$target"
done
```

Po skopiowaniu **dla każdego z 13 skilli** zaktualizuj tylko `description` w frontmatter na polski. Body zostaje EN. Przykład — `expo-building-native-ui/SKILL.md`:

```yaml
---
name: expo-building-native-ui
description: "Wytyczne UI dla Expo Router (mobile). Native tabs, animacje (Reanimated), SF Symbols, blur, liquid glass, formy sheet, search bar, storage (SQLite/SecureStore). Używaj przy budowie ekranów React Native, Expo Router, animacjach mobile, 'zrób mobilne UI', 'ekran Expo'."
---
```

Mapowanie polskich description (do wykorzystania jako referencja, dostosuj per skill):

| Folder docelowy | Polski description (skrót) |
|---|---|
| `expo-building-native-ui` | Wytyczne UI dla Expo Router — native tabs, animacje, SF Symbols, blur. |
| `expo-eas-update-insights` | Health check OTA updateów EAS — crash rate, unique users, payload size. |
| `expo-cicd-workflows` | YAML pipeline EAS w `.eas/workflows/` — build, submit, deployment automation. |
| `expo-deployment` | Deployment iOS App Store, Google Play, web przez EAS Submit. |
| `expo-dev-client` | Custom development client przez EAS Build gdy Expo Go nie wystarcza. |
| `expo-module` | Pisanie natywnych modułów Swift/Kotlin/TS przez Expo Modules API. |
| `expo-tailwind-setup` | TailwindCSS v4 w Expo z react-native-css + NativeWind v5 **preview** (pinuj exact `5.0.0-preview.2`, nie `^`). |
| `expo-ui-jetpack-compose` | `@expo/ui/jetpack-compose` — natywne Android UI z RN (SDK 55+). Używaj gdy potrzebujesz native feel (haptyki, dark mode platformy). |
| `expo-ui-swift-ui` | `@expo/ui/swift-ui` — natywne iOS UI z RN (SDK 55+). Używaj gdy potrzebujesz native feel (haptyki, dynamic type). |
| `expo-native-data-fetching` | Fetch/React Query/SWR/Expo Router loaders dla mobile (offline, caching). |
| `expo-upgrading` | Upgrade SDK Expo (53/54/55) krok po kroku, breaking changes. |
| `expo-use-dom` | DOM Components — uruchamianie web kodu w webview na natywie. |

---

## Krok 2: Utworzenie `expo-overview` (cienki index/router)

Utwórz `.claude/skills/expo-overview/SKILL.md` jako index 50-80 linii. Cel: gdy Claude widzi projekt Expo, ten skill pełni rolę analogu `tailwind-react-guidelines` w web — czyli pierwszego skilla aktywowanego przy temacie "stack mobile".

Zawartość skilla:
1. **Frontmatter** z polskim description: "Hub stack guidelines dla projektu Expo (React Native). Decision tree: który expo-* skill wybrać. Konwencje RN (View vs div, Link z expo-router, StyleSheet/NativeWind, brak DOM). Używaj na początku każdej rozmowy o projekcie mobilnym."
2. **Body** z 3 sekcjami:
   - **Decision tree:** tabela "co budujesz" → "którego expo-* skilla użyć"
   - **Konwencje RN vs web:** krótka lista różnic dla osób przyzwyczajonych do web
   - **Linki do 13 skilli** z 1-zdaniowym opisem każdego

---

## Krok 3: Utworzenie `mobile-e2e-maestro` (analog agent-browser dla mobile)

Expo nie ma własnego skilla na E2E mobile. Utwórz `.claude/skills/mobile-e2e-maestro/SKILL.md` analogicznie do `agent-browser` (web E2E przez przeglądarkę), ale dla **Maestro** (CLI do testów mobile na emulatorze/device):

1. **Frontmatter** z polskim description: "Automatyzacja testów E2E mobile przez Maestro CLI. Nawigacja, tap, scroll, asercje na emulatorze iOS/Android. Używaj przy 'testuj UI mobilne', 'zrób screenshot apki', 'agent-mobile', weryfikacji E2E w fazie review."
2. **Body** z workflow analogicznym do `agent-browser`:
   - Komendy Maestro (`maestro test`, `maestro studio`, flow YAML)
   - Pattern: snapshot → action → re-snapshot → screenshot
   - Integracja z dev-docs-review jako delegate dla `feature-tester-mobile-e2e`

Zalecenie: użyj Agent tool z `subagent_type: best-practices-researcher` żeby pobrać aktualne best practices Maestro przed pisaniem skilla.

---

## Krok 4: Pliki do USUNIĘCIA z workspace-template-mobile

Te są web-specific i w mobile repo nie istnieją:

```bash
# Web stack guidelines
rm -rf .claude/skills/tailwind-react-guidelines/
rm -rf .claude/skills/ux-ui-guidelines/
rm -rf .claude/skills/agent-browser/
rm -rf .claude/skills/coolify-manager/  # Coolify deployment to web; mobile używa EAS

# Web builderzy (zastąpimy mobile odpowiednikami w Kroku 5)
rm .claude/agents/feature-builder-ui.md
rm .claude/agents/feature-builder-data.md
rm .claude/agents/feature-builder-fullstack.md
rm .claude/agents/feature-tester-e2e.md

# Dead code / nieużywane skille (Decyzja #5)
rm -rf .claude/skills/plan-review/             # nigdy nie był używany przez usera
rm -rf .claude/skills/skill-rules-manager/     # dead code po usunięciu hooka UserPromptSubmit
rm -f .claude/skill-rules.json                 # konsumowany tylko przez usunięty hook

# Plan transformacji sam też usuwamy z mobile repo (był jednorazowy)
rm docs/mobile-transformation-plan.md
```

**NIE usuwaj:**
- `.claude/skills/supabase-dev-guidelines/` — Supabase działa na mobile, ale rozszerzymy o sekcję mobile w Kroku 6
- `.claude/skills/sentry-integration/` — Sentry działa na mobile (osobny SDK `@sentry/react-native`), rozszerzymy w Kroku 6
- `.claude/skills/security/`, `code-review/`, `code-quality/` — stack-agnostic
- `.claude/skills/dev-*` (cały pipeline) — stack-agnostic
- `.claude/skills/zroastuj-mnie/`, `bugfix/`, `dev-compound*`, `dev-ideate/` — stack-agnostic
- `.claude/skills/gemini/` — stack-agnostic, user korzysta ad-hoc
- `.claude/agents/` researcherzy i reviewerzy (5+5) — bez zmian
- `.claude/rules/coding-rules.md` — uniwersalne
- `.claude/hooks/` (Stop hooks zostają)
- `.claude/settings.json` (już bez UserPromptSubmit po commicie z web repo)

---

## Krok 5: Pliki do UTWORZENIA — 4 mobile builderzy

Stwórz 4 subagenty w `.claude/agents/` na wzór feature-builder-* z web (te już usunięte w Kroku 4). Pełne body identyczne wzorem co web-builderzy, ale ze zmienionym scope i skillami.

### `.claude/agents/feature-builder-mobile-ui.md`

```yaml
---
name: feature-builder-mobile-ui
description: "Implementuje warstwę UI mobile (komponenty React Native, Expo Router, NativeWind, native tabs, animacje Reanimated, dostępność iOS VoiceOver/Android TalkBack). Wywoływany przez dev-docs-execute gdy IU dotyka tylko warstwy prezentacji mobile (*.tsx w app/, components/, screens/)."
skills: [expo-overview, expo-building-native-ui, expo-tailwind-setup]
model: inherit
---
```

Body: identyczna struktura co web `feature-builder-ui.md` (workflow 5-krokowy, format raportu, zasady), ale:
- Pryncypia stack-specific: Expo Router (Link zamiast a, useRouter zamiast useNavigate), NativeWind (className na View), accessibility (`accessibilityLabel`, `accessibilityRole`, `accessibilityHint`), native tabs SDK 55+, brak DOM (View/Text/ScrollView)
- Walidacja: `tsc --noEmit`, testy (Jest RN lub Vitest + RNTL), `eslint`, EAS prebuild (jeśli IU dotyka native config)

### `.claude/agents/feature-builder-mobile-data.md`

```yaml
---
name: feature-builder-mobile-data
description: "Implementuje warstwę danych mobile (Supabase queries z mobile-aware secure storage, RLS, walidacja Zod, Edge Functions, deep linking dla OAuth, expo-secure-store). Wywoływany przez dev-docs-execute gdy IU dotyka tylko warstwy danych mobile (lib/, hooks/use<X>Data.ts, supabase/migrations, supabase/functions)."
skills: [expo-overview, expo-native-data-fetching, supabase-dev-guidelines, security]
model: inherit
---
```

Body: identyczna struktura co web `feature-builder-data.md`, ale dodatkowo:
- `expo-secure-store` zamiast `localStorage` dla session persistence
- Deep linking schema dla OAuth redirect URI (`yourapp://auth/callback`)
- React Query persist do AsyncStorage (offline-first)
- Realtime lifecycle (background socket disconnect na iOS)

### `.claude/agents/feature-builder-mobile-fullstack.md`

```yaml
---
name: feature-builder-mobile-fullstack
description: "Implementuje feature mobile dotykający równolegle UI i warstwy danych (formularze z auth + deep linking, ekrany z fetchem, CRUD flow end-to-end). Wywoływany gdy Implementation Unit jest cross-layer i nie da się go rozsądnie podzielić."
skills: [expo-overview, expo-building-native-ui, expo-tailwind-setup, expo-native-data-fetching, supabase-dev-guidelines, security]
model: inherit
---
```

Body: jak web `feature-builder-fullstack.md`, ale z mobile-specific dekompozycją (deep linking, secure storage, native UI patterns).

### `.claude/agents/feature-tester-mobile-e2e.md`

```yaml
---
name: feature-tester-mobile-e2e
description: "Weryfikuje scenariusze E2E mobile na emulatorze przez Maestro. Sprawdza checkboxy Weryfikacja: z checklist zadań — interakcje, nawigacja, gesty, visual regression iOS/Android."
skills: [mobile-e2e-maestro]
model: inherit
---
```

Body: analogicznie do web `feature-tester-e2e.md`, ale komendy Maestro zamiast agent-browser.

---

## Krok 6: Modyfikacje istniejących skilli

### `dev-plan/SKILL.md`

**Sekcja 3.5 (tabela decyzyjna)** — zaktualizuj listę subagentów z web na mobile:

| Ścieżki w `Pliki:` | Subagent | Skille (mirror dla `Skills in play:`) |
|---|---|---|
| Tylko `*.tsx` w `app/`, `components/`, `screens/`, lub native config | `feature-builder-mobile-ui` | expo-overview, expo-building-native-ui, expo-tailwind-setup |
| Tylko `*.ts` w `lib/`, `hooks/use<X>Data.ts`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-mobile-data` | expo-overview, expo-native-data-fetching, supabase-dev-guidelines, security |
| Mix UI i danych w jednym atomowym IU | `feature-builder-mobile-fullstack` | wszystkie 6 powyżej |

**Template 4.2** — `Delegate to:` enum: `feature-builder-mobile-ui` | `feature-builder-mobile-data` | `feature-builder-mobile-fullstack`

**Faza 0** — dodaj sekcję "0.7 Wykrywanie stacku" z heurystyką: jeśli `app.json` lub `app.config.ts` lub `"expo"` w `package.json` → projekt Expo, używaj prefiksu `expo-*` w decyzjach.

### `dev-docs-execute/SKILL.md`

**Sekcja 2.5 Krok 3** — zaktualizuj listę `subagent_type`:
```
subagent_type = wartość pola Delegate to: z IU
  (feature-builder-mobile-ui | feature-builder-mobile-data | feature-builder-mobile-fullstack)
```

### `dev-docs-review/SKILL.md`

**Linia z `feature-tester-e2e`** — zmień na `feature-tester-mobile-e2e`.

### `dev-brainstorm/SKILL.md`

Dodaj sekcję wcześnie w flow: *"Ten projekt to repo szablonowe pod aplikacje **mobilne** (Expo). Pytania o store distribution, OTA strategy, native deps, deep linking, expo-secure-store są w scope. Pytania o SEO, SSR, browser compatibility są poza scope."*

### `supabase-dev-guidelines/SKILL.md` — nowa sekcja "Mobile (Expo)"

Dodaj sekcję na końcu z 3 podsekcjami:
1. **OAuth deep linking** — redirect URI ze schemą `yourapp://auth/callback` zamiast `https://`, `expo-web-browser` lub `expo-auth-session`
2. **Session persistence** — `expo-secure-store` jako custom storage dla `createClient({ auth: { storage } })`, NIE `localStorage`
3. **Realtime lifecycle** — handle background/foreground transitions, reconnect po wakeup, AppState listener

### `sentry-integration/SKILL.md` — nowa sekcja "React Native (Expo)"

Dodaj sekcję z:
1. Setup `@sentry/react-native` (różny od `@sentry/react`)
2. Sourcemaps upload przez EAS Build (`expo-sentry`)
3. Integracja z navigation (Sentry React Navigation Instrumentation)
4. Crash capture na iOS/Android (native crashes, nie tylko JS errors)

### `dev-autopilot/SKILL.md` — zamiana build step (Decyzja #6)

W web wersji autopilot odpalał `bun run build` (= `vite build`) jako walidację przed commitem. Mobile nie ma tego odpowiednika — pełny `eas build` trwa 15-30 min i kosztuje (EAS Cloud billing), więc zabija filozofię "szybki autopilot".

**Zamiana** wszędzie gdzie pojawia się `bun run build` lub `vite build`:
```bash
bunx tsc --noEmit && bunx expo-doctor
```

To łapie ~90% problemów które złamałyby build (TypeScript errors, version mismatches, missing peer deps, incompatible Expo SDK deps) w ~10s, bez billing.

**Dodaj do body skilla notatkę:**
> *"Mobile autopilot **nie odpala** `eas build` — to za drogie (czas + EAS Cloud billing). Pełny build mobile rób ręcznie przed releasem przez `eas build --platform all` albo `eas build --local` (wymaga macOS dla iOS)."*

**Znane luki autopilota** (E2E awareness, numer fazy) zostają as-is — to nie jest stack-specific, można naprawić później osobnym taskiem.

---

## Krok 7: Walidacja transformacji

Po wszystkich zmianach zweryfikuj:

```bash
# Brak referencji do web-specific subagentów
grep -rn "feature-builder-ui\|feature-builder-data\|feature-builder-fullstack\|feature-tester-e2e" .claude/ docs/ 2>/dev/null && echo "FAIL: znaleziono web-specific" || echo "OK"

# Brak referencji do agent-browser w pipeline
grep -rn "agent-browser" .claude/skills/dev-* 2>/dev/null && echo "FAIL: agent-browser w dev-*" || echo "OK"

# 12 skilli Expo + expo-overview + mobile-e2e-maestro istnieją (expo-api-routes wykluczony — Decyzja #3)
ls .claude/skills/ | grep -E "^(expo-|mobile-e2e-maestro)" | wc -l  # oczekiwane: 14

# Dead code usunięty (Decyzja #5)
test ! -d .claude/skills/plan-review && echo "OK plan-review" || echo "FAIL"
test ! -d .claude/skills/skill-rules-manager && echo "OK skill-rules-manager" || echo "FAIL"
test ! -f .claude/skill-rules.json && echo "OK skill-rules.json" || echo "FAIL"

# 4 mobile builderzy + 5 reviewerów + 5 researcherów + (innych)
ls .claude/agents/ | grep -c feature-builder-mobile  # oczekiwane: 3
ls .claude/agents/ | grep -c feature-tester-mobile-e2e  # oczekiwane: 1

# Hook UserPromptSubmit nie istnieje
grep -q UserPromptSubmit .claude/settings.json && echo "FAIL: hook obecny" || echo "OK"

# Test pierwszego użycia (manualny):
# Utwórz mały plan testowy: /dev-plan "feature: ekran logowania z Supabase"
# Zweryfikuj że plan zawiera Delegate to: feature-builder-mobile-fullstack
# Zweryfikuj że Skills in play: zawiera 6 odpowiednich skilli
```

---

## Krok 8: Commit i push

```bash
git add .
git commit -m "$(cat <<'EOF'
Wyprowadź mobile template z workspace-template (Expo + EAS)

Repo bazowe sklonowane z workspace-template (web). Transformacja:
- Adopcja 13 skilli Expo z github.com/expo/skills (polski description,
  body EN dla łatwego upstream sync)
- Nowy expo-overview jako index/router stack guidelines mobile
- Nowy mobile-e2e-maestro jako analog agent-browser dla testów mobile
- 4 mobile builderzy: feature-builder-mobile-{ui,data,fullstack},
  feature-tester-mobile-e2e — ze skillami wstrzykniętymi przez frontmatter
- Usunięte web-specific: tailwind-react-guidelines, ux-ui-guidelines,
  agent-browser, coolify-manager, web feature-builderzy
- Rozszerzone o sekcję mobile: supabase-dev-guidelines (deep linking,
  expo-secure-store, Realtime lifecycle), sentry-integration (RN SDK,
  EAS sourcemaps)
- Zaktualizowane: dev-plan tabela decyzyjna 3.5, dev-docs-execute lista
  subagent_type, dev-docs-review referencja testera E2E, dev-brainstorm
  z mobile-aware framing

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

---

## Prompt startowy dla nowej sesji

Wszystkie pytania otwarte zostały rozstrzygnięte (zobacz sekcję "Decyzje podjęte" na początku planu). Nowa sesja może wykonywać plan bez pytań wstępnych.

W nowej sesji Claude Code (otwartej w `workspace-template-mobile/`) wpisz **dokładnie** ten prompt jako pierwszy:

> Wykonaj transformację repo zgodnie z planem w `docs/mobile-transformation-plan.md`. Wszystkie decyzje architektoniczne są już rozstrzygnięte (sekcja "Decyzje podjęte" na początku) — nie pytaj mnie o nie ponownie, po prostu zastosuj. Przejdź wszystkie 8 kroków sekwencyjnie. Po każdym kroku zwróć krótki status (co zrobione, co do weryfikacji). Po Kroku 7 (walidacja) zatrzymaj się i poczekaj na moje "tak" przed Krokiem 8 (commit + push).

---

## Notatki dla nowej sesji

- **Nie ufaj memory z web repo** — memory jest per-project, w nowym folderze będzie pusta. Wszystkie decyzje architektoniczne są w tym dokumencie.
- **Pipeline dev-* jest już skonfigurowany pod delegację** — nowa sesja nie musi tego robić, tylko zaktualizować listy subagentów (Krok 6).
- **Stop hooks zostają** (`stop-build-check-enhanced.sh`, `error-handling-reminder.sh`) — są stack-agnostic.
- **Po wykonaniu Kroku 8 usuń `docs/mobile-transformation-plan.md`** — był jednorazowym artefaktem transformacji, nie należy do mobile repo długoterminowo.
