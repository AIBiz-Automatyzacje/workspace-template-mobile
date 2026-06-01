export const meta = {
  name: 'dev-autopilot-wf',
  description: 'Autonomiczny pipeline: bootstrap -> per faza (execute -> review -> adversarial verify -> fix) -> complete -> compound. Orkiestrator trzyma plan w kodzie; buildery i reviewerzy to leaf-agenci.',
  whenToUse: 'Wykonanie calego planu zadania z docs/active/. Git zwaliduj w sesji PRZED odpaleniem (workflow nie pyta o branch switch).',
  phases: [
    { title: 'Bootstrap', detail: 'parse plan + zadania -> PlanState, resume z checkboxow' },
    { title: 'Zakonczenie', detail: 'walidacja koncowa -> complete -> compound' },
  ],
}

// ── Konfiguracja ──────────────────────────────────────────────────────────
// Poprawka 2: 1 cykl. Dane z runu wf_3c9d3864 pokazaly ze 2. cykl fix naprawial 0
// we wszystkich 3 fazach, a kosztowal pelny re-review. Po 1 nieudanym fixie -> graceful/STOP.
const MAX_FIX_CYKLI = 1

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
          ukonczona: { type: 'boolean', description: 'wszystkie checkboxy [x] (poza Weryfikacja:)' },
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
  },
  required: ['naprawione', 'pozostaje', 'walidacja'],
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

// ── Buildery promptow (leaf-agenci) ───────────────────────────────────────

function bootstrapPrompt(sciezka) {
  return `Jestes bootstrapem pipeline'u dev-autopilot. Zbuduj jawny stan orkiestratora.

Folder zadania: ${sciezka}

1. GIT: uruchom \`git branch --show-current\` i \`git status --short\`.
   Przeczytaj wymagany branch z dokumentacji w ${sciezka}/ (szukaj "Branch:").
   Ustaw branch.zgodny (aktualny == wymagany lub wymagany == null) oraz branch.czysty (pusty status).

2. PLAN: przeczytaj ${sciezka}/*-plan.md -> lista faz [(numer, nazwa)].
3. ZADANIA: przeczytaj ${sciezka}/*-zadania.md -> per faza:
   - faza UKONCZONA = wszystkie checkboxy oznaczone [x] (z WYJATKIEM checkboxow "Weryfikacja:")
   - dowolny [ ] (poza Weryfikacja:) = faza DO WYKONANIA
4. REVIEW: dla kazdej fazy sprawdz czy istnieje ${sciezka}/review-faza-{numer}.md (reviewIstnieje).
   Sprawdz sekcje "Do poprawy po review fazy {numer}" w zadaniach — niezaznaczone P1/P2 => maNierozwiazaneP1P2=true.
5. KOLEJKA: numery faz do wykonania w kolejnosci. Pomin fazy ukonczone BEZ nierozwiazanych P1/P2.
   Faza ukonczona ALE z nierozwiazanymi P1/P2 NALEZY do kolejki (zacznie sie od fix, nie execute).

nazwaZadania = ostatni segment sciezki ${sciezka}.
Zwroc obiekt zgodny ze schematem. Nie modyfikuj zadnych plikow — to read-only bootstrap.`
}

function fixPrompt(sciezka, numerFazy, cykl, maxCykli) {
  return `Jestes czescia pipeline'u dev-autopilot. Naprawiasz problemy z review.

Folder zadania: ${sciezka}
Numer fazy: ${numerFazy}
Cykl naprawy: ${cykl} z ${maxCykli}

Przeczytaj ${sciezka}/*-zadania.md sekcje "Do poprawy po review fazy ${numerFazy}"
oraz ${sciezka}/review-faza-${numerFazy}.md dla pelnego kontekstu kazdego findingu.

Napraw WSZYSTKIE P1 (blocking) i P2 (important). Pomin P3 (nit).

KLASYFIKUJ kazdy finding przed naprawa:
- Typ A KOD (blad implementacji/security/perf/architektury): napraw kod -> uruchom unit testy -> odznacz checkbox.
- Typ B BRAKUJACY TEST (Test:): NIE ruszaj kodu produkcyjnego, napisz test (min 1 asercja, nie assertion-free)
  zgodnie z planem w docs/plans/ -> uruchom -> odznacz.
- Typ C WERYFIKACJA E2E (Weryfikacja:/oznaczenie 🌐 lub 📱): napraw przyczyne -> re-uruchom Maestro
  na emulatorze (.maestro/<flow>.yaml, exit 0 + assertVisible) -> odznacz DOPIERO po PASS (nie na "naprawilem kod").

Kolejnosc: A (kod) -> B (testy) -> C (E2E). Po naprawach: pelna walidacja
(typecheck, test, expo-doctor — komendy z package.json; NIE eas build), commit
\`fix([nazwa]): poprawki po review fazy ${numerFazy} (cykl ${cykl})\`, staguj tylko zmienione pliki.

Dzialaj autonomicznie, nie pytaj usera. Zwroc obiekt zgodny ze schematem FixResult.`
}

function gracefulP2Prompt(sciezka, numerFazy, review) {
  const lista = review.findings
    .filter((f) => f.severity === 'P2')
    .map((f) => `- 🟠 [P2] ${f.plik || '?'} — ${f.opis}`)
    .join('\n')
  return `Wyczerpano ${MAX_FIX_CYKLI} cykli napraw fazy ${numerFazy}, zostaja same P2 (zero P1).
Severity gate dla samych P2 = "KONTYNUUJ Z ZASTRZEZENIAMI".

Zaktualizuj ${sciezka}/known-issues.md. WAZNE (Poprawka 6): jesli sekcja "## Faza ${numerFazy}"
juz istnieje w pliku — ZASTAP jej calа tresc (od naglowka "## Faza ${numerFazy}" do nastepnego "## " lub konca pliku),
NIE dopisuj duplikatu naglowka. Jesli nie istnieje — dodaj na koncu. Docelowa tresc sekcji:

## Faza ${numerFazy}
Wyczerpano ${MAX_FIX_CYKLI} cykl(e) napraw. Pozostaje ${review.liczniki.p2} problemow P2.
Review: review-faza-${numerFazy}.md

${lista}

Po zapisie zweryfikuj ze w pliku jest DOKLADNIE jeden naglowek "## Faza ${numerFazy}".
Nie ruszaj kodu — tylko zapisz known-issues. Zwroc sciezke do pliku.`
}

function finalValidationPrompt(sciezka) {
  return `Wykonaj pelna walidacje calego projektu po autopilocie (folder zadania: ${sciezka}).

KROK 1 — odkryj komendy (NIE zgaduj): przeczytaj package.json scripts (typecheck/lint/test/check),
wykryj package manager (bun.lockb->bun, pnpm-lock->pnpm, yarn.lock->yarn, package-lock->npm).
Brak skryptu typecheck -> sprobuj tsc --noEmit jesli jest tsconfig.json. Stack Expo: zamiast build uzyj
\`bunx expo-doctor\` (NIE eas build). Makefile/pyproject/Cargo — uzyj wlasciwych narzedzi.

KROK 2 — uruchom w kolejnosci, zatrzymaj przy pierwszym FAIL: typecheck -> lint (jesli jest) -> test -> expo-doctor.
KROK 3 — jesli FAIL i potrafisz naprawic prosty problem (import, typ) — napraw, commituj, uruchom ponownie.
   Jak nie potrafisz — zwroc liste bledow z lokalizacjami i wynik=FAIL.

Zwroc obiekt zgodny ze schematem ValidationResult.`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

// Poprawka 3: sanityzacja — UI wstrzykuje prefix '@' (mention) i czesto trailing '/'.
// Bez tego prompty buduja sciezki typu "@docs/active/x//" (kruche, agent musi zgadywac).
const sciezkaRaw = typeof args === 'string' ? args : args && args.sciezka
const sciezka = sciezkaRaw && sciezkaRaw.replace(/^@/, '').replace(/\/+$/, '')
if (!sciezka) {
  return { status: 'STOP', powod: 'brak sciezki zadania (podaj args: "docs/active/<zadanie>")' }
}

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

const historia = {}
const raporty = []

for (const numerFazy of stan.kolejka) {
  const faza = stan.fazy.find((f) => f.numer === numerFazy)
  phase(`Faza ${numerFazy}`)

  // Resume: faza ukonczona z nierozwiazanymi P1/P2 -> zacznij od fix, pomijajac execute (naprawia Bug 1).
  const rozpocznijOdFix = faza.ukonczona && faza.reviewIstnieje && faza.maNierozwiazaneP1P2

  if (!rozpocznijOdFix && !faza.ukonczona) {
    const exec = await workflow('dev-docs-execute-wf', { sciezka, faza: numerFazy })
    if (!exec || exec.status !== 'completed') {
      return { status: 'STOP', powod: `execute fazy ${numerFazy} zwrocil "${exec ? exec.status : 'null'}"`, faza: numerFazy, exec, raporty }
    }
    log(`Faza ${numerFazy}: Execute OK (${exec.iu.length} IU)`)
  }

  // Petla Review -> (adversarial verify w pod-workflowie) -> Fix
  let fixCykl = 0
  let lastReview = null
  let poprzednieFindingi = null // null = swiezy review; lista = re-review (Poprawka 1)
  while (true) {
    const review = await workflow('dev-docs-review-wf', { sciezka, faza: numerFazy, poprzednieFindingi })
    lastReview = review
    const { p1, p2 } = review.liczniki
    const operator = review.liczniki.operator || 0
    log(`Review fazy ${numerFazy}: P1=${p1} P2=${p2} P3=${review.liczniki.p3} OPERATOR=${operator} (gate: ${review.severityGate})`)

    if (p1 === 0 && p2 === 0) break // czyste / same P3 / same OPERATOR (te nie blokuja — ida do operator-checklist)

    if (fixCykl >= MAX_FIX_CYKLI) {
      if (p1 > 0) {
        return { status: 'STOP', powod: `Faza ${numerFazy}: ${p1}x P1 po ${MAX_FIX_CYKLI} cyklach — wymagana reczna interwencja`, faza: numerFazy, review, raporty }
      }
      // Same P2 -> graceful continuation
      await agent(gracefulP2Prompt(sciezka, numerFazy, review), { label: `graceful-p2:faza-${numerFazy}` })
      historia[numerFazy] = `${MAX_FIX_CYKLI} (graceful P2)`
      log(`Faza ${numerFazy}: GRACEFUL — ${p2}x P2 do known-issues, kontynuuje`)
      break
    }

    const fix = await agent(fixPrompt(sciezka, numerFazy, fixCykl + 1, MAX_FIX_CYKLI), {
      schema: FIX_RESULT,
      label: `fix:faza-${numerFazy}-cykl-${fixCykl + 1}`,
    })
    fixCykl++
    // Re-review weryfikuje TYLKO te findingi (P1/P2 typu KOD/TEST/E2E), nie skanuje fazy od zera.
    poprzednieFindingi = review.findings.filter((f) => (f.severity === 'P1' || f.severity === 'P2') && f.typ !== 'OPERATOR')
    log(`Fix fazy ${numerFazy} cykl ${fixCykl}: naprawiono ${fix.naprawione}, pozostaje ${fix.pozostaje}, walidacja ${fix.walidacja}`)
  }

  if (!(numerFazy in historia)) historia[numerFazy] = fixCykl
  raporty.push({ faza: numerFazy, gate: lastReview && lastReview.severityGate, cykle: historia[numerFazy] })
}

// ── Zakonczenie ──────────────────────────────────────────────────────────
phase('Zakonczenie')

const walidacja = await agent(finalValidationPrompt(sciezka), { schema: VALIDATION_RESULT, label: 'walidacja-koncowa' })
if (walidacja.wynik === 'FAIL') {
  return { status: 'STOP', powod: 'walidacja koncowa FAIL', walidacja, historia, raporty }
}

const complete = await workflow('dev-docs-complete-wf', { nazwaZadania: stan.nazwaZadania })
const compound = await workflow('dev-compound-wf', { sciezka })

return {
  status: 'OK',
  nazwaZadania: stan.nazwaZadania,
  fazyUkonczone: stan.kolejka.length,
  historia,
  raporty,
  walidacja,
  archiwum: complete && complete.archiwum,
  solution: compound && compound.plik,
  regula: compound && compound.regula,
}
