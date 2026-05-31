export const meta = {
  name: 'dev-docs-complete',
  description: 'Archiwizacja ukonczonego zadania: przenosi docs/active/<zadanie> -> docs/completed/, tworzy podsumowanie, aktualizuje dokumentacje projektu.',
  whenToUse: 'Po ukonczeniu wszystkich faz. Wolany przez dev-autopilot lub standalone z args {nazwaZadania}.',
  phases: [{ title: 'Archiwizacja' }],
}

const COMPLETE_RESULT = {
  type: 'object',
  additionalProperties: false,
  properties: {
    archiwum: { type: 'string', description: 'sciezka docs/completed/<zadanie>/' },
    pliki: { type: 'array', items: { type: 'string' } },
    aktualizacje: { type: 'array', items: { type: 'string' }, description: 'co gdzie dopisano (lub puste)' },
    rezultaty: { type: 'array', items: { type: 'string' } },
  },
  required: ['archiwum', 'pliki'],
}

const nazwaZadania = typeof args === 'string' ? args : args && args.nazwaZadania
if (!nazwaZadania) {
  return { archiwum: '', pliki: [], aktualizacje: ['BLAD: brak args {nazwaZadania}'], rezultaty: [] }
}

phase('Archiwizacja')
const wynik = await agent(
  `Jestes specjalista ds. zamykania zadan. Wykonaj procedure ze skilla .claude/skills/dev-docs-complete/SKILL.md
dla zadania: ${nazwaZadania}.

Kroki (zgodnie ze skillem):
1. Zlokalizuj docs/active/${nazwaZadania}/.
2. Zweryfikuj ukonczenie (czytaj *-zadania.md). Jesli zostaly nieukonczone — i tak archiwizuj (tryb autopilota).
3. Wyciagnij kluczowe wnioski z *-kontekst.md.
4. Przenies wszystkie pliki do docs/completed/${nazwaZadania}/ + dodaj ${nazwaZadania}-podsumowanie.md
   (data ukonczenia, co dostarczono, kluczowe decyzje, glowne pliki, wnioski).
5. Zaktualizuj dokumentacje projektu jesli istotne (CLAUDE.md / .claude/rules/).
6. Usun pusty katalog docs/active/${nazwaZadania}/.

NIE uruchamiaj /dev-compound (zrobi to orkiestrator). Dzialaj autonomicznie.
Zwroc obiekt zgodny ze schematem CompleteResult.`,
  { schema: COMPLETE_RESULT, label: `complete:${nazwaZadania}` }
)
return wynik
