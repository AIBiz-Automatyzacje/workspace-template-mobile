export const meta = {
  name: 'dev-autopilot-wf',
  description: 'Autonomiczny pipeline: bootstrap -> per faza (execute -> review+verify -> fix, bez re-review) -> complete -> compound. Orkiestrator trzyma plan w kodzie; buildery i reviewerzy to leaf-agenci.',
  whenToUse: 'Wykonanie calego planu zadania z docs/active/. Git zwaliduj w sesji PRZED odpaleniem (workflow nie pyta o branch switch). RESUME po przerwanym runie: uzyj Workflow({scriptPath, resumeFromRunId}) i ZAWSZE przekaz args ponownie (te sama sciezke zadania) — args NIE przezywa miedzy wywolaniami, bez niego run robi natychmiastowy STOP.',
  phases: [
    { title: 'Bootstrap', detail: 'parse plan + zadania -> PlanState, resume z checkboxow' },
    { title: 'Zakonczenie', detail: 'walidacja koncowa -> complete -> compound' },
  ],
}

// ── Konfiguracja ──────────────────────────────────────────────────────────
// Poprawka 11: re-review po fixie USUNIETY (decyzja usera). Flow: execute -> review -> fix -> koniec.
// Jeden przebieg fix, bez ponownego review. Gate liczony z self-reportu fixa (nierozwiazaneP1/P2 + walidacja).
// Dane z wf_3c9d3864: nawet 2. cykl fix naprawial 0 -> re-review tym bardziej byl czystym pomiarem.

// ── Schematy (tylko te, ktorych orkiestrator uzywa bezposrednio) ──────────
// ExecuteResult / ReviewResult sa walidowane wewnatrz pod-workflowow i wracaja
// tu jako gotowe obiekty przez workflow().

const PLAN_STATE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nazwaZadania: { type: 'string', description: 'ostatni segment sciezki zadania' },
    branch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        aktualny: { type: 'string' },
        wymagany: { type: ['string', 'null'] },
        zgodny: { type: 'boolean' },
        czysty: { type: 'boolean', description: 'brak niezacommitowanych zmian' },
      },
      required: ['aktualny', 'wymagany', 'zgodny', 'czysty'],
    },
    fazy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          numer: { type: 'integer' },
          nazwa: { type: 'string' },
          ukonczona: { type: 'boolean', description: 'wszystkie checkboxy [x] (poza Weryfikacja:/Operator:/[E2E]/[Manual] — te liczy review/operator, nie execute)' },
          reviewIstnieje: { type: 'boolean' },
          maNierozwiazaneP1P2: { type: 'boolean', description: 'sekcja "Do poprawy po review fazy N" ma niezaznaczone P1/P2' },
        },
        required: ['numer', 'nazwa', 'ukonczona', 'reviewIstnieje', 'maNierozwiazaneP1P2'],
      },
    },
    kolejka: { type: 'array', items: { type: 'integer' }, description: 'numery faz do wykonania, w kolejnosci' },
  },
  required: ['nazwaZadania', 'branch', 'fazy', 'kolejka'],
}

const FIX_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    naprawione: { type: 'integer' },
    pozostaje: { type: 'integer' },
    typy: {
      type: 'object',
      additionalProperties: false,
      properties: { kod: { type: 'integer' }, test: { type: 'integer' }, e2e: { type: 'integer' } },
      required: ['kod', 'test', 'e2e'],
    },
    e2eReweryfikacja: { type: 'string', description: 'X/Y passed lub "n/a"' },
    walidacja: { type: 'string', enum: ['PASS', 'FAIL'] },
    commity: { type: 'array', items: { type: 'string' } },
    nienaprawione: { type: 'array', items: { type: 'string' } },
    // Bez re-review: orkiestrator gate'uje z tych pol. nierozwiazaneP1>0 lub walidacja FAIL -> STOP.
    nierozwiazaneP1: { type: 'integer', description: 'P1 ktorych fix NIE zamknal (krytyczne -> STOP)' },
    nierozwiazaneP2: { type: 'integer', description: 'P2 przeniesione do known-issues (graceful)' },
  },
  required: ['naprawione', 'pozostaje', 'walidacja', 'nierozwiazaneP1', 'nierozwiazaneP2'],
}

const VALIDATION_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wykryteKomendy: { type: 'array', items: { type: 'string' } },
    typecheck: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    lint: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami X/Y' },
    expoDoctor: { type: 'string', enum: ['PASS', 'FAIL', 'n/a'] },
    wynik: { type: 'string', enum: ['PASS', 'FAIL'] },
    bledy: { type: 'array', items: { type: 'string' } },
  },
  required: ['wynik'],
}

// P1: rozgrzewka — runtime ma twardy watchdog (~180s ciszy subagenta -> kill, 6 retry -> FAILED run).
// Cold-cache vitest na komponentach RN (react-native-web transform + optimizeDeps) potrafi milczec ~16 min
// na stdout -> watchdog zabija builder na KAZDEJ fazie UI. Rozgrzanie node_modules/.vite RAZ tu sprawia,
// ze kazdy kolejny vitest agenta jest warm (<kilka s). Cache zyje na dysku repo i przezywa miedzy agentami
// (agenci dziela working dir — brak isolation:worktree). Self-skip gdy projekt nie ma vitest.
const WARMUP_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wykonano: { type: 'boolean', description: 'true gdy odpalono test rozgrzewajacy; false gdy projekt nie ma vitest/component-testow' },
    detal: { type: 'string', description: 'co odpalono + czas, lub powod pominiecia' },
  },
  required: ['wykonano'],
}

// ── Buildery promptow (leaf-agenci) ───────────────────────────────────────

function bootstrapPrompt(sciezka) {
  return `Jestes bootstrapem pipeline'u dev-autopilot. Zbuduj jawny stan orkiestratora.

Folder zadania: ${sciezka}

1. GIT: uruchom \`git branch --show-current\` i \`git status --short\`.
   Przeczytaj wymagany branch z dokumentacji w ${sciezka}/ (szukaj "Branch:").
   Ustaw branch.zgodny (aktualny == wymagany lub wymagany == null) oraz branch.czysty (pusty status).

2. PLAN: przeczytaj ${sciezka}/*-plan.md -> lista faz [(numer, nazwa)].
3. ZADANIA: przeczytaj ${sciezka}/*-zadania.md -> per faza:
   - faza UKONCZONA = wszystkie checkboxy oznaczone [x] z WYJATKIEM checkboxow, ktorych NIE robi execute:
     "Weryfikacja:", "Operator:", oraz oznaczone "[E2E]" / "[Manual]" (te zamyka review/operator, nie builder).
   - niezaznaczone "Weryfikacja:"/"Operator:"/"[E2E]"/"[Manual]" NIE czynia fazy "do wykonania" — POMIN je w liczeniu.
   - dowolny INNY [ ] = faza DO WYKONANIA.
4. REVIEW: dla kazdej fazy sprawdz czy istnieje ${sciezka}/review-faza-{numer}.md (reviewIstnieje).
   Sprawdz sekcje "Do poprawy po review fazy {numer}" w zadaniach — niezaznaczone P1/P2 => maNierozwiazaneP1P2=true.
5. KOLEJKA: numery faz do wykonania w kolejnosci. Pomin fazy ukonczone BEZ nierozwiazanych P1/P2.
   Faza ukonczona ALE z nierozwiazanymi P1/P2 NALEZY do kolejki (zacznie sie od fix, nie execute).

nazwaZadania = ostatni segment sciezki ${sciezka}.
Zwroc obiekt zgodny ze schematem. Nie modyfikuj zadnych plikow — to read-only bootstrap.`
}

function fixPrompt(sciezka, numerFazy) {
  return `Jestes czescia pipeline'u dev-autopilot. Naprawiasz problemy z review fazy ${numerFazy}.
WAZNE: to JEDYNY przebieg fix tej fazy — po nim NIE ma ponownego review. Twoj raport jest
OSTATECZNYM zrodlem prawdy o stanie findingow, wiec klasyfikuj uczciwie czego nie zamknales.

Folder zadania: ${sciezka}
Numer fazy: ${numerFazy}

Przeczytaj ${sciezka}/*-zadania.md sekcje "Do poprawy po review fazy ${numerFazy}"
oraz ${sciezka}/review-faza-${numerFazy}.md dla pelnego kontekstu kazdego findingu.

Napraw WSZYSTKIE P1 (blocking) i P2 (important). Pomin P3 (nit).

KLASYFIKUJ kazdy finding przed naprawa:
- Typ A KOD (blad implementacji/security/perf/architektury): napraw kod -> uruchom unit testy -> odznacz checkbox.
- Typ B BRAKUJACY TEST (Test:): NIE ruszaj kodu produkcyjnego, napisz test (min 1 asercja, nie assertion-free)
  zgodnie z planem w docs/plans/ -> uruchom -> odznacz.
- Typ C WERYFIKACJA E2E (Weryfikacja:/oznaczenie 🌐 lub 📱): napraw przyczyne -> re-uruchom Maestro
  na emulatorze (.maestro/<flow>.yaml, exit 0 + assertVisible) -> odznacz DOPIERO po PASS (nie na "naprawilem kod").

Kolejnosc: A (kod) -> B (testy) -> C (E2E). Vitest uruchamiaj z \`--reporter=dot\`
(output strumieniowy — chroni dlugie testy przed watchdogiem ~180s ciszy). Po naprawach: pelna walidacja
(typecheck, test, expo-doctor — komendy z package.json; NIE eas build), commit
\`fix([nazwa]): poprawki po review fazy ${numerFazy}\`, staguj tylko zmienione pliki.

KNOWN-ISSUES (graceful — bez osobnego agenta): jesli ZOSTAJA P2 ktorych NIE udalo sie naprawic
(a zero nierozwiazanych P1), zapisz je do ${sciezka}/known-issues.md. Dedup: jesli sekcja
"## Faza ${numerFazy}" juz istnieje — ZASTAP jej cala tresc (od naglowka do nastepnego "## " lub konca pliku),
NIE dopisuj duplikatu. Format: "## Faza ${numerFazy}\\nPozostaje N problemow P2 po fixie. Review: review-faza-${numerFazy}.md\\n- 🟠 [P2] plik — opis".
Po zapisie upewnij sie ze jest DOKLADNIE jeden naglowek "## Faza ${numerFazy}".

Dzialaj autonomicznie, nie pytaj usera. Zwroc obiekt FixResult — KRYTYCZNE pola (orkiestrator gate'uje z nich,
bez re-review): nierozwiazaneP1 (P1 ktorych NIE zamknales -> orkiestrator zrobi STOP),
nierozwiazaneP2 (P2 przeniesione do known-issues), walidacja (PASS/FAIL pelnej walidacji).`
}

function warmupPrompt(sciezka) {
  return `Jestes rozgrzewka cache testowego pipeline'u dev-autopilot (folder zadania: ${sciezka}).
CEL: zbudowac cache transformacji testow PRZED fazami implementacji, zeby pierwszy "zimny" vitest
nie milczal kilkanascie minut na stdout (watchdog runtime zabija subagenta po ~180s ciszy).

1. Wykryj test runner: przeczytaj package.json. Jesli NIE ma vitest (ani jest/innego z ciezkim setupem)
   -> zwroc {wykonano:false, detal:"brak vitest — rozgrzewka zbedna"}. Nie kombinuj.
2. Jesli jest vitest: znajdz JEDEN test komponentu z najciezszym setupem — preferuj *.test.tsx
   w components/ (transform react-native -> react-native-web jest najdrozszy). Brak component-testu
   -> wez dowolny istniejacy plik testowy.
3. Uruchom GO RAZ przez wlasciwy package manager (bun.lockb->bunx, pnpm->pnpm, npm->npx), np.
   \`bunx vitest run <plik> --reporter=dot\`. To buduje node_modules/.vite/optimizeDeps.
   WYNIK testu (pass/fail) jest NIEISTOTNY — liczy sie zbudowanie cache. Nie naprawiaj asercji.
4. NIE modyfikuj zadnych plikow zrodlowych. To tylko rozgrzewka.

Zwroc {wykonano, detal} (detal: co odpalono + ile trwalo, lub powod pominiecia).`
}

function finalValidationPrompt(sciezka) {
  return `Wykonaj pelna walidacje calego projektu po autopilocie (folder zadania: ${sciezka}).

KROK 1 — odkryj komendy (NIE zgaduj): przeczytaj package.json scripts (typecheck/lint/test/check),
wykryj package manager (bun.lockb->bun, pnpm-lock->pnpm, yarn.lock->yarn, package-lock->npm).
Brak skryptu typecheck -> sprobuj tsc --noEmit jesli jest tsconfig.json. Stack Expo: zamiast build uzyj
\`bunx expo-doctor\` (NIE eas build). Makefile/pyproject/Cargo — uzyj wlasciwych narzedzi.

KROK 2 — uruchom w kolejnosci, zatrzymaj przy pierwszym FAIL: typecheck -> lint (jesli jest) -> test -> expo-doctor.
   Dla vitest dodaj \`--reporter=dot\` (output strumieniowy — dlugie testy emituja progress, nie cisza).
KROK 2.5 (P4 — flake infra, nie defekt): jesli pelny suite vitest zglosi na pliku bled INFRA workera,
   nie asercje — sygnatury: "[vitest-worker]: Timeout calling \\"fetch\\"", "Timeout calling", worker terminated,
   ENOMEM, heap out of memory -> RE-URUCHOM TEN JEDEN plik w izolacji (\`vitest run <plik> --reporter=dot\`).
   PASS w izolacji => to flake pod obciazeniem, NIE blokuj (testy=PASS, dopisz plik do bledy[] jako "flake-infra: <plik> (PASS w izolacji)").
   FAIL tez w izolacji => realny defekt, wynik=FAIL. Dotyczy WYLACZNIE bledow infra workera, nie failujacych asercji.
KROK 3 — jesli FAIL (realny) i potrafisz naprawic prosty problem (import, typ) — napraw, commituj, uruchom ponownie.
   Jak nie potrafisz — zwroc liste bledow z lokalizacjami i wynik=FAIL.

Zwroc obiekt zgodny ze schematem ValidationResult.`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

// Poprawka 3: sanityzacja — UI wstrzykuje prefix '@' (mention) i czesto trailing '/'.
// Bez tego prompty buduja sciezki typu "@docs/active/x//" (kruche, agent musi zgadywac).
const sciezkaRaw = typeof args === 'string' ? args : args && args.sciezka
const sciezka = sciezkaRaw && sciezkaRaw.replace(/^@/, '').replace(/\/+$/, '')
if (!sciezka) {
  // P3: najczestsza przyczyna tu = resume przez scriptPath BEZ ponownego przekazania args.
  // args nie przezywa miedzy wywolaniami workflow — trzeba je podac przy KAZDYM (re)starcie.
  return {
    status: 'STOP',
    powod: 'brak sciezki zadania. Przy starcie: args:"docs/active/<zadanie>". Przy RESUME (scriptPath+resumeFromRunId): przekaz args PONOWNIE — nie przenosi sie z poprzedniego runu.',
  }
}

// Pomiar kosztu per faza -> log, zeby nastepny run byl mierzalny (transkrypty agentow nie przezywaja,
// zostaje tylko TUI/log). budget.spent() = tokeny wyjsciowe runu; guard na konteksty bez budgetu.
const tokSpent = () => (typeof budget !== 'undefined' && budget && budget.spent ? budget.spent() : 0)

phase('Bootstrap')
const stan = await agent(bootstrapPrompt(sciezka), { schema: PLAN_STATE, label: 'bootstrap' })

// Decyzja A: git zwalidowany w sesji przed odpaleniem; tu tylko bezpiecznik.
if (!stan.branch.zgodny) {
  return { status: 'STOP', powod: `branch mismatch: jestes na "${stan.branch.aktualny}", wymagany "${stan.branch.wymagany}"`, stan }
}
if (!stan.branch.czysty) {
  return { status: 'STOP', powod: 'niezacommitowane zmiany z poprzedniej sesji — zacommituj/stash przed autopilotem', stan }
}

log(`Autopilot: ${stan.nazwaZadania} — fazy do wykonania: ${stan.kolejka.join(', ') || 'brak'}`)

// P1: rozgrzej cache vitest RAZ przed pierwsza faza (chroni przed watchdog-killem na cold component-vitest).
// Tylko gdy faktycznie cos wykonujemy — pusta kolejka nie potrzebuje rozgrzewki.
if (stan.kolejka.length > 0) {
  const warmup = await agent(warmupPrompt(sciezka), { schema: WARMUP_RESULT, label: 'warmup:vitest', phase: 'Bootstrap' })
  log(`Rozgrzewka cache: ${warmup.wykonano ? 'OK' : 'pominieta'} — ${warmup.detal || ''}`)
}

const historia = {}
const raporty = []
const tokRunStart = tokSpent()

for (const numerFazy of stan.kolejka) {
  const faza = stan.fazy.find((f) => f.numer === numerFazy)
  phase(`Faza ${numerFazy}`)
  const tokFazaStart = tokSpent()

  // Resume: faza ukonczona z nierozwiazanymi P1/P2 -> zacznij od fix, pomijajac execute (naprawia Bug 1).
  const rozpocznijOdFix = faza.ukonczona && faza.reviewIstnieje && faza.maNierozwiazaneP1P2

  if (!rozpocznijOdFix && !faza.ukonczona) {
    const exec = await workflow('dev-docs-execute-wf', { sciezka, faza: numerFazy })
    if (!exec || exec.status !== 'completed') {
      return { status: 'STOP', powod: `execute fazy ${numerFazy} zwrocil "${exec ? exec.status : 'null'}"`, faza: numerFazy, exec, raporty }
    }
    log(`Faza ${numerFazy}: Execute OK (${exec.iu.length} IU)`)
  }

  // Liniowo: review (pelny pod-workflow: packager + 7 reviewerow + verify) -> fix -> koniec fazy.
  // Re-review po fixie USUNIETY (Poprawka 11). Gate liczony z self-reportu fixa.
  // KOSZT/RYZYKO: zamkniecie findingow nie jest niezaleznie weryfikowane — ufamy raportowi fixa.
  // Mitygacja: walidacja koncowa na Zakonczeniu nadal lapie regresje typecheck/test/lint/expo-doctor.
  const review = await workflow('dev-docs-review-wf', { sciezka, faza: numerFazy, poprzednieFindingi: null })
  const { p1, p2 } = review.liczniki
  const operator = review.liczniki.operator || 0
  log(`Review fazy ${numerFazy}: P1=${p1} P2=${p2} P3=${review.liczniki.p3} OPERATOR=${operator} (gate: ${review.severityGate})`)

  let gateFazy = review.severityGate
  let cykle = 0

  if (p1 > 0 || p2 > 0) {
    const fix = await agent(fixPrompt(sciezka, numerFazy), { schema: FIX_RESULT, label: `fix:faza-${numerFazy}` })
    cykle = 1
    log(`Fix fazy ${numerFazy}: naprawiono ${fix.naprawione}, nierozwiazane P1=${fix.nierozwiazaneP1} P2=${fix.nierozwiazaneP2}, walidacja ${fix.walidacja}`)

    if (fix.walidacja === 'FAIL' || fix.nierozwiazaneP1 > 0) {
      return {
        status: 'STOP',
        powod: fix.nierozwiazaneP1 > 0
          ? `Faza ${numerFazy}: ${fix.nierozwiazaneP1}x P1 nierozwiazane po fixie (brak re-review) — wymagana reczna interwencja`
          : `Faza ${numerFazy}: walidacja fixa FAIL — wymagana reczna interwencja`,
        faza: numerFazy, review, fix, raporty,
      }
    }

    if (fix.nierozwiazaneP2 > 0) {
      gateFazy = 'ZASTRZEZENIA'
      cykle = '1 (graceful P2)'
      log(`Faza ${numerFazy}: GRACEFUL — ${fix.nierozwiazaneP2}x P2 do known-issues, kontynuuje`)
    } else {
      gateFazy = 'CZYSTE'
    }
  }

  historia[numerFazy] = cykle
  const tokFazy = Math.round((tokSpent() - tokFazaStart) / 1000)
  log(`Faza ${numerFazy}: koniec — gate ${gateFazy}, cykle ${cykle}, ~${tokFazy}k tokenow`)
  raporty.push({ faza: numerFazy, gate: gateFazy, cykle, tokeny: `${tokFazy}k` })
}

// ── Zakonczenie ──────────────────────────────────────────────────────────
phase('Zakonczenie')

const walidacja = await agent(finalValidationPrompt(sciezka), { schema: VALIDATION_RESULT, label: 'walidacja-koncowa' })
if (walidacja.wynik === 'FAIL') {
  return { status: 'STOP', powod: 'walidacja koncowa FAIL', walidacja, historia, raporty }
}

const complete = await workflow('dev-docs-complete-wf', { nazwaZadania: stan.nazwaZadania })
const compound = await workflow('dev-compound-wf', { sciezka })

const tokRazem = Math.round((tokSpent() - tokRunStart) / 1000)
log(`Autopilot koniec: ${stan.kolejka.length} faz, ~${tokRazem}k tokenow lacznie`)

return {
  status: 'OK',
  nazwaZadania: stan.nazwaZadania,
  fazyUkonczone: stan.kolejka.length,
  tokeny: `${tokRazem}k`,
  historia,
  raporty,
  walidacja,
  archiwum: complete && complete.archiwum,
  solution: compound && compound.plik,
  regula: compound && compound.regula,
}
