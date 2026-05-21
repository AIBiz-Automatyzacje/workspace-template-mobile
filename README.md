# workspace-template-mobile

Gotowy workflow dla [Claude Code](https://claude.com/claude-code) pod projekty **mobile (Expo / React Native)** — skille, agenty, hooki, reguły kodowania i konwencje. Wszystko siedzi w folderze `.claude/`. Wklejasz do swojego projektu i masz od razu pełną konfigurację Claude Code zoptymalizowaną pod mobile.

## Szybki start (copy-paste)

### Opcja A — `degit` (zalecane, najszybsze)

W katalogu **swojego projektu** uruchom:

```bash
npx degit AIBiz-Automatyzacje/workspace-template-mobile/.claude .claude
```

To pobierze sam folder `.claude/` (bez historii git) i wrzuci go do twojego projektu. Po tym otwórz projekt w Claude Code — wszystko działa.

### Opcja B — `git clone` + kopia

Gdy nie chcesz instalować `degit`:

```bash
git clone --depth 1 https://github.com/AIBiz-Automatyzacje/workspace-template-mobile.git /tmp/wtm \
  && cp -r /tmp/wtm/.claude ./.claude \
  && rm -rf /tmp/wtm
```

### Opcja C — pojedynczy curl (tylko wybrane pliki)

Jeśli chcesz np. tylko reguły kodowania:

```bash
mkdir -p .claude/rules \
  && curl -fsSL https://raw.githubusercontent.com/AIBiz-Automatyzacje/workspace-template-mobile/main/.claude/rules/coding-rules.md \
       -o .claude/rules/coding-rules.md
```

## Co dostajesz

```
.claude/
├── agents/        # 16 wyspecjalizowanych agentów (review TS, security, architektura, feature-builder mobile, e2e tester...)
├── hooks/         # 3 skrypty walidujące (anti-pattern check, error handling reminder, post-build check)
├── rules/         # coding-rules.md — 14 sekcji reguł (rozmiar plików, testowanie, error handling, type safety, async, performance, architektura)
├── skills/        # 36 skilli pokrywających pełen workflow:
│                  #   • dev-* (planowanie, brainstorm, autopilot, docs, code review, autopilot kompletny pipeline)
│                  #   • expo-* (overview, dev-client, deployment, upgrading, UI Swift/Jetpack, modules, API routes, CI/CD, tailwind setup, native data fetching, DOM components, building native UI)
│                  #   • mobile-e2e-maestro (testy E2E na emulatorze)
│                  #   • ux-ui-guidelines-mobile (iOS HIG vs Material 3, typografia, motion)
│                  #   • supabase-dev-guidelines, sentry-integration, security
│                  #   • code-quality, code-review, bugfix, zroastuj-mnie
└── settings.json  # konfiguracja Claude Code
```

Pełna lista skilli i agentów jest widoczna w Claude Code po otwarciu projektu (komenda `/help` → sekcja Skills).

## Wymagania

- [Claude Code](https://claude.com/claude-code) zainstalowane (CLI, desktop app, lub IDE extension)
- Node.js (do `npx degit` — opcja A)

Workflow jest **stack-agnostic w pryncypiach**, ale skille i agenty są zoptymalizowane pod:

- **Mobile:** Expo SDK 53+ / React Native, Expo Router, NativeWind, Maestro (E2E)
- **Backend:** Supabase (Auth, DB, Edge Functions), Sentry
- **Frontend (web wariant):** React 19, TypeScript 5.7+, TailwindCSS v4, shadcn/ui, Vite

## Personalizacja po wklejeniu

1. Otwórz `.claude/settings.json` i dostosuj uprawnienia / hooki do swoich potrzeb
2. Otwórz `.claude/rules/coding-rules.md` i odetnij sekcje których nie chcesz egzekwować
3. Skille w `.claude/skills/` mogą być usuwane pojedynczo — każdy to osobny folder, można wywalić co nie pasuje (np. `expo-ui-jetpack-compose` jeśli budujesz tylko iOS)

## Aktualizacje

Aby wciągnąć najnowszą wersję workflow (uważaj, nadpisuje lokalne zmiany w `.claude/`):

```bash
npx degit --force AIBiz-Automatyzacje/workspace-template-mobile/.claude .claude
```

Lepiej commitować `.claude/` do swojego repo, żeby trzymać własne customizacje pod kontrolą wersji.

## Licencja

MIT (lub zgodnie z plikiem LICENSE jeśli dodany).
