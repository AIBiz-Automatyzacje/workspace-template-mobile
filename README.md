# workspace-template-mobile

Gotowy workflow dla [Claude Code](https://claude.com/claude-code) pod projekty **mobile (Expo / React Native)** — skille, agenty, hooki, reguły kodowania i konwencje. Wszystko siedzi w folderze `.claude/` i pluginuje się do dowolnego projektu jako kompletna konfiguracja.

---

## Szybki start — wklej prompt do swojego asystenta

**Nie musisz nic ściągać ręcznie ani używać terminala.** Otwórz swój projekt w Claude Code (albo Cursor / Windsurf / innym asystencie AI), skopiuj poniższy prompt i wklej go w czacie. Asystent sam zrobi resztę.

### 👇 Skopiuj to i wklej w asystencie:

```
Cześć! Pobierz z publicznego repo na GitHubie folder `.claude/` i wklej go
do mojego bieżącego projektu (do głównego katalogu, w którym teraz jesteś).

Źródło:
https://github.com/AIBiz-Automatyzacje/workspace-template-mobile

Konkretnie:
1. Pobierz zawartość folderu `.claude/` z brancha `main` tego repo.
2. Skopiuj cały ten folder do głównego katalogu mojego projektu — czyli
   tak, żeby u mnie powstała ścieżka `.claude/` na tym samym poziomie co
   np. `package.json` / `README.md`.
3. Jeśli u mnie JUŻ istnieje folder `.claude/`, NIE NADPISUJ go po cichu.
   Najpierw wypisz mi co masz zamiar zmienić (które pliki będą dodane,
   nadpisane lub pominięte) i poczekaj na moje potwierdzenie.
4. Po skopiowaniu pokaż mi krótkie podsumowanie: co dokładnie wylądowało
   w `.claude/` (lista folderów: agents, hooks, rules, skills, settings)
   i ile czego mam (np. "36 skilli, 16 agentów, 3 hooki").
5. Na koniec napisz mi czy mam zrestartować asystenta / przeładować
   projekt, żeby nowe skille i agenty się aktywowały.

Możesz użyć dowolnej metody (git clone do tymczasowego katalogu i
skopiowanie, degit, GitHub API, raw.githubusercontent.com, cokolwiek
działa). Po skończeniu posprzątaj po sobie tymczasowe pliki.

Działaj.
```

To wszystko. Po wklejeniu asystent zapyta o ewentualne nadpisanie, pobierze całość, raportuje co zrobił, i dasz znać czy chcesz restart sesji.

---

## Co dostajesz w `.claude/`

```
.claude/
├── agents/        16 wyspecjalizowanych agentów (review TS, security,
│                  architektura, feature-builder mobile, e2e tester, ...)
├── hooks/         3 skrypty walidujące (anti-pattern check, error handling
│                  reminder, post-build check)
├── rules/         coding-rules.md — 14 sekcji reguł kodowania
│                  (rozmiar plików, testowanie, error handling, type safety,
│                  async, performance, architektura, bezpieczeństwo, ...)
├── skills/        36 skilli pokrywających pełen workflow:
│                    • dev-*   planowanie, brainstorm, docs, code review,
│                              autopilot, kompleksowy pipeline
│                    • expo-*  overview, dev-client, deployment, upgrading,
│                              UI Swift/Jetpack, modules, API routes, CI/CD,
│                              tailwind setup, data fetching, DOM, native UI
│                    • mobile-e2e-maestro    testy E2E na emulatorze
│                    • ux-ui-guidelines-mobile  iOS HIG vs Material 3,
│                                               typografia, motion, haptics
│                    • supabase-dev-guidelines, sentry-integration, security
│                    • code-quality, code-review, bugfix, zroastuj-mnie
└── settings.json  konfiguracja Claude Code (uprawnienia, hooki, env)
```

Po wklejeniu folderu do projektu otwórz Claude Code i wpisz `/help` —
zobaczysz pełną listę dostępnych skilli.

---

## Wymagania

- [Claude Code](https://claude.com/claude-code) zainstalowane (CLI, desktop app albo IDE extension)
- Nic więcej — asystent sam ogarnie pobranie

Workflow jest **stack-agnostic w pryncypiach**, ale skille i agenty są zoptymalizowane pod:

- **Mobile:** Expo SDK 53+ / React Native, Expo Router, NativeWind, Maestro (E2E)
- **Backend:** Supabase (Auth, DB, Edge Functions), Sentry
- **Frontend (web wariant):** React 19, TypeScript 5.7+, TailwindCSS v4, shadcn/ui, Vite

---

## Aktualizacje (gdy wyjdzie nowsza wersja workflow)

Wklej w asystencie ten prompt:

```
Zaktualizuj mi folder `.claude/` do najnowszej wersji z repo
https://github.com/AIBiz-Automatyzacje/workspace-template-mobile

Najpierw porównaj mój lokalny `.claude/` z tym co jest na branchu `main`
i pokaż mi diff (które pliki są nowe, które się zmieniły, które zostały
usunięte upstream). Dopiero po moim potwierdzeniu nadpisz pliki.

Zachowaj moje lokalne modyfikacje w `.claude/settings.local.json`
i wszystkim co dodałem sam (pliki, których nie ma w repo źródłowym).
```

---

## Personalizacja (po wklejeniu workflow)

Możesz powiedzieć asystentowi np.:

- "Otwórz `.claude/rules/coding-rules.md` i wytnij sekcję X którą nie chcę"
- "Usuń skill `expo-ui-jetpack-compose` — buduję tylko pod iOS"
- "Dostosuj `.claude/settings.json` żeby pytał o potwierdzenie tylko przy push"

---

## Dla zaawansowanych (CLI)

Jeśli wolisz pobrać workflow z linii komend zamiast przez asystenta:

```bash
npx degit AIBiz-Automatyzacje/workspace-template-mobile/.claude .claude
```

---

## Licencja

MIT.
