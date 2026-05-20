---
date: 2026-05-20
status: paused — wróciliśmy do poprzedniej konfiguracji
topic: autopilot-delegation-architecture
related-branch: refactor/autopilot-flatten-delegation (usunięty — patrz git reflog jeśli potrzebny)
---

# Architektura delegacji w `dev-autopilot` — notatka z badania

## TL;DR

Próbowaliśmy refactoru pipeline'u `dev-autopilot` żeby był zgodny z oficjalną regułą Anthropic *"subagents cannot spawn other subagents"*. Refactor (Wariant A — spłaszczenie delegacji) działał na poziomie ukończenia zadania, ale **łamał modularność skilli** — Claude rezygnował z wywoływania `Skill tool` po pierwszej nieudanej próbie i wszystko reimplementował inline manualnie.

**Decyzja na 2026-05-20:** wracamy do poprzedniej konfiguracji (przed refactorem). Branch `refactor/autopilot-flatten-delegation` usunięty. Czekamy na lepszą ścieżkę rozwiązania.

## Pierwotny problem

Obecna architektura pipeline'u (na `main`):

```
Skill(dev-autopilot)
   └─ Agent(general-purpose, foreground)
        └─ wewnątrz: Skill(dev-docs-execute)
             └─ Agent(feature-builder-mobile-ui|data|fullstack)  ← łamie regułę
```

Dokumentacja Anthropic ([sub-agents.md](https://code.claude.com/docs/en/sub-agents.md)) wprost stanowi:

> "Subagents cannot spawn other subagents."  
> "If your workflow requires nested delegation, use Skills or chain subagents from the main conversation."

Czyli `Agent(general-purpose)` jako subagent **nie powinien** móc spawnować `Agent(feature-builder-*)`. W praktyce działa to "przez przypadek" — Claude w subagencie czyta treść skilla i wykonuje inline, zamiast realnie wywoływać Agent tool z drugiego poziomu.

## Co próbowaliśmy — Wariant A (spłaszczenie delegacji)

**Branch:** `refactor/autopilot-flatten-delegation` (usunięty)

**Zmiana:** w 6 miejscach autopilota (kroki 1a/1b/1d/2a/2b/2c) zamieniliśmy:

```markdown
Uruchom Agent (general-purpose, foreground) z promptem:
"Wywolaj skill /dev-docs-execute z argumentem $1"
```

na:

```markdown
Wywolaj Skill("dev-docs-execute", args: "$1") inline w głównej sesji
```

**Idea:** pominąć warstwę `Agent(general-purpose)` jako pośrednika, wywoływać skille bezpośrednio w głównej sesji autopilota. Subagenci pojawiają się dopiero na samym dnie (buildery, agenci review) — jeden poziom subagenta, zgodne z regułą.

**Dodatkowe zmiany:**
- Dodano regułę "świeżego kontekstu" w `dev-docs-execute` (re-read planu/zadań na początku każdej fazy)
- Wzmocniono autonomię w autopilocie (krytyczne instrukcje przeciw zatrzymywaniu się między krokami)
- Dual output format w 4 skillach orkiestrowanych (tryb autopilota vs tryb manualny)

## Test w boju (gramywpadla, 2026-05-20)

Refactor został przetestowany na realnym zadaniu (`create-tournament-wizard`, 9 IU, 4 fazy). **Pipeline ukończył zadanie**, ale ujawnił 3 poważne problemy:

### Bug 1 — Resume logic pomija fazę z `[x]` ale bez review

Autopilot przy starcie zobaczył że Faza A ma wszystkie checkboxy implementacyjne zaznaczone i przeszedł od razu do Fazy B. **Pominął review Fazy A**, mimo że plik `review-faza-A.md` nie istniał. User musiał interweniować manualnie.

**Powód:** sekcja 0.3 autopilota sprawdza tylko *"czy review istnieje I ma nierozwiązane P1/P2"* — nie sprawdza *"czy review w ogóle istnieje dla ukończonej fazy"*.

### Bug 2 — Placeholdery `$1`/`$2` w skillach nie expandują się przy Skill tool

Po pierwszym `Skill(dev-docs-review)` Claude wypisał:

> "Skill template miał problem ze zmienną (puste `` w treści). Wykonuję review Fazy A samodzielnie z parametrami..."

Treść skilli używa składni slash-command (`$1`, `$2`, `$ARGUMENTS`), która działa gdy user wpisuje `/dev-docs-review path 1`. **Nie działa** gdy skill wywoływany przez `Skill tool` z `args: "..."` — Skill tool przekazuje args jako jeden string, nie podstawia pod positional args.

### Bug 3 — Brak retry/fallback, Claude poszedł w manual inline

Od linii 50 do 2392 transcript'u (~2340 linii), Claude wykonywał **wszystkie kroki ręcznie**:
- Spawnował agentów review bezpośrednio (security-sentinel, performance-oracle, itd.)
- Pisał review reports przez Write tool
- Spawnował builderów per IU bez pośrednictwa `dev-docs-execute`
- Wykonywał fix cycles inline

**Liczba wywołań `Skill tool` po pierwszym fail'u:** 0 (do końca pipeline'u, oprócz `dev-docs-complete` i `dev-compound` na końcu, które zadziałały).

**Skutek:** modularność skilli **iluzoryczna**. Edycja `dev-docs-execute/SKILL.md` nie wpłynęłaby na zachowanie autopilota — Claude reimplementuje logikę z kontekstu autopilota, nie czyta osobnego skilla.

## Co mówi dokumentacja — pełna mapa ograniczeń

### Subagenci nie spawnują subagentów

[docs/sub-agents.md](https://code.claude.com/docs/en/sub-agents.md):

> "Subagents cannot spawn other subagents, so `Agent(agent_type)` has no effect in subagent definitions."

To dotyczy **wszystkich** subagentów — niezależnie od tego czy spawnowane przez Agent tool, Skill tool z `context: fork`, czy w Agent Teams.

### Agent Teams nie pomaga

[docs/agent-teams.md](https://code.claude.com/docs/en/agent-teams.md) — feature eksperymentalna (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`):

- **NIE** znosi limitu nested subagentów. Limitacja explicit w docs: *"No nested teams — teammates nie mogą spawnować swoich teamów / teammates."*
- To **inna architektura** — multi-session peer-to-peer (Lead + równoległe Teammates z `SendMessage` tool), nie nested delegation
- 8 known limitations (brak session resumption, task status lag, slow shutdown, jedno team na raz, permissions przy spawnie, brak nested teams, lead jest fixed, split panes wymaga tmux/iTerm2)

### Tools `Agent(agent_type)` syntax — restricting (orthogonal feature)

[docs/sub-agents.md](https://code.claude.com/docs/en/sub-agents.md):

```yaml
tools: Agent(worker, researcher), Read, Bash  # allowlist subagent types
tools: Agent, Read, Bash                       # all subagents allowed
tools: Read, Bash                              # NO Agent → can't spawn at all
```

**Wprost:** *"This restriction only applies to agents running as the main thread with `claude --agent`. Subagents cannot spawn other subagents, so `Agent(agent_type)` has no effect in subagent definitions."*

## Fundamentalna sprzeczność wymagań

Mamy trzy wymagania, które **nie mogą współistnieć**:

1. **Slash command entry point** (`/dev-autopilot path`) — wymaga skilla, nie agenta main-thread
2. **Modularność skilli** (`dev-docs-execute`, `dev-docs-review`, `dev-docs-complete`, `dev-compound` jako osobne komponenty)
3. **Skille spawnują subagentów** (buildery, agenci review)

Każde dwa są wykonalne razem, ale wszystkie trzy — nie. Klasyczny "pick 2 of 3".

## Rozważone opcje (dla przyszłego refactoru)

### Opcja A — Spłaszczenie (testowane, odrzucone)
Skille wywoływane przez Skill tool inline w autopilocie. **Bugi:** placeholders, brak retry, Claude rezygnuje z Skill tool.

### Opcja B — Autopilot jako agent main-thread
`dev-autopilot` przerobiony ze skilla na `.claude/agents/dev-autopilot.md`. Uruchamiany przez `claude --agent dev-autopilot path`. Skille execute/review/complete/compound jako preloaded `skills:` w frontmaterze agenta.

**Plus:** zgodne z platformą, modularność realna (skille preloadowane).
**Minus:** user nie chce CLI entry point — wymaga sesji terminalowej, nie integruje się z konwersacją w Claude Code.

**Status:** odrzucone przez usera 2026-05-20 ("nie chcę go uruchamiać z terminal, tylko chcę być w sesji").

### Opcja C — Monolityzacja
Scalić logikę execute/review/complete/compound w jeden duży `dev-autopilot/SKILL.md` (~2000 linii). Skille zostają jako manual entry points z duplikatem treści.

**Plus:** slash command zachowany, jeden poziom subagentów.
**Minus:** duży plik, duplikacja, mniejsza modularność na poziomie pliku.

### Opcja D — Skille jako "loaded references" przez Read tool
Autopilot czyta `.claude/skills/dev-docs-execute/SKILL.md` przez Read tool i wykonuje instrukcje inline. To **fallback** który już mamy w autopilocie (sekcja "Fallback: Jesli Skill tool jest niedostepny").

**Plus:** skille żyją jako osobne pliki, autopilot main-thread spawnuje subagentów legalnie.
**Minus:** semantycznie dziwne (skille są "instrukcjami" nie "wywołaniami"), Claude może nie rozumieć żeby wykonywać krok po kroku.

**Niesprawdzone w boju.**

## Aktualna decyzja — wracamy do poprzedniej konfiguracji

Zostajemy przy **obecnej architekturze na main** (`autopilot → Agent(general-purpose) → Skill → Agent(builder)`), mimo że łamie regułę Anthropic.

**Powód:** działa w praktyce, mimo że nie powinno. Wariant A nie był wart kompromisu (modularność iluzoryczna, dodatkowe bugi).

**Ryzyka świadomie akceptowane:**
- Cichy bug może się pojawić w przyszłej wersji Claude Code jeśli platforma zaostrzy enforcement
- Druga warstwa subagenta (builder) może działać niepoprawnie w niektórych edge case'ach
- Architektura nie skaluje się — gdyby trzeba dodać trzeci poziom, nie da się

## Kiedy wrócić do tematu

- Gdy Claude Code wypuści **stable Agent Teams** lub inną feature pozwalającą na multi-level delegation
- Gdy `Skill tool` zacznie expandować positional args (`$1`/`$2`) — wtedy Wariant A może zadziałać
- Gdy user zmieni zdanie i zaakceptuje CLI entry point (`claude --agent`) — wtedy Opcja B jest dostępna
- Gdy obecna architektura zacznie produkować widoczne błędy w produkcji

## Linki do badań

- [docs.claude.com — Sub-agents](https://code.claude.com/docs/en/sub-agents.md)
- [docs.claude.com — Agent Teams](https://code.claude.com/docs/en/agent-teams.md)
- [docs.claude.com — Skills](https://code.claude.com/docs/en/skills.md)
- Branch `refactor/autopilot-flatten-delegation` (usunięty) — w `git reflog` można znaleźć commit hashe: `53850b9`, `c05b52e`, `1a6dd00`, `b902926`
- Pełny transcript testu w boju: gramywpadla repo (Etap 7 — create-tournament-wizard)
