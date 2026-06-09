export const meta = {
  name: 'dev-docs-execute-wf',
  description: 'Wykonanie JEDNEJ fazy zadania: planner czyta IU z docs/plans/, buildery (feature-builder-mobile-*) implementuja je przez agentType, potem walidacja + commit + aktualizacja dokumentacji.',
  whenToUse: 'Pojedyncza faza implementacji. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
  phases: [
    { title: 'Plan IU', detail: 'wczytaj plan techniczny, zbuduj prompty builderow' },
    { title: 'Build', detail: 'jeden builder per Implementation Unit' },
    { title: 'Domkniecie', detail: 'walidacja, commit, aktualizacja docs' },
  ],
}

// ── Schematy ──────────────────────────────────────────────────────────────

const IU_PLAN = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    fazaNazwa: { type: 'string' },
    strategia: { type: 'string', enum: ['serial', 'parallel'], description: 'serial gdy IU maja zaleznosci/wspolne pliki; parallel gdy niezalezne' },
    poza: { type: 'boolean', description: 'true gdy faza juz ukonczona / nic do zrobienia' },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          agentType: {
            type: 'string',
            enum: ['feature-builder-mobile-ui', 'feature-builder-mobile-data', 'feature-builder-mobile-fullstack'],
          },
          prompt: { type: 'string', description: 'KOMPLETNY blok IU gotowy do wyslania builderowi (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja) + sciezka zadania + numer IU + doklejony designerski kontekst gdy UI/fullstack' },
        },
        required: ['id', 'nazwa', 'agentType', 'prompt'],
      },
    },
  },
  required: ['fazaNumer', 'strategia', 'poza', 'iu'],
}

const BUILD_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    pliki: { type: 'array', items: { type: 'string' } },
    odchylenia: { type: 'array', items: { type: 'string' } },
    nastepneKroki: { type: ['string', 'null'] },
    pytanie: { type: ['string', 'null'], description: 'wypelnione gdy status=blocked' },
  },
  required: ['id', 'status'],
}

const EXECUTE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    status: { type: 'string', enum: ['completed', 'partial', 'blocked'] },
    iu: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          nazwa: { type: 'string' },
          subagent: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['id', 'status'],
      },
    },
    commity: { type: 'array', items: { type: 'string' } },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami lub "brak"' },
    odchylenia: { type: 'array', items: { type: 'string' } },
    problem: { type: ['string', 'null'] },
  },
  required: ['fazaNumer', 'status', 'iu'],
}

// ── Buildery promptow ──────────────────────────────────────────────────────

function plannerPrompt(sciezka, faza) {
  return `Jestes plannerem fazy implementacji. Zbuduj liste Implementation Units gotowych do delegacji.

Folder zadania: ${sciezka}
Faza do wykonania: ${faza}

Referencja metodologii: przeczytaj .claude/skills/dev-docs-execute/SKILL.md sekcje 2.5, 3, 3a
(strategia delegacji, granice scope'u, mandatory designerski kontekst).

1. Przeczytaj ${sciezka}/*-plan.md, ${sciezka}/*-zadania.md, ${sciezka}/*-kontekst.md.
2. Otworz plan techniczny w docs/plans/ (referencja "Plan techniczny:"/"origin:" w pliku planu zadania).
   Zlokalizuj Implementation Units odpowiadajace fazie ${faza}.
3. Jesli faza ${faza} jest juz ukonczona albo nie ma niezaznaczonych checkboxow (poza Weryfikacja:) -> ustaw poza=true, iu=[].
4. Wybierz strategie: serial (IU zalezne / wspolne pliki) lub parallel (IU niezalezne).
5. Dla kazdego IU zbuduj KOMPLETNY prompt builderowi:
   - caly blok IU doslownie (Cel, Wymagania, Pliki, Podejscie, Wzorce, Scenariusze testowe, Weryfikacja)
   - sciezka zadania ${sciezka} + numer IU
   - dla feature-builder-mobile-ui|fullstack: doklej "Mandatory designerski kontekst" z sekcji "Designerski kontekst"
     w ${sciezka}/*-kontekst.md (DESIGN.md, SPEC.md, screeny). Dla -data pomijaj.
   - NIE kopiuj "Skills in play:" — skille sa wstrzykiwane z frontmatter subagenta.
   - agentType = wartosc pola "Delegate to:" z IU.
   Wymagania wykonania dla buildera: zaimplementuj kod dla checkboxow (oprocz "Weryfikacja:"),
   napisz testy dla checkboxow "Test:" RAZEM z kodem, NIE wykonuj "Weryfikacja:" (to dla review).
   Gdy builder uruchamia vitest — niech doda \`--reporter=dot\` (output strumieniowy: cold-cache
   component-vitest milczy kilkanascie minut na stdout, a watchdog runtime zabija subagenta po ~180s ciszy).

Zwroc obiekt zgodny ze schematem IUPlan. Sam nie implementuj kodu.`
}

function domknieciePrompt(sciezka, faza, buildResults) {
  const podsumowanieIU = buildResults
    .map((b) => `- ${b.id}: ${b.status}${b.odchylenia && b.odchylenia.length ? ` (odchylenia: ${b.odchylenia.join('; ')})` : ''}`)
    .join('\n')
  return `Jestes domknieciem fazy implementacji. Buildery skonczyly — zwaliduj i utrwal.

Folder zadania: ${sciezka}
Faza: ${faza}

Raporty builderow:
${podsumowanieIU}

1. System-Wide Test Check (.claude/skills/dev-docs-execute/SKILL.md sekcja 4.5): typecheck bez nowych bledow,
   istniejace testy przechodza, nowe testy pokrywaja happy path + error case, checkboxy "Test:" napisane i przechodza,
   importy nie lamia modulow, build/expo-doctor przechodzi. Komendy z package.json (NIE eas build).
   Vitest uruchamiaj z \`--reporter=dot\` (output strumieniowy — chroni przed watchdogiem ~180s ciszy).
2. Aktualizuj ${sciezka}/*-zadania.md: oznacz ukonczone checkboxy [x] (NIE ruszaj "Weryfikacja:" — to dla review).
3. Aktualizuj ${sciezka}/*-kontekst.md: zmiany, decyzje, "Ostatnia aktualizacja".
4. Aktualizuj plan techniczny w docs/plans/ (odznacz test scenarios / verification dla tej fazy).
5. Commit inkrementalny: feat/fix/refactor([nazwa]): [co i dlaczego]. Staguj tylko zmienione pliki (nie git add .).

Dzialaj autonomicznie. Zwroc obiekt zgodny ze schematem ExecuteResult
(status=completed tylko gdy walidacja PASS i wszystkie IU completed).`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, status: 'blocked', iu: [], problem: 'brak args {sciezka, faza}' }
}

phase('Plan IU')
const plan = await agent(plannerPrompt(sciezka, faza), { schema: IU_PLAN, label: `planner:faza-${faza}` })

if (plan.poza || plan.iu.length === 0) {
  return { fazaNumer: faza, status: 'completed', iu: [], commity: [], testy: 'brak', odchylenia: [], problem: null }
}

phase('Build')
let builds
if (plan.strategia === 'parallel') {
  // IU niezalezne — wszystkie buildery rownolegle (bariera, czekamy na komplet)
  builds = await parallel(
    plan.iu.map((iu) => () =>
      agent(iu.prompt, { schema: BUILD_RESULT, agentType: iu.agentType, label: `build:${iu.id}`, phase: 'Build' })
    )
  )
} else {
  // serial — IU zalezne / wspolne pliki, kolejnosc ma znaczenie
  builds = []
  for (const iu of plan.iu) {
    const r = await agent(iu.prompt, { schema: BUILD_RESULT, agentType: iu.agentType, label: `build:${iu.id}`, phase: 'Build' })
    builds.push(r)
    if (r && r.status === 'blocked') break // STOP serii — kolejne IU moga zalezec od tego
  }
}

const buildResults = builds.filter(Boolean)
const zablokowany = buildResults.find((b) => b.status === 'blocked')
if (zablokowany) {
  return {
    fazaNumer: faza,
    status: 'blocked',
    iu: buildResults.map((b) => ({ id: b.id, status: b.status })),
    commity: [],
    testy: 'n/a',
    odchylenia: [],
    problem: zablokowany.pytanie || `IU ${zablokowany.id} zablokowany`,
  }
}

phase('Domkniecie')
const wynik = await agent(domknieciePrompt(sciezka, faza, buildResults), { schema: EXECUTE_RESULT, label: `domkniecie:faza-${faza}` })
return wynik
