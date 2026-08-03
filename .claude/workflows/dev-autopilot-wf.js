export const meta = {
  name: 'dev-autopilot-wf',
  description: 'Autonomiczny pipeline: bootstrap (stan z .autopilot-state.json) -> per faza (execute -> review+verify -> fix, bez re-review) -> compound -> compound-refresh (scoped) -> complete. Orkiestrator trzyma stan w JSON i liczy gate\'y w JS; buildery i reviewerzy to leaf-agenci.',
  whenToUse: 'Wykonanie calego planu zadania z docs/active/. Git zwaliduj w sesji PRZED odpaleniem (workflow nie pyta o branch switch). DWA tryby wznowienia: (1) po AWARII runu (crash/kill w polowie) -> Workflow({scriptPath, resumeFromRunId}) + ZAWSZE te same args (args nie przezywa miedzy wywolaniami) — cache journala odtworzy ukonczone kroki; (2) po STOP bramki (srodowisko E2E, fix FAIL, nierozwiazane P1, scribe) gdy operator COS NAPRAWIL -> SWIEZY run (nowe Workflow BEZ resumeFromRunId): resume zwrocilby porazke agenta bramkowego z cache zamiast sprawdzic naprawe, a stan faz i tak wznawia sie z docs/active/<zadanie>/.autopilot-state.json (zrodlo prawdy; checkboxy md to tylko widok). Reczne edycje .autopilot-state.json tez wymagaja swiezego runu.',
  phases: [
    { title: 'Bootstrap', detail: 'stan z .autopilot-state.json (lub pierwszy parse md) + srodowisko E2E (precheck opt-in -> env-up: auto-swap .env.local, Metro+emulator, canary login+launchApp jako DOWOD; TWARDY STOP gdy .env.e2e istnieje a canary nie przechodzi) + rozgrzewka cache testow' },
    { title: 'Zakonczenie', detail: 'walidacja koncowa -> compound -> compound-refresh (scoped: dotknieta kategoria + CONCEPTS.md, tylko gdy compound cos zapisal) -> complete (compound pierwszy: sciezki w docs/active/ jeszcze zyja) -> telemetria (1 linia JSONL do ~/.claude/telemetry/autopilot-runs.jsonl, best-effort)' },
  ],
}

// ── Architektura (audyt 2026-06-09) ──────────────────────────────────────
// Filar 1: BLOK_DLUGIE_KOMENDY — prawa srodowiska (watchdog ~180s, Bash max 600s) doklejane do
//          KAZDEGO prompta mogacego uruchamiac testy. Kopia tej stalej zyje tez w execute-wf
//          i review-wf (workflowy sa self-contained — przy zmianie synchronizuj recznie).
// Filar 2: stan maszynowy w docs/active/<zadanie>/.autopilot-state.json — resume czyta JSON,
//          nie liczy checkboxow. Orkiestrator liczy kolejke i przejscia w JS.
// Filar 3: trust-but-verify — gate'y liczone w JS z review.findings[], null-guardy po kazdym
//          await, warmup wymaga dowodu (kontrolny warm-run w sekundach).
// Re-review po fixie USUNIETY (decyzja usera, dane wf_3c9d3864); od 2026-07-12 gate P1 wzmocniony
// TARGETED VERIFY: kazdy P1/KOD z listy fixa dostaje 1 niezaleznego weryfikatora (tanszy substytut re-review).
// Mitygacja test-weakeningu: zakaz modyfikacji asercji w fixPrompt + git diff testow w walidacji.
// RESUME vs CACHE: resumeFromRunId odtwarza wyniki agentow z journala po prefiksie wywolan — sluzy
// TYLKO do wznowienia po awarii runu. Po STOP bramki srodowiskowej operator naprawia i odpala
// SWIEZY run (bez resume): prompty agentow bramkowych sa statyczne, wiec resume zwrociloby ich
// zcache'owana porazke. Poprawnosc wznowienia gwarantuje .autopilot-state.json, nie cache.

const BLOK_DLUGIE_KOMENDY = `
=== DLUGIE KOMENDY (przeczytaj ZANIM uruchomisz testy/buildy — prawa srodowiska, nie sugestie) ===
(1) Runtime zabija subagenta po ~180s bez zadnego outputu ("agent stalled"); po 6 killach pada CALY run.
(2) Pojedyncze foreground Bash ma limit 600s (domyslnie 120s) — dluzszej komendy NIE dokonczysz.
(3) Zimny vitest na komponentach RN (cache node_modules/.vite po inwalidacji) trwa do ~16 min i przez
    caly czas MILCZY — cisza to faza transform PRZED pierwszym outputem reportera; zaden reporter nie pomaga.
REGULY:
- Komenda mogaca trwac >100s (vitest po zmianie zaleznosci/configu, pelny suite, build): uruchom przez
  Bash z run_in_background i przekierowaniem do pliku logu, potem POLLUJ krotkim Bash co ~45-60s
  (tail loga / sprawdzenie procesu) az do zakonczenia. Kazda sonda = znak zycia dla watchdoga.
- NIGDY nie podnos timeoutu foreground zamiast isc w tlo — 180s ciszy zabija CIEBIE, nie komende.
- Po zmianie package.json / lockfile / vitest.config przez kogokolwiek w tym runie: pierwszy vitest
  traktuj jako ZIMNY (pelna procedura tla powyzej).
- vitest uruchamiaj z --reporter=dot: strumieniowany stdout W TRAKCIE foreground Bash resetuje watchdog
  (zweryfikowane empirycznie probe 2026-06-09), wiec chroni WARM suite'y w oknie 180-600s.
  NIE chroni: zimnego cache (transform milczy do konca) ani komend >600s (twardy limit Bash).
- FLAKE INFRA: gdy pelny suite zglosi na pliku blad infrastruktury workera ([vitest-worker]: Timeout
  calling "fetch", "Timeout calling", worker terminated, ENOMEM, heap out of memory) — re-runuj TEN plik
  w izolacji (procedura OSOBNO dla kazdego takiego pliku). PASS w izolacji = flake infra, NIE defekt:
  odnotuj "flake-infra: <plik> (PASS w izolacji)" i NIE traktuj jako FAIL. FAIL w izolacji = realny defekt.
  Po obsludze flake'ow DOKONCZ przerwany lancuch walidacji (kolejne kroki, np. expo-doctor).
=== KONIEC BLOKU DLUGICH KOMEND ===`

// ── Schematy ──────────────────────────────────────────────────────────────

const FINDING_OTWARTY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    severity: { type: 'string', enum: ['P1', 'P2'] },
    typ: { type: 'string', enum: ['KOD', 'TEST', 'E2E'] },
    plik: { type: 'string' },
    opis: { type: 'string' },
  },
  required: ['severity', 'typ', 'plik', 'opis'],
}

// Metryki fazy utrwalane w .autopilot-state.json (2026-07-26). Powod: telemetria ma dawac dane do
// strojenia progow (routing, dedup, sceptycy), a przy resume review sie NIE powtarza — bez utrwalenia
// wpis telemetrii mial null. Schemat MUSI istniec tu, bo stan przechodzi przez bootstrap-agenta
// (additionalProperties: false wymazalby nieznane pole przy pierwszym zapiszStan).
// Do stanu idzie SKROT (liczby do strojenia); pelny przebieg z flagami warstw zyje w raporcie review-faza-N.md.
const METRYKI_FAZY = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    liczniki: {
      type: 'object',
      additionalProperties: false,
      properties: { p1: { type: 'integer' }, p2: { type: 'integer' }, p3: { type: 'integer' }, operator: { type: 'integer' } },
      required: ['p1', 'p2', 'p3'],
    },
    przebieg: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        pominieci: { type: 'array', items: { type: 'string' }, description: 'keys reviewerow pominietych przez routing' },
        znalezione: { type: 'integer' },
        poDedupJs: { type: 'integer' },
        poDedupSem: { type: 'integer' },
        weryfikowane: { type: 'integer' },
        obalone: { type: 'integer' },
      },
      required: ['pominieci', 'znalezione', 'poDedupJs', 'poDedupSem', 'weryfikowane', 'obalone'],
    },
  },
  required: ['liczniki', 'przebieg'],
}

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
    zrodloStanu: { type: 'string', enum: ['state-json', 'pierwszy-parse-md'] },
    fazy: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          numer: { type: 'integer' },
          nazwa: { type: 'string' },
          execute: { type: 'string', enum: ['done', 'pending'] },
          review: { type: 'string', enum: ['done', 'pending'] },
          fix: { type: 'string', enum: ['done', 'pending', 'none'], description: 'none = review nie zostawil otwartych P1/P2' },
          otwarteFindingi: { type: 'array', items: FINDING_OTWARTY },
          metryki: METRYKI_FAZY,
        },
        required: ['numer', 'nazwa', 'execute', 'review', 'fix', 'otwarteFindingi'],
      },
    },
    zakonczenie: {
      type: 'object',
      additionalProperties: false,
      properties: {
        walidacja: { type: 'string', enum: ['done', 'pending'] },
        complete: { type: 'string', enum: ['done', 'pending'] },
        compound: { type: 'string', enum: ['done', 'pending'] },
      },
      required: ['walidacja', 'complete', 'compound'],
    },
    rozbieznosci: { type: 'array', items: { type: 'string' }, description: 'informacyjne: stan vs pliki md (np. review-faza-N.md istnieje a stan mowi pending)' },
  },
  required: ['nazwaZadania', 'branch', 'zrodloStanu', 'fazy', 'zakonczenie', 'rozbieznosci'],
}

const ZAPIS_STANU = {
  type: 'object',
  additionalProperties: false,
  properties: { zapisano: { type: 'boolean' } },
  required: ['zapisano'],
}

const WARMUP_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zbudowano', 'zbedne', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co odpalono + czasy, lub powod pominiecia/niepowodzenia' },
    czasZimnySek: { type: ['integer', 'null'], description: 'czas pierwszego (zimnego) biegu w sekundach' },
    czasKontrolnySek: { type: ['integer', 'null'], description: 'czas kontrolnego warm-runu w sekundach — DOWOD zbudowania cache' },
  },
  required: ['status', 'detal'],
}

// Precheck: TANI, deterministyczny sygnal opt-in (czy repo ma .env.e2e) — oddzielony od ciezkiego
// env-up, zeby flake ciezkiego agenta na projekcie opt-in NIE degradowal cicho E2E (patrz orkiestracja).
const E2E_PRECHECK = {
  type: 'object',
  additionalProperties: false,
  properties: {
    istnieje: { type: 'boolean', description: 'true = plik .env.e2e istnieje w korzeniu repo (projekt opt-in E2E)' },
  },
  required: ['istnieje'],
}

const E2E_ENV_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['gotowe', 'pominieto', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co postawiono / powod pominiecia lub niepowodzenia (BEZ wartosci sekretow)' },
    platforma: { type: 'string', enum: ['ios', 'android', 'brak'], description: 'na ktorej platformie postawiono emulator (canary lecial na niej)' },
    metro: { type: 'string', enum: ['uruchomione', 'zastane', 'brak'] },
    simulator: { type: 'string', enum: ['gotowy', 'brak'] },
    swap: { type: 'string', enum: ['brak', 'wykonany', 'zastany', 'utworzony', 'niepotrzebny'], description: 'stan swapu .env.local -> e2e: wykonany (backup zrobiony), zastany (.env.local.bak juz byl), utworzony (.env.local nie istnial, stworzony z e2e), niepotrzebny (.env.local juz na e2e bez .bak), brak (nie dotyczy)' },
    canary: { type: 'string', enum: ['pass', 'fail', 'pominiety'], description: 'wynik canary: login konta e2e (REST) + launchApp na emulatorze przez Maestro — DOWOD ze flow ruszy' },
  },
  required: ['status', 'detal', 'platforma', 'metro', 'simulator', 'swap', 'canary'],
}

const E2E_DB_SYNC_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['zsynchronizowano', 'aktualna', 'niepowodzenie'] },
    detal: { type: 'string', description: 'co zaaplikowano (migracje/seedy/konto) lub tresc bledu — blad SQL migracji to potencjalny DEFEKT KODU' },
  },
  required: ['status', 'detal'],
}

const E2E_DOWN_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    posprzatano: { type: 'boolean' },
    detal: { type: 'string' },
    swapCofniety: { type: 'string', enum: ['tak', 'nie-dotyczy', 'blad'], description: 'czy rollback .env.local (z .bak) lub usuniecie utworzonego .env.local sie powiodl' },
  },
  required: ['posprzatano', 'detal'],
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
    nierozwiazaneP1: { type: 'integer', description: 'P1 ktorych fix NIE zamknal (krytyczne -> STOP)' },
    nierozwiazaneP2: { type: 'integer', description: 'P2 przeniesione do known-issues (graceful)' },
    // Guard plikow binarnych (run team-os-onboarding-instalatory, 2026-07-26, repo web): fix wpisal do
    // scripts/inbox/invite.mjs regex z SUROWYMI bajtami sterujacymi zamiast sekwencji \x.. — plik
    // przestal byc tekstem (git: "Bin 9804 -> 15506 bytes") i KAZDY kolejny agent padal na jego Read
    // (APIError), 6 prob z rzedu, run martwy po 2h47min. W required, bo pusta lista MUSI znaczyc
    // "sprawdzilem i czysto"; pole opcjonalne = agent moze pominac sprawdzenie i cicho wylaczyc guard.
    plikiBinarne: {
      type: 'array',
      items: { type: 'string' },
      description: 'pliki zmienione w tej fazie, ktore git widzi jako binarne (numstat "-"), a NIE sa legalnymi binariami — typowa przyczyna: surowe bajty sterujace w pliku zrodlowym',
    },
  },
  required: ['naprawione', 'pozostaje', 'walidacja', 'nierozwiazaneP1', 'nierozwiazaneP2', 'plikiBinarne'],
}

const POSTFIX_VERDICT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nadalOtwarty: { type: 'boolean', description: 'true = problem wciaz istnieje w kodzie lub naprawa jest pozorna' },
    uzasadnienie: { type: 'string' },
  },
  required: ['nadalOtwarty', 'uzasadnienie'],
}

const VALIDATION_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    wykryteKomendy: { type: 'array', items: { type: 'string' } },
    typecheck: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    lint: { type: 'string', enum: ['PASS', 'FAIL', 'SKIPPED'] },
    testy: { type: 'string', description: 'PASS/FAIL z liczbami X/Y (+ adnotacje flake-infra)' },
    expoDoctor: { type: 'string', enum: ['PASS', 'FAIL', 'n/a'] },
    testyZmodyfikowane: { type: 'array', items: { type: 'string' }, description: 'pliki *.test.* ze ZMIENIONYMI istniejacymi asercjami w commitach fix(...) — sygnal test-weakeningu' },
    e2eNieuruchomione: { type: 'array', items: { type: 'string' }, description: 'tresci checkboxow [E2E] wciaz NIEZAZNACZONYCH przy istniejacym .env.e2e (opt-in E2E) — wymusza wynik=FAIL (completion-gate)' },
    wynik: { type: 'string', enum: ['PASS', 'FAIL'] },
    bledy: { type: 'array', items: { type: 'string' } },
  },
  required: ['wynik'],
}

// ── Prompty leaf-agentow ──────────────────────────────────────────────────

function bootstrapPrompt(sciezka) {
  return `Jestes bootstrapem pipeline'u dev-autopilot. Zbuduj jawny stan orkiestratora.

Folder zadania: ${sciezka}

1. GIT: uruchom \`git branch --show-current\` i \`git status --short\`.
   Przeczytaj wymagany branch z dokumentacji w ${sciezka}/ (szukaj "Branch:").
   Ustaw branch.zgodny (aktualny == wymagany lub wymagany == null) oraz branch.czysty (pusty status).

2. STAN — najpierw sprawdz czy istnieje ${sciezka}/.autopilot-state.json:

   A) PLIK ISTNIEJE (resume): przeczytaj go i zwroc jego fazy/zakonczenie BEZ reinterpretacji
      checkboxow md — plik stanu jest ZRODLEM PRAWDY, checkboxy to tylko widok dla czlowieka.
      Pole "metryki" fazy (jesli obecne) PRZEPISZ 1:1 — nie licz go sam, nie uzupelniaj, nie zeruj;
      to zapis telemetrii z runu, w ktorym review sie odbylo. Gdy pola nie ma, pomin je (null).
      zrodloStanu = "state-json". Dodatkowo porownaj informacyjnie z plikami (np. istnieje
      ${sciezka}/review-faza-N.md a stan mowi review=pending) i wpisz różnice do rozbieznosci[]
      (NIE koryguj stanu samodzielnie).

   B) PLIKU NIE MA (pierwszy run): zbuduj stan z plikow, zrodloStanu = "pierwszy-parse-md":
      - ${sciezka}/*-plan.md -> lista faz [(numer, nazwa)].
      - ${sciezka}/*-zadania.md -> per faza execute:
        execute = "done" gdy wszystkie checkboxy fazy sa [x], LICZAC WYLACZNIE checkboxy
        implementacyjne. POMIN CALKOWICIE: checkboxy z prefiksem "Weryfikacja:", "Operator:",
        oznaczone "[E2E]" lub "[Manual]", ORAZ wszystkie checkboxy w sekcjach
        "## Do poprawy po review fazy N" i "## Operator checklist faza N" (te sekcje obsluguje
        review/fix, nie execute). Dowolny INNY [ ] => execute = "pending".
      - review = "done" gdy istnieje ${sciezka}/review-faza-{numer}.md, inaczej "pending".
        UWAGA: faza z execute="done" i review="pending" to NORMALNY stan po awarii — taka faza
        MUSI miec review (nie pomijaj jej).
      - sekcja "## Do poprawy po review fazy {numer}" w zadaniach: niezaznaczone checkboxy P1/P2
        -> sparsuj kazdy do otwarteFindingi (severity z [P1]/[P2], typ KOD/TEST/E2E z kontekstu,
        plik i opis z tresci linii) i ustaw fix = "pending". Wszystkie zaznaczone lub sekcji brak
        przy review="done" -> fix = "done" lub "none" (none gdy sekcji nigdy nie bylo).
        Gdy review="pending" -> fix = "pending" tylko jesli sa otwarte findingi, inaczej "none"
        (review je ustali).

3. zakonczenie: przy pierwszym parse ustaw walidacja/complete/compound = "pending"
   (chyba ze zadanie jest juz w docs/completed/ — wtedy "done").
4. nazwaZadania = ostatni segment sciezki ${sciezka}.

Zwroc obiekt zgodny ze schematem. Nie modyfikuj zadnych plikow — to read-only bootstrap.`
}

function zapiszStanPrompt(sciezka, trescJson) {
  return `Zapisz plik stanu pipeline'u dev-autopilot. Uzyj narzedzia Write (pelne nadpisanie pliku).

Sciezka: ${sciezka}/.autopilot-state.json
Tresc — zapisz DOKLADNIE ponizszy JSON, bez zadnych zmian, dopiskow ani komentarzy:

${trescJson}

Nie modyfikuj ZADNYCH innych plikow. Zwroc {zapisano:true}.`
}

function warmupPrompt(sciezka) {
  return `Jestes rozgrzewka cache testowego pipeline'u dev-autopilot (folder zadania: ${sciezka}).
CEL: zbudowac cache transformacji vitest (node_modules/.vite / optimizeDeps) PRZED fazami implementacji,
zeby zaden pozniejszy agent nie trafil na zimny ~16-minutowy bieg.
${BLOK_DLUGIE_KOMENDY}

1. Wykryj runner: przeczytaj package.json. Rozgrzewka dotyczy WYLACZNIE vitest. Brak vitest
   (inny runner lub brak testow) -> zwroc {status:"zbedne", detal:"<powod>"} i ZAKONCZ.
2. Wybierz JEDEN test komponentu z najciezszym setupem: szukaj *.test.tsx importujacego
   komponenty React Native (components/, app/, features/, src/ — transform react-native ->
   react-native-web jest najdrozszy). Jesli W CALYM repo nie ma zadnego testu komponentu
   (projekt greenfield): utworz TYMCZASOWY plik .autopilot-warmup.test.tsx w katalogu testowym
   projektu z trywialnym renderem <View><Text>warmup</Text></View> i 1 asercja — to JEDYNY
   wyjatek od zakazu modyfikacji plikow; USUN go w kroku 5.
3. BIEG ZIMNY — OBOWIAZKOWO przez tlo (komenda moze trwac ~16 min, foreground NIE dokonczy):
   uruchom \`<pm> vitest run <plik> --reporter=dot > /tmp/autopilot-warmup.log 2>&1\` przez Bash
   z run_in_background (pm z lockfile: bun.lockb->bunx, pnpm->pnpm, yarn->yarn, npm->npx).
   POLLUJ co ~45-60s: \`tail -5 /tmp/autopilot-warmup.log\` + sprawdzenie czy proces zyje.
   Czekaj do zakonczenia (budzet ~25 min). Zanotuj laczny czas jako czasZimnySek.
   WYNIK testu (pass/fail asercji) jest NIEISTOTNY — liczy sie ukonczenie procesu (= zapis cache).
4. DOWOD — bieg kontrolny foreground: uruchom TEN SAM test zwyklym Bash (timeout 120s wystarczy).
   Zanotuj czas jako czasKontrolnySek. Cache zbudowany = czas rzedu SEKUND.
   czasKontrolnySek < 60 -> status "zbudowano". Wiecej lub timeout -> status "niepowodzenie"
   (cache NIE dziala — nie raportuj sukcesu ktorego nie ma).
5. Sprzatanie: usun /tmp/autopilot-warmup.log i ewentualny tymczasowy test z kroku 2.

Poza wyjatkiem z kroku 2 NIE modyfikuj zadnych plikow. Zwroc {status, detal, czasZimnySek, czasKontrolnySek}.`
}

function e2ePrecheckPrompt() {
  return `Jestes precheck-agentem E2E pipeline'u dev-autopilot. JEDNO zadanie: ustal czy projekt jest opt-in E2E.
Uruchom \`test -f "$(git rev-parse --show-toplevel)/.env.e2e" && echo TAK || echo NIE\`.
Zwroc {istnieje: true} gdy wynik to TAK, {istnieje: false} gdy NIE. Nic wiecej nie rob, nie czytaj zawartosci pliku.`
}

function e2eEnvUpPrompt() {
  return `Jestes agentem srodowiska E2E pipeline'u dev-autopilot. Twoim zadaniem jest postawic srodowisko testow
Maestro (Metro + emulator z dev clientem, baza = DEDYKOWANY projekt Supabase e2e z .env.e2e, NIGDY dev/prod)
i UDOWODNIC canary'm, ze flow realnie ruszy — zeby reviewer E2E i fix wykonaly scenariusze zamiast klasyfikowac
je jako OPERATOR. Status "gotowe" jest ZAKAZANY dopoki canary nie przejdzie. NIGDY nie loguj wartosci z .env.e2e.
${BLOK_DLUGIE_KOMENDY}

0. SELF-SKIP: jesli w korzeniu repo NIE ma pliku .env.e2e -> zwroc
   {status:"pominieto", detal:"brak .env.e2e — E2E w trybie OPERATOR (setup: .claude/templates/e2e-env/README.md)",
    platforma:"brak", metro:"brak", simulator:"brak", swap:"brak", canary:"pominiety"} i ZAKONCZ.

1. BEZPIECZENSTWO (twarde — kazdy blad = status "niepowodzenie"):
   a) \`git check-ignore -q .env.e2e\` — exit != 0 (plik NIE jest gitignorowany) -> niepowodzenie,
      detal:"dopisz .env.e2e do .gitignore — plik zawiera sekrety".
   a2) \`git check-ignore -q .env.local.bak\` — exit != 0 -> niepowodzenie, detal:"dopisz .env.local.bak
      do .gitignore (one-time, jak .env.e2e) — backup swapu zawiera sekrety dev, a nieignorowany zablokowalby
      nastepny run na bramce czystosci brancha (bootstrap STOP 'niezacommitowane zmiany')".
   b) Wymagane klucze w .env.e2e: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_E2E_DB_URL,
      SUPABASE_E2E_SERVICE_ROLE_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD. Brak -> niepowodzenie z LISTA NAZW brakow.
   c) GUARD TOZSAMOSCI: EXPO_PUBLIC_SUPABASE_URL z .env.e2e musi byc ROZNY od URL-a DEV. Zrodlo URL-a dev:
      \`.env.local.bak\` jesli istnieje (= aktywny swap, .env.local trzyma teraz e2e), inaczej \`.env.local\`, inaczej \`.env\`.
      Identyczny e2e==dev = to nie dedykowany projekt e2e -> niepowodzenie (ochrona bazy dev/prod).

2. AUTO-SWAP .env.local -> e2e (zautomatyzowane — env-up WOLNO modyfikowac .env.local, bo env-down cofnie):
   Dev-client inline'uje EXPO_PUBLIC_* z PLIKU \`.env.local\` przy starcie Metro; \`source .env.e2e\` tego NIE
   repointuje (lekcja etap-12b: falszywe "gotowe" na .env.local celujacym w dev). Ustal stan i zadzialaj:
   - Jesli \`.env.local.bak\` ISTNIEJE -> swap juz aktywny z wczesniejszego runu/crasha. Zweryfikuj ze EXPO_PUBLIC_SUPABASE_URL
     w \`.env.local\` == e2e; jesli tak -> swap:"zastany", kontynuuj. Jesli NIE -> niepowodzenie (niespojny stan: .bak
     istnieje ale .env.local nie na e2e; operator musi recznie rozstrzygnac).
   - Inaczej jesli \`.env.local\` ISTNIEJE i jego EXPO_PUBLIC_SUPABASE_URL != e2e -> WYKONAJ swap:
     \`cp .env.local .env.local.bak\` (backup), potem nadpisz w \`.env.local\` WSZYSTKIE klucze EXPO_PUBLIC_* wartosciami
     z .env.e2e (tylko te klucze; reszty .env.local nie ruszaj). swap:"wykonany". Po swapie Metro MUSI wstac na nowo (krok 4).
   - Inaczej jesli \`.env.local\` ISTNIEJE i juz == e2e (bez .bak) -> swap:"niepotrzebny", kontynuuj.
   - Inaczej (\`.env.local\` NIE istnieje) -> stworz \`.env.local\` z kluczami EXPO_PUBLIC_* z .env.e2e; ZWERYFIKUJ
     \`git check-ignore -q .env.local\` (typowy .gitignore Expo ma \`.env*.local\`) — nieignorowany -> usun go i zwroc
     niepowodzenie (inaczej brudzi working tree). swap:"utworzony" (env-down USUNIE ten plik, nie bedzie .bak do przywrocenia).

3. NARZEDZIA (preflight — brak = niepowodzenie z instrukcja, nie probuj dalej):
   a) \`maestro --version\` — brak Maestro CLI -> niepowodzenie, detal:"zainstaluj Maestro: curl -fsSL https://get.maestro.mobile.dev | bash".
   b) \`java -version\` — Maestro wymaga Java 17+; brak lub <17 -> niepowodzenie, detal:"zainstaluj Java 17+ (JAVA_HOME) — wymog Maestro 2.0+".

4. METRO (deterministycznie — koniec ruletki "zastanego Metro"):
   \`curl -s localhost:8081/status\`.
   - Odpowiada I proces na porcie NALEZY DO NAS — zweryfikuj TOZSAMOSC, nie samo istnienie pliku .pid:
     \`lsof -ti:8081\` musi zawierac \`cat /tmp/autopilot-metro.pid\` (plik .pid przezywa smierc procesu; na porcie
     moze juz siedziec CUDZE Metro na dev — dokladnie klasa false-greena, ktora eliminujemy) — I swap w kroku 2 byl
     "zastany"/"niepotrzebny" (nie zmienialismy env w tym runie) -> metro:"zastane", uzyj.
   - W KAZDYM innym przypadku gdy Metro odpowiada (pid z portu != nasz .pid, brak .pid, ALBO swap "wykonany"/"utworzony")
     -> RESTART: zwolnij port \`lsof -ti:8081 | xargs kill 2>/dev/null\` (usun tez stary /tmp/autopilot-metro.pid), potem jak nizej.
     Powod: nie ufamy env-owi procesu, ktorego nie wstartowalismy PO swapie — bundle dev-clienta inline'uje env z momentu startu Metro.
   - Metro nie odpowiada (lub po zwolnieniu portu) -> uruchom DETACHED z env e2e (pm z lockfile: bun.lockb->bun, pnpm->pnpm, yarn->yarn, npm->npm):
     \`set -a; source .env.e2e; set +a; nohup <pm> start --clear > /tmp/autopilot-metro.log 2>&1 & echo $! > /tmp/autopilot-metro.pid\`
     (npm przekazuje flagi po \`--\`: \`npm start -- --clear\`; bun/pnpm/yarn przyjmuja wprost).
     Polluj \`curl -s localhost:8081/status\` co ~10s (max ~120s). Sukces -> metro:"uruchomione", timeout -> niepowodzenie (+ tail -20 logu).

5. EMULATOR (iOS-first, z fallbackiem Android — canary poleci na wybranej platformie):
   a) iOS: \`xcrun simctl list devices booted\` — jest booted iPhone -> platforma:"ios". Pusto: sprobuj bootnac
      (\`xcrun simctl list devices available\` + \`xcrun simctl boot <udid>\`, odpytuj status). Dev client:
      bundle id z app.json/app.config.* -> \`xcrun simctl listapps booted | grep <bundleId>\`. Jest -> simulator:"gotowy", platforma:"ios".
   b) Gdy iOS niedostepny (brak Xcode/simctl) ALBO brak dev-clienta iOS: Android: \`adb devices\` — jest device/emulator online
      -> platforma:"android"; dev client: \`adb shell pm list packages | grep <appId>\`. Jest -> simulator:"gotowy", platforma:"android".
   c) Zaden emulator z dev-clientem (ani iOS ani Android) -> niepowodzenie, simulator:"brak", detal:"zainstaluj dev client (one-time):
      iOS: bunx expo run:ios ; Android: bunx expo run:android (zostaw emulator BOOTED z zainstalowanym dev-clientem przed wznowieniem)".

6. CANARY (DOWOD ze flow ruszy — bez tego "gotowe" jest ZAKAZANE; to naprawia luke "komponenty OK, ale nikt nie przeszedl calego toru"):
   a) LOGIN konta e2e (REST, tanie, bez emulatora): password-grant na backend e2e:
      \`curl -s -X POST "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"
      -H "Content-Type: application/json" -d '{"email":"'"$E2E_TEST_EMAIL"'","password":"'"$E2E_TEST_PASSWORD"'"}'\`
      (zmienne z \`set -a; source .env.e2e; set +a\`). Odpowiedz zawiera access_token -> login OK (potwierdza: URL+anon key dzialaja,
      konto e2e istnieje i haslo pasuje). Brak access_token / blad -> canary:"fail", niepowodzenie, detal z kodem/komunikatem
      (typowo: konto nie istnieje -> db-sync je tworzy per faza, ale login MUSI dzialac zanim uznamy srodowisko za gotowe;
      jesli konto jeszcze nie istnieje, utworz je teraz POST /auth/v1/admin/users z SUPABASE_E2E_SERVICE_ROLE_KEY, email_confirm:true, i powtorz login).
   b) LAUNCH aplikacji (Maestro na wybranej platformie): stworz TYMCZASOWY flow \`/tmp/autopilot-canary.yaml\`
      (POZA repo — osierocony plik w working tree blokowalby nastepny run na bramce czystosci brancha):
      linia 1 \`appId: <bundleId/appId z app.json>\`, potem \`---\`, \`- launchApp\`, \`- takeScreenshot: /tmp/autopilot-canary\`
      (sciezka ABSOLUTNA — relatywna wyladowalaby w cwd, czyli w repo).
      Uruchom \`maestro test /tmp/autopilot-canary.yaml\` (iOS: doda sie automatycznie booted sim; Android: booted emulator).
      Exit 0 -> dev-client bootuje i gada z Metro (bundle sie serwuje) -> canary:"pass". Exit != 0 -> canary:"fail",
      niepowodzenie (+ ostatnie linie outputu Maestro w detal). Na koncu usun /tmp/autopilot-canary.yaml i /tmp/autopilot-canary.png (pass czy fail).

7. status "gotowe" TYLKO gdy: bezpieczenstwo OK (1) I swap rozstrzygniety (2) I narzedzia OK (3) I Metro odpowiada wstale
   z env e2e (4) I emulator gotowy z dev-clientem (5) I canary:"pass" (6a login + 6b launch). Inaczej "niepowodzenie".
   W polu detal streszcz co postawiono (platforma, swap, canary) BEZ wartosci sekretow.`
}

function e2eDbSyncPrompt(sciezka, numerFazy) {
  return `Jestes agentem synchronizacji bazy e2e pipeline'u dev-autopilot (zadanie: ${sciezka}, faza ${numerFazy}).
Cel: dedykowany projekt Supabase e2e ma miec migracje i seedy tej fazy PRZED testami Maestro.
Ten projekt WOLNO modyfikowac autonomicznie — to nie jest baza dev/prod (guard tozsamosci zrobil env-up).
NIGDY nie loguj wartosci sekretow z .env.e2e.
${BLOK_DLUGIE_KOMENDY}

1. Wczytaj SUPABASE_E2E_DB_URL i SUPABASE_E2E_SERVICE_ROLE_KEY z .env.e2e (do uzycia, nie do logu).
2. MIGRACJE — realny apply: \`supabase db push --db-url "$SUPABASE_E2E_DB_URL" --include-all\`
   (non-interactive: dodaj --yes jesli CLI wspiera, inaczej \`echo Y |\`). To pierwsza PRAWDZIWA
   weryfikacja SQL migracji w pipeline (testy migracji w repo to regex na pliku). Blad SQL ->
   status "niepowodzenie" z pelna trescia bledu w detal — to moze byc DEFEKT KODU migracji, nie infra.
3. SEED: znajdz seedy powiazane z flow tej fazy — pliki *-seed.sql w .maestro/ (powiazanie po nazwie
   flow z checkboxow "Weryfikacja:" fazy ${numerFazy} w ${sciezka}/*-zadania.md). Aplikuj kazdy:
   \`psql "$SUPABASE_E2E_DB_URL" -f <plik>\` (brak psql -> sprobuj \`supabase db query\` lub odnotuj
   w detal). Bledy duplikatow przy nieidempotentnym seedzie odnotuj, nie failuj.
4. KONTO TESTOWE: sprawdz czy user E2E_TEST_EMAIL istnieje (GET /auth/v1/admin/users przez
   service_role). Brak -> utworz (POST /auth/v1/admin/users, email_confirm:true, haslo E2E_TEST_PASSWORD).

Zwroc {status, detal}: "zsynchronizowano" (cos zaaplikowano), "aktualna" (nic do zrobienia),
"niepowodzenie" (+ co dokladnie padlo).`
}

function e2eEnvDownPrompt(swap) {
  return `Sprzatanie srodowiska E2E dev-autopilot. Zabij WYLACZNIE procesy uruchomione przez pipeline i cofnij swap env.

1. METRO: jesli istnieje /tmp/autopilot-metro.pid -> zabij TYLKO gdy tozsamosc sie zgadza:
   \`lsof -ti:8081\` zawiera \`cat /tmp/autopilot-metro.pid\` -> \`kill $(cat /tmp/autopilot-metro.pid)\`.
   PID z pliku nieobecny na porcie = proces juz nie zyje albo PID zostal przetworzony przez system —
   NIE zabijaj na slepo (recykling PID moglby trafic cudzy proces). W obu przypadkach usun
   /tmp/autopilot-metro.pid i /tmp/autopilot-metro.log.
   Metro "zastane" (pid z portu != nasz .pid) zostaw w spokoju — nie nalezy do nas.
2. EMULATORA NIE wylaczaj (tani w utrzymaniu, drogi w boot).
3. COFNIJ SWAP .env.local (env-up zglosil swap:"${swap}"):
   - "wykonany" lub "zastany" -> przywroc oryginal: \`mv -f .env.local.bak .env.local\` (jesli .bak istnieje).
     Potem ASSERT: EXPO_PUBLIC_SUPABASE_URL w .env.local NIE moze byc rowny wartosci e2e (czyli wrocil dev) — jesli
     nadal e2e, to rollback sie nie udal: swapCofniety:"blad", zaznacz w detal (operator musi recznie przywrocic .env.local z .bak).
   - "utworzony" -> usun plik ktory stworzylismy: \`rm -f .env.local\` (nie bylo oryginalu do przywrocenia).
   - "niepotrzebny" / "brak" / puste -> swapCofniety:"nie-dotyczy", nic nie ruszaj.
   Sukces rollbacku -> swapCofniety:"tak".
Zwroc {posprzatano, detal, swapCofniety}. Nie loguj wartosci sekretow.`
}

function fixPrompt(sciezka, numerFazy, otwarteFindingi) {
  return `Jestes czescia pipeline'u dev-autopilot. Naprawiasz problemy z review fazy ${numerFazy}.
WAZNE: to JEDYNY przebieg fix tej fazy — po nim NIE ma ponownego review. Twoj raport jest
OSTATECZNYM zrodlem prawdy o stanie findingow, wiec klasyfikuj uczciwie czego nie zamknales.

Folder zadania: ${sciezka}
Numer fazy: ${numerFazy}

OTWARTE FINDINGI DO NAPRAWY (lista autorytatywna — przekazana przez orkiestratora):
${JSON.stringify(otwarteFindingi, null, 2)}

Pelny kontekst kazdego findingu: ${sciezka}/review-faza-${numerFazy}.md.
Checkboxy w sekcji "Do poprawy po review fazy ${numerFazy}" w ${sciezka}/*-zadania.md odznaczaj
w miare napraw (to widok dla czlowieka).

Napraw WSZYSTKIE z listy (sa to P1 blocking i P2 important; P3 nie ma na liscie).

KLASYFIKUJ kazdy finding przed naprawa:
- Typ KOD (blad implementacji/security/perf/architektury): napraw kod -> uruchom unit testy -> odznacz checkbox.
- Typ TEST (brakujacy test): NIE ruszaj kodu produkcyjnego, napisz test (min 1 asercja, nie assertion-free)
  zgodnie z planem w docs/plans/ -> uruchom -> odznacz.
- Typ E2E (weryfikacja E2E): napraw przyczyne -> re-uruchom Maestro na emulatorze
  (.maestro/<flow>.yaml, exit 0 + assertVisible) -> odznacz DOPIERO po PASS (nie na "naprawilem kod").

ZAKAZ TEST-WEAKENINGU (twardy): NIE modyfikuj istniejacych testow ani asercji zeby przeszly —
napraw IMPLEMENTACJE. Mozesz testy DODAWAC. Oslabienie/usuniecie asercji = niedopuszczalne;
walidacja koncowa audytuje git diff testow w commitach fix i zglosi kazda taka zmiane.

Kolejnosc: KOD -> TEST -> E2E. Po naprawach: pelna walidacja (typecheck, test, expo-doctor —
komendy z package.json; NIE eas build), commit \`fix([nazwa]): poprawki po review fazy ${numerFazy}\`,
staguj tylko zmienione pliki.
${BLOK_DLUGIE_KOMENDY}

GUARD PLIKOW BINARNYCH (po naprawach i commicie, ZANIM zwrocisz wynik — obowiazkowy):
zakres = commity fix tej fazy, ktore wlasnie utworzyles (te same, ktore raportujesz w commity[];
znajdziesz je tak jak walidacja koncowa: \`git log --oneline --grep="^fix("\`) —
uruchom \`git diff --numstat <pierwszy-commit-fixa>^..HEAD\`; gdy nic nie zacommitowales: \`git diff --numstat HEAD\`.
Plik, ktory git widzi jako binarny, ma w numstat "-" zamiast liczb dodanych/usunietych linii.
Do plikiBinarne[] wpisz KAZDY taki plik POZA legalnymi binariami (.png .jpg .jpeg .gif .webp .avif
.ico .bmp, .woff .woff2 .ttf .otf, .pdf .zip .gz .mp4 .mp3, bun.lockb) — plik zrodlowy lub tekstowy
na tej liscie to AWARIA pipeline'u, nie znalezisko.
POWOD (run team-os-onboarding-instalatory, 2026-07-26, repo web): fix zapisal do scripts/inbox/invite.mjs regex
z SUROWYMI bajtami sterujacymi (literalne U+0000, U+001F, U+007F) zamiast sekwencji ucieczki
\\x00-\\x1f\\x7f-\\x9f. Plik przestal byc tekstem, a kazdy kolejny agent rozlaczal sie przy jego Read
(APIError) — 6 prob z rzedu i caly run byl martwy. Zapisujac regexy/stringi z bajtami sterujacymi
uzywaj WYLACZNIE sekwencji ucieczki.
NIE probuj naprawiac takiego pliku w tym przebiegu — jego Read zabije rowniez CIEBIE. Zwroc go na liscie.
Gdy nic nie znalazles, zwroc pusta liste (pole jest obowiazkowe: brak listy = orkiestrator nie wie, czy sprawdziles).

KNOWN-ISSUES (graceful — bez osobnego agenta): jesli ZOSTAJA P2 ktorych NIE udalo sie naprawic
(a zero nierozwiazanych P1), zapisz je do ${sciezka}/known-issues.md. Dedup: jesli sekcja
"## Faza ${numerFazy}" juz istnieje — ZASTAP jej cala tresc (od naglowka do nastepnego "## " lub konca pliku),
NIE dopisuj duplikatu. Format: "## Faza ${numerFazy}\\nPozostaje N problemow P2 po fixie. Review: review-faza-${numerFazy}.md\\n- 🟠 [P2] plik — opis".
Po zapisie upewnij sie ze jest DOKLADNIE jeden naglowek "## Faza ${numerFazy}".

Dzialaj autonomicznie, nie pytaj usera. Zwroc obiekt FixResult — KRYTYCZNE pola (orkiestrator gate'uje
z nich, bez re-review): nierozwiazaneP1 (P1 ktorych NIE zamknales -> orkiestrator zrobi STOP),
nierozwiazaneP2 (P2 przeniesione do known-issues), walidacja (PASS/FAIL pelnej walidacji),
plikiBinarne (pliki zrodlowe, ktore przestaly byc tekstem -> orkiestrator zrobi STOP).`
}

function postFixVerifyPrompt(sciezka, numerFazy, finding) {
  return `Jestes NIEZALEZNYM weryfikatorem naprawy po cyklu fix fazy ${numerFazy} (zadanie: ${sciezka}).
Agent fix zadeklarowal, ze ponizszy finding P1 zostal naprawiony. NIE ufaj deklaracji — sprawdz KOD.

FINDING [${finding.severity}/${finding.typ}] ${finding.plik}:
${finding.opis}

1. Przeczytaj aktualny stan pliku ${finding.plik} (i powiazanych) oraz commit(y) fix tej fazy
   (git log --oneline --grep="^fix(" + git show odpowiedniego commita).
2. Ocen MERYTORYCZNIE: czy naprawa adresuje PRZYCZYNE findingu, czy tylko objaw / czy jest pozorna
   (np. wyciszenie, obejscie, zmiana nieistotnego fragmentu).
3. Kontekst findingu: ${sciezka}/review-faza-${numerFazy}.md (jesli istnieje).

Zwroc {nadalOtwarty, uzasadnienie}. nadalOtwarty=true gdy problem wciaz istnieje lub naprawa jest pozorna.
Read-only — nie modyfikuj plikow.`
}

function finalValidationPrompt(sciezka) {
  return `Wykonaj pelna walidacje calego projektu po autopilocie (folder zadania: ${sciezka}).
${BLOK_DLUGIE_KOMENDY}

KROK 1 — odkryj komendy (NIE zgaduj): przeczytaj package.json scripts (typecheck/lint/test/check),
wykryj package manager (bun.lockb->bun, pnpm-lock->pnpm, yarn.lock->yarn, package-lock->npm).
Brak skryptu typecheck -> sprobuj tsc --noEmit jesli jest tsconfig.json. Stack Expo: zamiast build uzyj
\`bunx expo-doctor\` (NIE eas build). Makefile/pyproject/Cargo — uzyj wlasciwych narzedzi.

KROK 2 — uruchom w kolejnosci: typecheck -> lint (jesli jest) -> test (pelny suite, wg BLOKU
DLUGICH KOMEND: tlo + polling; flake infra obsluz wg procedury z bloku i DOKONCZ lancuch) -> expo-doctor.
Zatrzymaj sie dopiero na REALNYM FAIL (flake infra PASS-w-izolacji nie jest FAIL).

KROK 3 — AUDYT TESTOW PO FIXACH: \`git log --oneline --grep="^fix(" \` dla commitow fix tego zadania,
potem \`git diff <zakres>\` zawezony do plikow *.test.* — szukaj ZMIAN W ISTNIEJACYCH asercjach/testach
(usuniecie testu, oslabienie expect, zmiana oczekiwanej wartosci). Nowe testy sa OK. Kazda modyfikacje
istniejacego testu wpisz do testyZmodyfikowane[] (to sygnal test-weakeningu do raportu, nie auto-FAIL).

KROK 4 — jesli REALNY FAIL i potrafisz naprawic prosty problem (import, typ) — napraw, commituj,
uruchom ponownie. Jak nie potrafisz — zwroc liste bledow z lokalizacjami i wynik=FAIL.

KROK 5 — COMPLETION-GATE E2E (krytyczny — chroni przed cichym zamknieciem sprintu z pominietym E2E):
Sprawdz czy w korzeniu repo istnieje \`.env.e2e\` (\`test -f "$(git rev-parse --show-toplevel)/.env.e2e"\`).
- BRAK .env.e2e -> projekt nie opt-inowal E2E, pomin ten krok.
- ISTNIEJE .env.e2e -> grepnij zadanie: \`grep -nE '^- \\[ \\].*\\[E2E\\]' ${sciezka}/*-zadania.md\`.
  Jesli zostaly NIEZAZNACZONE checkboxy [E2E] -> wpisz ich tresci do e2eNieuruchomione[] i ustaw wynik=FAIL,
  bledy[] += "E2E opt-in (.env.e2e istnieje), a N scenariuszy [E2E] nieuruchomionych — sprint NIE moze sie
  zamknac z cicho pominietym E2E (regresja etap-11/12b). Operator musi je odpalic LUB usunac .env.e2e dla
  swiadomego runu headless." NIE probuj sam odpalac Maestro — to gate raportujacy, blokuje archiwizacje.

Zwroc obiekt zgodny ze schematem ValidationResult.`
}

// ── Helpery orkiestratora (deterministycznie, w JS) ───────────────────────

// Filar 3: liczniki i gate liczone z findings[], nie z self-reportu scribe'a.
function policzFindingi(findings) {
  const istotne = (findings || []).filter((f) => f.typ !== 'OPERATOR')
  return {
    p1: istotne.filter((f) => f.severity === 'P1').length,
    p2: istotne.filter((f) => f.severity === 'P2').length,
    p3: istotne.filter((f) => f.severity === 'P3').length,
    operator: (findings || []).length - istotne.length,
  }
}

function otwartePoReview(findings) {
  return (findings || [])
    .filter((f) => f.typ !== 'OPERATOR' && (f.severity === 'P1' || f.severity === 'P2'))
    .map((f) => ({ severity: f.severity, typ: f.typ, plik: f.plik, opis: f.opis }))
}

// ── Orkiestracja ──────────────────────────────────────────────────────────

// Sanityzacja args — UI wstrzykuje prefix '@' (mention) i czesto trailing '/'.
const sciezkaRaw = typeof args === 'string' ? args : args && args.sciezka
const sciezka = sciezkaRaw && sciezkaRaw.replace(/^@/, '').replace(/\/+$/, '')
if (!sciezka) {
  return {
    status: 'STOP',
    powod: 'brak sciezki zadania. Przy starcie: args:"docs/active/<zadanie>". Przy RESUME (scriptPath+resumeFromRunId): przekaz args PONOWNIE — nie przenosi sie z poprzedniego runu.',
  }
}

const tokSpent = () => (typeof budget !== 'undefined' && budget && budget.spent ? budget.spent() : 0)

phase('Bootstrap')
const stan = await agent(bootstrapPrompt(sciezka), { schema: PLAN_STATE, label: 'bootstrap' })
if (!stan) {
  return { status: 'STOP', powod: 'bootstrap nie zwrocil stanu (agent null)' }
}

// Decyzja A: git zwalidowany w sesji przed odpaleniem; tu tylko bezpiecznik.
if (!stan.branch.zgodny) {
  return { status: 'STOP', powod: `branch mismatch: jestes na "${stan.branch.aktualny}", wymagany "${stan.branch.wymagany}"`, stan }
}
if (!stan.branch.czysty) {
  return { status: 'STOP', powod: 'niezacommitowane zmiany — zacommituj/stash przed autopilotem (po awarii runu: NAJPIERW git status, kod faz zwykle JEST na dysku)', stan }
}
for (const r of stan.rozbieznosci || []) log(`Bootstrap rozbieznosc (informacyjna): ${r}`)

// Filar 2: kolejka liczona w JS ze stanu — zero interpretacji LLM.
const kolejka = stan.fazy
  .filter((f) => f.execute === 'pending' || f.review === 'pending' || f.fix === 'pending')
  .map((f) => f.numer)

log(`Autopilot: ${stan.nazwaZadania} (stan: ${stan.zrodloStanu}) — fazy do wykonania: ${kolejka.join(', ') || 'brak'}`)

// Utrwalanie stanu: tresc liczona w JS, zapis przez tani leaf-agent (haiku). Best-effort z ostrzezeniem.
async function zapiszStan() {
  const tresc = JSON.stringify(
    { wersja: 1, zadanie: stan.nazwaZadania, fazy: stan.fazy, zakonczenie: stan.zakonczenie },
    null,
    2
  )
  const w = await agent(zapiszStanPrompt(sciezka, tresc), { schema: ZAPIS_STANU, label: 'stan:zapis', model: 'haiku' })
  if (!w || !w.zapisano) log('OSTRZEZENIE: zapis .autopilot-state.json nie powiodl sie — resume bedzie polegac na parse md')
}

// Srodowisko E2E PRZED warmupem: tani gate (precheck + wczesne checki env-up) zatrzymuje run
// zanim zaplacimy za rozgrzewke cache. Metro hot-reloaduje working tree, wiec stawiamy raz per run.
//
// BRAMKA OPT-IN (2026-06-16, regresja etap-11): status decyduje czy run leci dalej.
//   'pominieto'     = brak .env.e2e -> projekt nie chce E2E -> cicha degradacja do OPERATOR (status quo).
//   'niepowodzenie' = .env.e2e ISTNIEJE, ale srodowisko nie gotowe LUB canary nie przeszedl
//                     -> HARD STOP w bootstrapie, PRZED jakakolwiek faza (E2E nie znika cicho do OPERATOR).
//   'gotowe'        = Metro + emulator z dev-clientem + canary PASS -> E2E aktywne (DOWIEDZIONE, nie zadeklarowane).
//
// PRECHECK: tani, deterministyczny sygnal opt-in ODDZIELONY od ciezkiego env-up. Bez niego flake env-up
// (null) na projekcie opt-in degradowalby cicho E2E — a completion-gate wylapalby to dopiero na KONCU runu
// (najdrozszy moment). Z precheckiem: opt-in potwierdzony -> null env-up = STOP, nie degradacja.
const precheck = await agent(e2ePrecheckPrompt(), { schema: E2E_PRECHECK, label: 'e2e:precheck', model: 'haiku', phase: 'Bootstrap' })
const optIn = precheck ? precheck.istnieje : null // null = precheck padl (nie wiemy — env-up ma self-skip)

let e2eEnv = null
if (optIn !== false) {
  // Opt-in TAK lub nieznany -> odpal env-up (ma wlasny self-skip gdy .env.e2e faktycznie nie ma).
  e2eEnv = await agent(e2eEnvUpPrompt(), { schema: E2E_ENV_RESULT, label: 'e2e:env-up', phase: 'Bootstrap' })
  if (!e2eEnv && optIn === true) {
    // Opt-in POTWIERDZONY przez precheck, a ciezki env-up padl -> jeden retry (infra hiccup bywa przejsciowy).
    log('E2E env-up: agent zwrocil null przy potwierdzonym .env.e2e — retry raz')
    e2eEnv = await agent(e2eEnvUpPrompt(), { schema: E2E_ENV_RESULT, label: 'e2e:env-up:retry', phase: 'Bootstrap' })
    if (!e2eEnv) {
      // Drugi null przy potwierdzonym opt-in -> STOP (nie degraduj cicho, jak przy 'niepowodzenie').
      return {
        status: 'STOP',
        powod: 'E2E env-up zwrocil null 2x przy istniejacym .env.e2e (projekt opt-in E2E) — nie degraduje cicho do OPERATOR. To infra/agent hiccup, nie brak setupu.',
        naprawa: 'Sprawdz srodowisko (Metro/emulator/Maestro) i odpal SWIEZY run (te same args, BEZ resumeFromRunId).',
        stan,
      }
    }
  }
}
log(`E2E env: ${e2eEnv ? `${e2eEnv.status} (platforma: ${e2eEnv.platforma}, metro: ${e2eEnv.metro}, emulator: ${e2eEnv.simulator}, swap: ${e2eEnv.swap}, canary: ${e2eEnv.canary}) — ${e2eEnv.detal}` : `pomijam E2E (${optIn === false ? 'brak .env.e2e — projekt nie opt-in' : 'precheck padl i env-up null — infra'})`}`)
if (e2eEnv && e2eEnv.status === 'niepowodzenie') {
  return {
    status: 'STOP',
    powod: `Srodowisko E2E nie gotowe, a .env.e2e istnieje (projekt wymaga E2E): ${e2eEnv.detal}`,
    naprawa: 'Setup: .claude/templates/e2e-env/README.md. Najczestsze braki: dev-client na emulatorze (`bunx expo run:ios`/`run:android`, zostaw emulator BOOTED przed wznowieniem), Maestro CLI/Java 17+, albo canary login (konto E2E_TEST_EMAIL / anon key). Opt-out swiadomego runu headless: usun/zmien nazwe .env.e2e. Po setupie odpal SWIEZY run (te same args, BEZ resumeFromRunId — resume zwrociloby zcache\'owana porazke env-up; stan faz wznowi sie z .autopilot-state.json).',
    e2eEnv,
    stan,
  }
}
const e2eAktywne = !!e2eEnv && e2eEnv.status === 'gotowe'
// Stan swapu .env.local do przekazania env-down (rollback). Domyslnie 'brak' gdy E2E nieaktywne.
const e2eSwap = (e2eEnv && e2eEnv.swap) || 'brak'

// Filar 1: rozgrzewka cache vitest — PO bramce E2E (tani gate first). Self-skip gdy brak vitest; warm = sekundy.
// Chroni tez walidacje koncowa przy pustej kolejce (np. resume po ukonczonych fazach na zimnej maszynie).
const warmup = await agent(warmupPrompt(sciezka), { schema: WARMUP_RESULT, label: 'warmup:vitest', phase: 'Bootstrap' })
if (!warmup) {
  return { status: 'STOP', powod: 'rozgrzewka nie zwrocila wyniku (agent null)', stan }
}
log(`Rozgrzewka: ${warmup.status} — ${warmup.detal} (zimny: ${warmup.czasZimnySek ?? 'n/a'}s, kontrolny: ${warmup.czasKontrolnySek ?? 'n/a'}s)`)
// Warmup to OPTYMALIZACJA, nie warunek poprawnosci — 'niepowodzenie' degraduje z ostrzezeniem,
// nie zatrzymuje runu (prog <60s kontrolnego biegu jest maszyno-zalezny; na wolnym sprzecie
// poprawny cache potrafi go przekroczyc). Agenci faz i tak maja BLOK_DLUGIE_KOMENDY (tlo+polling).
if (warmup.status === 'niepowodzenie') {
  log(`OSTRZEZENIE: rozgrzewka cache niepotwierdzona (${warmup.detal}) — kontynuuje; agenci faz musza scisle stosowac procedure tla dla zimnych biegow`)
}

const historia = {}
const raporty = []
const tokRunStart = tokSpent()

// Normalizacja metryk przebiegu do SKROTU (schemat METRYKI_FAZY + telemetria): review-wf zwraca
// pelny obiekt (pominieci = [{key,powod}]), a stan po resume trzyma juz skrot (pominieci = ['key']).
// Jedna funkcja, zeby stan i telemetria mialy IDENTYCZNY kształt niezaleznie od zrodla.
function skrotPrzebiegu(p) {
  if (!p) return null
  return {
    pominieci: (p.pominieci || []).map((x) => (typeof x === 'string' ? x : x.key)),
    znalezione: p.znalezione,
    poDedupJs: p.poDedupJs,
    poDedupSem: p.poDedupSem,
    weryfikowane: p.weryfikowane,
    obalone: p.obalone,
  }
}

for (const numerFazy of kolejka) {
  const faza = stan.fazy.find((f) => f.numer === numerFazy)
  if (!faza) {
    return { status: 'STOP', powod: `kolejka zawiera faze ${numerFazy} nieobecna w fazy[] — niespojny stan bootstrapu`, raporty }
  }
  phase(`Faza ${numerFazy}`)
  const tokFazaStart = tokSpent()
  let gateFazy = 'CZYSTE'
  let cykle = 0
  let e2eSync = null
  // Metryki fazy: przy resume review moze byc juz 'done' i review-wf sie NIE odpali — wtedy liczniki
  // i przebieg czytamy z faza.metryki utrwalonych w stanie (bez tego telemetria dostawala null).
  const metrykiZeStanu = faza.metryki || {}
  let licznikiFazy = metrykiZeStanu.liczniki || null
  let przebiegFazy = metrykiZeStanu.przebieg || null
  let fixInfo = null
  // Atrybucja tokenow per etap: "faza = 298k" nie mowi, czy placimy za buildery, czy za reviewerow,
  // wiec kazdy etap ma wlasny akumulator. null (a NIE 0) = etapu w tym runie nie bylo (przy resume byl
  // juz 'done'); 0 = wykonal sie i nic nie kosztowal. Dopisujemy delte na KONCU bloku etapu — sciezki
  // STOP wracaja przed raporty.push, wiec ich pomiar i tak nie ma gdzie trafic.
  const tokEtapy = { execute: null, review: null, fix: null }
  // += zamiast =, bo etap moze wykonac sie wielokrotnie (cykle fixa) — wtedy koszt ma sie SUMOWAC.
  const dopiszEtap = (etap, start) => { tokEtapy[etap] = (tokEtapy[etap] || 0) + (tokSpent() - start) }

  // 1) EXECUTE — tylko gdy pending (resume nigdy nie powtarza ukonczonego execute, w tym migracji).
  if (faza.execute === 'pending') {
    const tokEtapStart = tokSpent()
    const exec = await workflow('dev-docs-execute-wf', { sciezka, faza: numerFazy })
    if (!exec || exec.status !== 'completed') {
      return { status: 'STOP', powod: `execute fazy ${numerFazy} zwrocil "${exec ? exec.status : 'null'}"${exec && exec.problem ? `: ${exec.problem}` : ''}`, faza: numerFazy, exec, raporty }
    }
    faza.execute = 'done'
    await zapiszStan()
    log(`Faza ${numerFazy}: Execute OK (${exec.iu.length} IU)`)
    dopiszEtap('execute', tokEtapStart)
  }

  // 2) REVIEW — tylko gdy pending. Faza ukonczona z otwartymi findingami idzie PROSTO do fix (Bug 1).
  if (faza.review === 'pending') {
    // Etap "review" obejmuje e2e db-sync + review-wf (reviewerzy, dedup, adversarial verify) — to jeden
    // blok warunkowy i jeden wywolywany workflow, wiec i jedna pozycja w atrybucji.
    const tokEtapStart = tokSpent()
    // Sync bazy e2e per faza PO execute (migracje fazy powstaja w execute, db push jest
    // przyrostowy — brak nowych migracji = no-op). Niepowodzenie nie blokuje review:
    // tester E2E trafi na brak danych i sklasyfikuje OPERATOR, a detal (np. blad SQL
    // migracji = potencjalny defekt kodu!) zostaje w logu i raporcie fazy dla operatora.
    if (e2eAktywne) {
      e2eSync = await agent(e2eDbSyncPrompt(sciezka, numerFazy), { schema: E2E_DB_SYNC_RESULT, label: `e2e:db-sync:faza-${numerFazy}` })
      log(`E2E db-sync fazy ${numerFazy}: ${e2eSync ? `${e2eSync.status} — ${e2eSync.detal}` : 'agent zwrocil null'}`)
    }
    const review = await workflow('dev-docs-review-wf', {
      sciezka,
      faza: numerFazy,
      poprzednieFindingi: faza.otwarteFindingi.length ? faza.otwarteFindingi : null,
    })
    if (!review) {
      return { status: 'STOP', powod: `review fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty }
    }
    // Scribe padl 2x: raport review-faza-N.md i sekcja "Do poprawy" NIE powstaly. Nie oznaczamy
    // review=done (utrwalone done nigdy juz nie odtworzy raportu) — STOP; kolejny run powtorzy review.
    if (review.scribeFail) {
      await zapiszStan()
      return {
        status: 'STOP',
        powod: `Faza ${numerFazy}: scribe padl 2x — findingi zweryfikowane (P1/P2 w wyniku), ale raport review-faza-${numerFazy}.md nie zostal zapisany. Review pozostaje pending; odpal SWIEZY run (reviewerzy odpala sie ponownie).`,
        faza: numerFazy, findings: review.findings, raporty,
      }
    }
    // Filar 3: liczniki/gate w JS z findings[]; liczniki scribe'a tylko do porownania w logu.
    const liczniki = policzFindingi(review.findings)
    const scribeL = review.liczniki || {}
    if (scribeL.p1 !== liczniki.p1 || scribeL.p2 !== liczniki.p2) {
      log(`Faza ${numerFazy}: NIESPOJNOSC licznikow scribe (p1=${scribeL.p1},p2=${scribeL.p2}) vs JS (p1=${liczniki.p1},p2=${liczniki.p2}) — uzywam JS`)
    }
    log(`Review fazy ${numerFazy}: P1=${liczniki.p1} P2=${liczniki.p2} P3=${liczniki.p3} OPERATOR=${liczniki.operator}`)
    licznikiFazy = liczniki
    przebiegFazy = review.przebieg || null
    if (przebiegFazy) {
      const skrot = skrotPrzebiegu(przebiegFazy)
      const pom = skrot.pominieci.length ? skrot.pominieci.join(',') : 'brak'
      log(`Routing fazy ${numerFazy}: pominieci=${pom}; findingi ${przebiegFazy.znalezione}->${przebiegFazy.poDedupSem} po dedupie, obalone ${przebiegFazy.obalone}/${przebiegFazy.weryfikowane}`)
    }
    faza.review = 'done'
    // Metryki utrwalone w stanie — zrodlo dla telemetrii po resume (review sie wtedy nie powtarza).
    // Skrot zgodny z METRYKI_FAZY: same liczby do strojenia progow. Pelny przebieg (flagi warstw,
    // lista aktywnych) zostaje w raporcie review-faza-N.md, zeby nie puchl plik stanu.
    faza.metryki = { liczniki, przebieg: skrotPrzebiegu(przebiegFazy) }
    faza.otwarteFindingi = otwartePoReview(review.findings)
    faza.fix = faza.otwarteFindingi.length ? 'pending' : 'none'
    await zapiszStan()
    dopiszEtap('review', tokEtapStart)
  }

  // 3) FIX — bez re-review; gate z self-reportu + lista findingow przekazana wprost (md tylko jako widok).
  if (faza.fix === 'pending') {
    // Etap "fix" obejmuje agenta fixa I targeted verify P1/KOD — verify jest czescia tego samego bloku
    // warunkowego (bramka gate'u fixa), wiec jego koszt nalezy do fixa, nie do review.
    const tokEtapStart = tokSpent()
    const fix = await agent(fixPrompt(sciezka, numerFazy, faza.otwarteFindingi), { schema: FIX_RESULT, label: `fix:faza-${numerFazy}` })
    if (!fix) {
      return { status: 'STOP', powod: `fix fazy ${numerFazy} zwrocil null`, faza: numerFazy, raporty }
    }
    cykle = 1
    log(`Fix fazy ${numerFazy}: naprawiono ${fix.naprawione}, nierozwiazane P1=${fix.nierozwiazaneP1} P2=${fix.nierozwiazaneP2}, walidacja ${fix.walidacja}`)
    fixInfo = { naprawione: fix.naprawione, nierozwiazaneP2: fix.nierozwiazaneP2 }

    // Guard plikow binarnych PRZED gate'em walidacji: uszkodzony plik zrodlowy jest PRZYCZYNA,
    // a typecheck/testy failuja wtornie — na "walidacja FAIL" operator szuka defektu logiki zamiast
    // uszkodzonego pliku. Run team-os-onboarding-instalatory (2026-07-26, repo web): surowe bajty sterujace
    // wpisane do scripts/inbox/invite.mjs zabily 6 kolejnych agentow na Read (APIError) i caly run.
    // Semantyka jak w sasiednich STOP-ach: fix zostaje 'pending', wiec swiezy run wraca wprost do fixa.
    const plikiBinarne = fix.plikiBinarne || []
    if (plikiBinarne.length) {
      await zapiszStan()
      return {
        status: 'STOP',
        powod: `Faza ${numerFazy}: po fixie git widzi jako BINARNE pliki, ktore powinny byc tekstem: ${plikiBinarne.join(', ')}. Najprawdopodobniej wpisano do nich SUROWE bajty sterujace zamiast sekwencji ucieczki (np. literalny U+001F zamiast \\x1f w regexie). Kazdy kolejny agent, ktory zrobi Read takiego pliku, rozlaczy sie na APIError — pipeline bedzie umieral w kolko, dopoki plik nie zostanie naprawiony.`,
        naprawa: `Napraw ${plikiBinarne.join(', ')} POZA pipelinem i NIE otwieraj ich Readem (to samo rozlaczenie dotyczy kazdej sesji): albo cofnij zmiane (\`git checkout <commit-sprzed-fixa> -- <plik>\`), albo przepisz plik od nowa z sekwencjami ucieczki (\\x00-\\x1f\\x7f-\\x9f zamiast literalnych bajtow). Potwierdz \`file <plik>\` = "... text" i \`git diff --numstat\` = liczby zamiast "-", zacommituj, potem odpal SWIEZY run (te same args, BEZ resumeFromRunId).`,
        faza: numerFazy, fix, plikiBinarne, raporty,
      }
    }

    if (fix.walidacja === 'FAIL' || fix.nierozwiazaneP1 > 0) {
      // Stan NIE oznacza fix=done — resume wroci wprost do fixa z ta sama lista.
      await zapiszStan()
      return {
        status: 'STOP',
        powod: fix.nierozwiazaneP1 > 0
          ? `Faza ${numerFazy}: ${fix.nierozwiazaneP1}x P1 nierozwiazane po fixie — wymagana reczna interwencja`
          : `Faza ${numerFazy}: walidacja fixa FAIL — wymagana reczna interwencja`,
        naprawa: 'Po recznej naprawie odpal SWIEZY run (te same args, BEZ resumeFromRunId) — stan wroci wprost do tej fazy z .autopilot-state.json; resume odtworzyloby zcache\'owany FAIL fixa.',
        faza: numerFazy, fix, raporty,
      }
    }

    // TARGETED VERIFY po fixie (tanszy substytut usunietego re-review): kazdy P1 typu KOD
    // z listy przekazanej fixowi dostaje 1 niezaleznego weryfikatora. Gate P1 wraca do werdyktu
    // obiektywnego zamiast wylacznie self-reportu fixa (anty-patterny #2/#7: pozorna naprawa).
    // P1 typu TEST/E2E pomijamy: TEST lapie walidacja (testy musza przejsc), E2E zweryfikowal fix na emulatorze.
    const p1Kod = faza.otwarteFindingi.filter((f) => f.severity === 'P1' && f.typ === 'KOD')
    if (p1Kod.length) {
      const werdykty = await parallel(
        p1Kod.map((f) => () =>
          agent(postFixVerifyPrompt(sciezka, numerFazy, f), { schema: POSTFIX_VERDICT, label: `verify-fix:${f.plik}` })
        )
      )
      // null (weryfikator padl) nie blokuje — infra hiccup to nie dowod zlej naprawy; logujemy.
      const nadalOtwarte = p1Kod.filter((f, i) => werdykty[i] && werdykty[i].nadalOtwarty)
      werdykty.forEach((w, i) => { if (!w) log(`verify-fix: brak werdyktu dla P1 ${p1Kod[i].plik} (agent null) — przepuszczam z ostrzezeniem`) })
      if (nadalOtwarte.length) {
        // Zawez liste do realnie otwartych — kolejny run wraca wprost do fixa z ta zawezona lista.
        faza.otwarteFindingi = nadalOtwarte.map((f, i) => ({ ...f, opis: `[NIEZAMKNIETY po fixie] ${f.opis}` }))
        await zapiszStan()
        return {
          status: 'STOP',
          powod: `Faza ${numerFazy}: niezalezna weryfikacja wykryla ${nadalOtwarte.length}x P1 NADAL otwarte po fixie (self-report fixa mowil "naprawione") — wymagana reczna interwencja. Po naprawie odpal SWIEZY run.`,
          faza: numerFazy, fix, nadalOtwarte, raporty,
        }
      }
      log(`Faza ${numerFazy}: targeted verify — wszystkie ${p1Kod.length}x P1/KOD potwierdzone jako zamkniete`)
    }

    gateFazy = fix.nierozwiazaneP2 > 0 ? 'ZASTRZEZENIA' : 'CZYSTE'
    if (fix.nierozwiazaneP2 > 0) {
      cykle = '1 (graceful P2)'
      log(`Faza ${numerFazy}: GRACEFUL — ${fix.nierozwiazaneP2}x P2 do known-issues, kontynuuje`)
    }
    faza.fix = 'done'
    faza.otwarteFindingi = []
    await zapiszStan()
    dopiszEtap('fix', tokEtapStart)
  } else if (faza.fix === 'none') {
    gateFazy = 'CZYSTE'
  }

  historia[numerFazy] = cykle
  const tokFazy = Math.round((tokSpent() - tokFazaStart) / 1000)
  // Delta 0 po resume = agenci fazy wrocili z journala (cache), nie "darmowa faza" — oznacz w raporcie.
  const tokFazyOpis = tokFazy === 0 ? '0k (z cache — resume)' : `${tokFazy}k`
  // null przechodzi przez zaokraglenie jako null — inaczej etap nieobecny w runie zlalby sie z etapem
  // darmowym (0k) i cala atrybucja przestalaby cokolwiek rozstrzygac.
  const naK = (v) => (v === null ? null : Math.round(v / 1000))
  const tokenyEtapy = { execute: naK(tokEtapy.execute), review: naK(tokEtapy.review), fix: naK(tokEtapy.fix) }
  const opisEtapow = ['execute', 'review', 'fix'].map((e) => `${e} ${tokenyEtapy[e] === null ? 'n/a' : `${tokenyEtapy[e]}k`}`).join(', ')
  log(`Faza ${numerFazy}: koniec — gate ${gateFazy}, cykle ${cykle}, ~${tokFazyOpis} tokenow (${opisEtapow})`)
  // przebieg = metryki routingu/dedupu/verify (z review-wf albo ze stanu po resume) — dane do
  // strojenia progow: kogo routing pomija, ile dedup sklei, ile verify obala.
  raporty.push({ faza: numerFazy, gate: gateFazy, cykle, tokeny: tokFazyOpis, tokenyEtapy, liczniki: licznikiFazy, fix: fixInfo, e2eSync: e2eSync ? `${e2eSync.status}: ${e2eSync.detal}` : 'n/a', przebieg: skrotPrzebiegu(przebiegFazy) })
}

// ── Zakonczenie ──────────────────────────────────────────────────────────
phase('Zakonczenie')

if (stan.zakonczenie.walidacja === 'pending') {
  const walidacja = await agent(finalValidationPrompt(sciezka), { schema: VALIDATION_RESULT, label: 'walidacja-koncowa' })
  if (!walidacja) {
    return { status: 'STOP', powod: 'walidacja koncowa zwrocila null', historia, raporty }
  }
  if (walidacja.testyZmodyfikowane && walidacja.testyZmodyfikowane.length) {
    log(`UWAGA test-weakening: fix zmodyfikowal istniejace testy: ${walidacja.testyZmodyfikowane.join(', ')}`)
  }
  if (walidacja.wynik === 'FAIL') {
    return { status: 'STOP', powod: 'walidacja koncowa FAIL', walidacja, historia, raporty }
  }
  stan.zakonczenie.walidacja = 'done'
  stan.walidacjaWynik = walidacja
  await zapiszStan()
}

// Teardown E2E dopiero PO walidacji i tylko na sciezce sukcesu — kazdy wczesniejszy STOP
// celowo zostawia Metro/emulator zywe (operator debuguje na gotowym srodowisku; nasz .pid
// pozwala nastepnemu runowi przejac lub ubic proces). Swap .env.local przetrwaly po STOP jest
// bezpieczny: .env.local.bak zostaje, a nastepny env-up wykryje "swap zastany" i cofnie go na koncu.
if (e2eAktywne) {
  const down = await agent(e2eEnvDownPrompt(e2eSwap), { schema: E2E_DOWN_RESULT, label: 'e2e:env-down', model: 'haiku' })
  log(`E2E env-down: ${down ? `${down.posprzatano ? 'OK' : 'pominieto'} (swap cofniety: ${down.swapCofniety || 'n/a'}) — ${down.detal}` : 'agent zwrocil null'}`)
  if (down && down.swapCofniety === 'blad') {
    log('OSTRZEZENIE: rollback swapu .env.local NIE powiodl sie — sprawdz recznie (przywroc .env.local z .env.local.bak). .env.local moze wciaz celowac w e2e.')
  }
}

// Compound PRZED complete: dokumentuje solutions gdy sciezki w docs/active/ jeszcze zyja.
// Complete (archiwizacja, przenosi folder) jest OSTATNI — po nim juz NIE zapisujemy stanu
// (plik wedruje do archiwum razem z folderem; zapis wskrzesilby pusty katalog w active/).
// Stempel complete:"done" w zarchiwizowanym pliku stawia sam complete-wf (krok 5 jego prompta).
const REFRESH_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    przejrzano: { type: 'number', description: 'liczba dokumentow w waskim scope' },
    akcje: { type: 'array', items: { type: 'string' }, description: 'wykonane akcje (Keep/Update/Replace/Archive/dedup CONCEPTS)' },
    slownik: { type: 'string', enum: ['posprzatany', 'bez zmian', 'brak pliku'] },
  },
  required: ['przejrzano', 'slownik'],
}

const refreshPrompt = (plik, kategoria) =>
  `Jestes czescia pipeline'u dev-autopilot. Utrzymujesz baze wiedzy PO zapisie nowego solution.
Wykonaj skill .claude/skills/dev-compound-refresh/SKILL.md w TRYBIE AUTONOMICZNYM (bez pytan), ale SCOPED — WASKO:
- Zakres = kategoria dotknieta tym runem${kategoria ? `: "${kategoria}"` : ` (wywnioskuj z ${plik})`} + plik docs/CONCEPTS.md.
- NIE przegladaj calej bazy docs/solutions/ — tylko ten waski scope (routing "Skupiony", 1-2 dokumenty).
- Cel: czy nowy solution (${plik}) podwaza/zastepuje siostrzany dokument w tej kategorii; dedup i weryfikacja hasel w docs/CONCEPTS.md; napraw nieaktualne referencje.
- Wykonuj bezpieczne akcje (Keep/Update/Archive/Replace gdy dowody wystarczajace); niejednoznaczne oznacz stale. Best-effort — nie blokuj.
Zwroc obiekt zgodny ze schematem RefreshResult.`

let compound = null
let refresh = null
if (stan.zakonczenie.compound === 'pending') {
  compound = await workflow('dev-compound-wf', { sciezka })
  // Scoped refresh ZARAZ po compound — dedup/prune bazy dla dotknietej kategorii + CONCEPTS.md.
  // Odpala sie tylko gdy compound cos zapisal (compound.plik != null). Best-effort: nie blokuje complete.
  if (compound && compound.plik) {
    refresh = await agent(refreshPrompt(compound.plik, compound.kategoria), { schema: REFRESH_RESULT, label: 'compound-refresh' })
    log(`Compound-refresh (scoped): ${refresh ? `${refresh.przejrzano} dok., slownik=${refresh.slownik}` : 'agent zwrocil null'}`)
  }
  stan.zakonczenie.compound = 'done'
  await zapiszStan()
}

let complete = null
if (stan.zakonczenie.complete === 'pending') {
  complete = await workflow('dev-docs-complete-wf', { nazwaZadania: stan.nazwaZadania })
}

const tokRazem = Math.round((tokSpent() - tokRunStart) / 1000)
log(`Autopilot koniec: ${kolejka.length} faz, ~${tokRazem}k tokenow lacznie`)

// TELEMETRIA (best-effort, tylko sciezka sukcesu): jedna linia JSONL do GLOBALNEGO pliku
// ~/.claude/telemetry/autopilot-runs.jsonl — wspolnego dla wszystkich projektow na maszynie
// (dane do strojenia progow pipeline'u: limit fix, sceptycy, routing; per projekt bylyby rozproszone).
// raporty[].przebieg (od 2026-07-26) niesie liczby routingu/dedupu/verify — bez nich wpis mowil
// tylko ILE findingow bylo, nie CZY routing kogos pomija i czy dedup semantyczny zarabia na siebie.
// Ograniczenie swiadome: wpis powstaje TYLKO gdy caly run dojdzie do konca — run zatrzymany na
// bramce (STOP) nie zostawia telemetrii, mimo ze fazy przed bramka maja policzone metryki w stanie.
// Timestamp i nazwe projektu ustala leaf-agent (workflow nie moze uzyc Date.now). Pad = tylko log.

// Telemetria opisuje CALE zadanie, nie tylko ten run (2026-07-27). `kolejka` filtruje po pending, wiec
// faza domknieta we WCZESNIEJSZYM runie nie wchodzi do petli i nigdy nie dostawala wiersza — przy zadaniu
// robionym w kilku runach gubilismy metryki dokladnie tych faz, ktore przeszly bez awarii (run
// team-os-onboarding-instalatory, repo web: faza 1 zniknela z telemetrii, choc jej metryki leza w stanie).
// Wiersz odtworzony ze stanu ma zrodlo:'stan' i null tam, gdzie stan nie zna wartosci (gate/cykle/tokeny
// sa liczone w petli runu) — konsument telemetrii ma widziec brak danych, nie zgadywana wartosc.
const raportyTelemetrii = stan.fazy
  .map((f) => {
    const zRunu = raporty.find((r) => r.faza === f.numer)
    if (zRunu) return { ...zRunu, zrodlo: 'run' }
    if (!f.metryki) return null
    return {
      faza: f.numer,
      gate: null,
      cykle: null,
      tokeny: null,
      // Swiadomie NIE utrwalamy tokenyEtapy w stanie: tokeny opisuja RUN, nie faze. Liczby z runu, ktory
      // te faze zrobil, doklejone do wpisu innego runu podpieralyby jego koszt cudzymi danymi — a i tak
      // nie mowilyby, ile kosztowalo wznowienie. Brak danych ma byc widoczny jako null, jak przy `tokeny`.
      tokenyEtapy: null,
      liczniki: f.metryki.liczniki || null,
      fix: null,
      e2eSync: 'n/a',
      przebieg: skrotPrzebiegu(f.metryki.przebieg),
      zrodlo: 'stan',
    }
  })
  .filter(Boolean)
const zeStanu = raportyTelemetrii.filter((r) => r.zrodlo === 'stan').map((r) => r.faza)
if (zeStanu.length) log(`Telemetria: dokladam metryki faz z wczesniejszych runow: ${zeStanu.join(', ')}`)

const wpisTelemetrii = {
  zadanie: stan.nazwaZadania,
  fazyUkonczone: kolejka.length,
  fazyZadania: raportyTelemetrii.length,
  raporty: raportyTelemetrii,
  walidacja: 'PASS',
  e2eSrodowisko: e2eEnv ? e2eEnv.status : 'brak',
  solution: !!(compound && compound.plik),
  tokenyRazemK: tokRazem,
}
const tele = await agent(
  `Dopisz JEDNA linie telemetrii pipeline'u dev-autopilot do globalnego pliku ~/.claude/telemetry/autopilot-runs.jsonl.
1. Bash: mkdir -p ~/.claude/telemetry
2. Ustal: ts = \`date -Iseconds\`, projekt = \`basename "$(git rev-parse --show-toplevel)"\`.
3. Wez ponizszy obiekt, dodaj do niego pola "ts" i "projekt", zserializuj do JEDNEJ linii JSON (bez pretty-print):
${JSON.stringify(wpisTelemetrii)}
4. Dopisz te linie na koncu pliku (append, >>). NIE nadpisuj istniejacej zawartosci.
Nie modyfikuj zadnych innych plikow. Zwroc {zapisano:true} (lub false gdy sie nie udalo).`,
  { schema: ZAPIS_STANU, label: 'telemetria', model: 'haiku' }
)
if (!tele || !tele.zapisano) log('Telemetria: zapis nie powiodl sie (best-effort, run niezagrozony)')

return {
  status: 'OK',
  nazwaZadania: stan.nazwaZadania,
  fazyUkonczone: kolejka.length,
  tokeny: `${tokRazem}k`,
  historia,
  raporty,
  walidacja: stan.walidacjaWynik || 'done w poprzednim runie',
  e2eSrodowisko: e2eEnv ? e2eEnv.status : 'brak',
  archiwum: complete && complete.archiwum,
  archiwumCommit: (complete && complete.commit) || '',
  solution: compound && compound.plik,
  regula: compound && compound.regula,
  refresh: refresh ? refresh.slownik : 'pominieto',
}
