export const meta = {
  name: 'dev-docs-review-wf',
  description: 'Code review fazy: 6 reviewerow rownolegle (security/perf/architektura/typescript/spec-compliance/test/E2E) -> dedup -> adversarial verify kazdego P1/P2 (sceptycy obalaja) -> scribe zapisuje raport + bookkeeping checkboxow Weryfikacja: -> severity gate.',
  whenToUse: 'Review jednej fazy. Wolany przez dev-autopilot lub standalone z args {sciezka, faza}.',
  phases: [
    { title: 'Review', detail: '6 reviewerow rownolegle (w tym spec-compliance: zgodnosc ze spec/planem)' },
    { title: 'Verify', detail: 'adversarial verify per finding P1/P2' },
    { title: 'Zapis', detail: 'raport + bookkeeping + severity gate' },
  ],
}

// ── Schematy ──────────────────────────────────────────────────────────────

const FINDINGS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E', 'OPERATOR'], description: 'OPERATOR = weryfikacja niewykonalna headless (wymaga emulatora/eas build/deploy) — nie defekt kodu, nie idzie do fix' },
          plik: { type: 'string', description: 'plik:linia lub "?"' },
          opis: { type: 'string' },
        },
        required: ['severity', 'typ', 'plik', 'opis'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    realny: { type: 'boolean', description: 'czy finding jest prawdziwy po probie obalenia' },
    uzasadnienie: { type: 'string' },
    severityKorekta: { type: ['string', 'null'], enum: ['P1', 'P2', 'P3', null] },
  },
  required: ['realny', 'uzasadnienie'],
}

const REVIEW_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fazaNumer: { type: 'integer' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          severity: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E', 'OPERATOR'] },
          plik: { type: 'string' },
          opis: { type: 'string' },
        },
        required: ['severity', 'typ', 'plik', 'opis'],
      },
    },
    liczniki: {
      type: 'object',
      additionalProperties: false,
      properties: { p1: { type: 'integer' }, p2: { type: 'integer' }, p3: { type: 'integer' }, operator: { type: 'integer', description: 'findingi OPERATOR — poza fix, do operator-checklist' } },
      required: ['p1', 'p2', 'p3'],
    },
    severityGate: { type: 'string', enum: ['BLOKUJE', 'ZASTRZEZENIA', 'CZYSTE'] },
    e2e: {
      type: 'object',
      additionalProperties: false,
      properties: { passed: { type: 'integer' }, failed: { type: 'integer' }, skipped: { type: 'integer' } },
      required: ['passed', 'failed', 'skipped'],
    },
    raportSciezka: { type: 'string' },
  },
  required: ['fazaNumer', 'findings', 'liczniki', 'severityGate', 'raportSciezka'],
}

// ── Reviewerzy (leaf-agenci przez agentType) ───────────────────────────────

const REVIEWERZY = [
  { key: 'security', agentType: 'security-sentinel', fokus: 'auth, RLS policies, XSS, data exposure, Zod validation, API key exposure' },
  { key: 'performance', agentType: 'performance-oracle', fokus: 'N+1 queries, bundle size, lazy loading, memoization, useEffect cleanup' },
  { key: 'architecture', agentType: 'architecture-strategist', fokus: 'SOLID, wzorce, nazewnictwo, import organization, granice warstw' },
  { key: 'typescript', agentType: 'kieran-typescript-reviewer', fokus: 'type safety, brak any/as/!, discriminated unions, explicit return types' },
  { key: 'spec-compliance', agentType: 'spec-flow-analyzer', fokus: 'zgodnosc implementacji ze spec/planem IU: (a) wymagania ze spec/IU BRAKUJACE lub czesciowo zaimplementowane (under-implementation), (b) zachowanie w diffie o ktore nikt nie prosil (scope creep / over-implementation), (c) wymagania pozornie zaimplementowane ale BLEDNIE. Cytuj linie spec/IU (ID wymagania lub nazwa IU). Jesli brak spec ani planu — zwroc pusta liste findingow' },
]

// Blok doklejany w trybie re-review (po cyklu fix) — targetowana weryfikacja zamiast pelnego re-skanu.
function rereviewBlok(poprzednie) {
  if (!poprzednie || !poprzednie.length) return ''
  return `

=== TRYB RE-REVIEW (po cyklu fix) ===
To NIE jest swiezy review. Ponizej findingi z poprzedniego review tej fazy:
${JSON.stringify(poprzednie, null, 2)}

Twoje zadanie:
1. Dla KAZDEGO powyzszego findingu sprawdz w kodzie czy zostal naprawiony. Jesli NADAL otwarty -> zglos go ponownie (ten sam severity/typ).
2. Zglaszaj NOWY finding WYLACZNIE jesli to REGRESJA wprowadzona przez commit fix (cos co fix zepsul). NIE rob pelnego re-skanu calej fazy, NIE zglaszaj pre-existing problemow ktorych poprzedni review nie wykryl.
Cel: zweryfikowac skutecznosc napraw, nie wygenerowac nowa liste.`
}

function reviewerPrompt(sciezka, faza, fokus, poprzednie) {
  return `Jestes reviewerem fazy ${faza} w folderze ${sciezka}.
Przeczytaj zmiany git tej fazy (diff) + requirements doc (docs/dev-brainstorms/*-requirements.md jesli istnieje) + plan techniczny / Implementation Unit fazy ${faza} w docs/plans/ (Files:, Test scenarios:, Patterns to follow:).
Skup sie na: ${fokus}.
Sklasyfikuj kazdy finding: P1 (blocking), P2 (important), P3 (nit) oraz typ: KOD / TEST / E2E / OPERATOR.
Zwroc obiekt {findings:[...]} zgodny ze schematem. Sam nie zapisuj plikow.${rereviewBlok(poprzednie)}`
}

function testCoveragePrompt(sciezka, faza, poprzednie) {
  return `Jestes testerem scenariuszy/coverage dla fazy ${faza} w ${sciezka}.
Sprawdz: happy path, invalid inputs, boundary conditions, concurrent operations, scale.
Test coverage: czy plan techniczny (docs/plans/) definiowal scenariusze testowe dla tej fazy i czy pliki testowe
istnieja oraz maja asercje? Brakujace testy = P2 (typ TEST).
Zwroc {findings:[...]} (severity P1/P2/P3, typ KOD/TEST/E2E/OPERATOR). Nie zapisuj plikow.${rereviewBlok(poprzednie)}`
}

function e2ePrompt(sciezka, faza, poprzednie) {
  return `Jestes testerem E2E mobile (Maestro) dla fazy ${faza} w ${sciezka}.
Zbierz niezaznaczone checkboxy "Weryfikacja:" tej fazy dotyczace scenariuszy mobile
(launchApp, tapOn, assertVisible, takeScreenshot, deep linking, oznaczenie 📱). Pomin CLI i Manual.

NAJPIERW preflight srodowiska (Bash): czy jest booted emulator (xcrun simctl booted / adb devices)
i czy Metro UP (curl localhost:8081/status). Potem proba Maestro przez skill mobile-e2e-maestro.

KLASYFIKACJA per scenariusz (to jest krytyczne — nie wszystko jest P2):
- Scenariusz WYKONANY i FAILED z powodu defektu w kodzie/UI/stylu -> finding P2 typ E2E.
- Scenariusz NIEWYKONALNY headless (brak booted emulatora, Metro down, dev-client wymaga 'eas build',
  migracja/RPC niewdrozona na remote, brak seeded sesji) -> finding typ OPERATOR (severity P3).
  To NIE jest defekt kodu — to brakujacy warunek srodowiskowy. NIE klasyfikuj jako P2.
  W opisie podaj: tresc checkboxa + dokladny blocker + Operator action (kroki do odblokowania).
- Scenariusz WYKONANY i PASSED -> nie zglaszaj (scribe odznaczy w bookkeepingu).

Zwroc {findings:[...]}. Nie zapisuj plikow (scribe zrobi bookkeeping).${rereviewBlok(poprzednie)}`
}

function scribePrompt(sciezka, faza, potwierdzone) {
  return `Jestes scribe review fazy ${faza} w ${sciezka}. Otrzymujesz ZWERYFIKOWANE findings (po adversarial verify).

Findings (JSON):
${JSON.stringify(potwierdzone, null, 2)}

Referencja procedury: .claude/skills/dev-docs-review/SKILL.md sekcje 4, 4.5, 4.7.

1. Zapisz ${sciezka}/review-faza-${faza}.md — pelny raport (findings posortowane P1->P2->P3, statystyki).
2. Zaktualizuj ${sciezka}/*-zadania.md: dodaj/uzupelnij sekcje "## Do poprawy po review fazy ${faza}"
   — wylistuj TYLKO findingi typu KOD/TEST/E2E o severity P1 i P2 jako checkbox: "- [ ] 🔴/🟠 [severity] **plik:linia** — opis". P3 opcjonalnie.
   Findingi typu OPERATOR (niewykonalne headless) NIE ida tutaj — trafiaja do osobnej sekcji "## Operator checklist faza ${faza}"
   z trescia + krokami Operator action. To nie sa zadania do fix, tylko warunki srodowiskowe dla operatora.
3. Bookkeeping checkboxow "Weryfikacja:" (sekcja 4.7): re-parsuj niezaznaczone "Weryfikacja:" fazy ${faza},
   sklasyfikuj (CLI->uruchom przez Bash, exit0->[x]; Grep->uruchom; E2E Maestro wykonany->wg findings E2E;
   E2E niewykonalny headless->Operator checklist (typ OPERATOR, nie P2); Manual->zostaw z adnotacja; Niejasne->P3).
   Odznacz/anotuj w pliku zadan. Dopisz sekcje "Bookkeeping checkboxow Weryfikacja:" do raportu.
4. Policz liczniki: p1/p2/p3 (tylko KOD/TEST/E2E) oraz operator (osobno — findingi OPERATOR). P2 z bookkeepingu: CLI FAIL, Grep FAIL.
5. Ustaw severityGate: BLOKUJE (sa P1) / ZASTRZEZENIA (tylko P2) / CZYSTE (zero P1/P2 — sam P3/OPERATOR nie blokuje gate'u).
6. Policz e2e {passed, failed, skipped}.

Zwroc obiekt zgodny ze schematem ReviewResult (findings = finalna lista po bookkeepingu, z findingami OPERATOR wlacznie).`
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

const sciezka = args && args.sciezka
const faza = args && args.faza
// Poprawka 1: w re-review orkiestrator przekazuje findingi z poprzedniego cyklu -> targetowana weryfikacja.
const poprzednie = (args && args.poprzednieFindingi) || []
if (!sciezka || faza === undefined) {
  return { fazaNumer: -1, findings: [], liczniki: { p1: 0, p2: 0, p3: 0, operator: 0 }, severityGate: 'BLOKUJE', raportSciezka: '', e2e: { passed: 0, failed: 0, skipped: 0 } }
}

// Rozdziel poprzednie findingi po obszarze odpowiedzialnego agenta (pusta lista w trybie swiezego review).
const poprzKod = poprzednie.filter((f) => f.typ === 'KOD')
const poprzTest = poprzednie.filter((f) => f.typ === 'TEST')
const poprzE2e = poprzednie.filter((f) => f.typ === 'E2E' || f.typ === 'OPERATOR')

// Faza 1: 6 reviewerow rownolegle (bariera — potrzebujemy kompletu do dedup)
phase('Review')
const thunki = REVIEWERZY.map((r) => () =>
  agent(reviewerPrompt(sciezka, faza, r.fokus, poprzKod), { schema: FINDINGS, agentType: r.agentType, label: `review:${r.key}`, phase: 'Review' })
)
thunki.push(() => agent(testCoveragePrompt(sciezka, faza, poprzTest), { schema: FINDINGS, label: 'review:test-coverage', phase: 'Review' }))
thunki.push(() => agent(e2ePrompt(sciezka, faza, poprzE2e), { schema: FINDINGS, agentType: 'feature-tester-mobile-e2e', label: 'review:e2e', phase: 'Review' }))

const wyniki = await parallel(thunki)

// Dedup w JS (po pliku + poczatku opisu) — bariera byla potrzebna wlasnie tu
const wszystkie = wyniki.filter(Boolean).flatMap((w) => w.findings)
const widziane = new Set()
const dedup = []
for (const f of wszystkie) {
  const klucz = `${f.plik}|${f.opis.slice(0, 60).toLowerCase()}`
  if (widziane.has(klucz)) continue
  widziane.add(klucz)
  dedup.push(f)
}

// Faza 2: adversarial verify — tylko P1/P2 (P3/nity przechodza bez weryfikacji)
phase('Verify')
const doWeryfikacji = dedup.filter((f) => f.severity === 'P1' || f.severity === 'P2')
const nity = dedup.filter((f) => f.severity === 'P3')

const zweryfikowane = await parallel(
  doWeryfikacji.map((f) => () =>
    parallel(
      [0, 1, 2].map((i) => () =>
        agent(
          `Adwersaryjnie OBAL ten finding z review fazy ${faza} (${sciezka}). Domyslnie zakladaj ze finding jest NIEREALNY, chyba ze masz twardy dowod z kodu.\nFinding [${f.severity}/${f.typ}] ${f.plik}: ${f.opis}\nSprawdz kod. Czy to prawdziwy problem czy false positive? Zwroc werdykt.`,
          { schema: VERDICT, label: `verify:${f.plik}:${i}`, phase: 'Verify' }
        )
      )
    ).then((werdykty) => {
      const glosy = werdykty.filter(Boolean)
      const realne = glosy.filter((v) => v.realny).length
      // potwierdzony gdy wiekszosc sceptykow NIE zdolala obalic
      const potwierdzony = realne >= Math.ceil(glosy.length / 2)
      const korekta = glosy.map((v) => v.severityKorekta).filter(Boolean)
      return { ...f, potwierdzony, severity: korekta[0] || f.severity }
    })
  )
)

const potwierdzone = [
  ...zweryfikowane.filter(Boolean).filter((f) => f.potwierdzony).map(({ potwierdzony, ...f }) => f),
  ...nity,
]
log(`Verify: z ${doWeryfikacji.length} findingow P1/P2 potwierdzono ${potwierdzone.length - nity.length} (+ ${nity.length} nitow)`)

// Faza 3: scribe zapisuje raport + bookkeeping + liczy severity gate
phase('Zapis')
const wynik = await agent(scribePrompt(sciezka, faza, potwierdzone), { schema: REVIEW_RESULT, label: `scribe:faza-${faza}` })
return wynik
