# Review Patterns

Techniki dawania feedbacku i pisania komentarzy w code review.

---

## Zasady dobrego feedbacku

### Feedback powinien być:

1. **Konkretny** — plik, linia, przykład
2. **Konstruktywny** — propozycja rozwiązania, nie tylko krytyka
3. **Obiektywny** — o kodzie, nie o autorze
4. **Priorytetyzowany** — co jest blocking vs nit
5. **Zbalansowany** — też pochwały za dobre rozwiązania

### Feedback NIE powinien:

- Atakować autora ("dlaczego to zrobiłeś?")
- Być niejasny ("to jest źle")
- Narzucać preferencji stylistycznych
- Blokować merge przez drobiazgi
- Pomijać kontekstu (deadline, MVP, etc.)

---

## Filozofia review

### Istniejący kod vs nowy kod

Nie wszystkie zmiany zasługują na ten sam poziom surowości:

| Typ zmiany | Podejście | Kiedy blokuj |
|------------|-----------|--------------|
| Modyfikacja istniejącego pliku | Surowe — każda dodana złożoność wymaga uzasadnienia | Zawsze gdy komplikuje |
| Nowy izolowany moduł/komponent | Pragmatyczne — jeśli działa i jest testowalny | Tylko przy [blocking] |
| Refaktor istniejącego kodu | Najsurowsze — weryfikuj że nic nie łamie | Przy regresji lub utracie testów |

### 5-sekundowa reguła nazewnictwa

Jeśli nie rozumiesz co robi funkcja/komponent w 5 sekund od przeczytania nazwy — to zła nazwa.

- FAIL: `doStuff`, `handleData`, `process`, `Manager`
- PASS: `validateUserEmail`, `fetchUserProfile`, `transformApiResponse`

### Sygnały do ekstrakcji modułu

Rozważ ekstrakcję do osobnego modułu gdy widzisz 2+ z:
- Złożone reguły biznesowe (nie "jest długie", ale "robi za dużo rzeczy naraz")
- Wiele obowiązków w jednej funkcji/pliku
- Interakcja z zewnętrznym API lub złożony async
- Logika którą chciałbyś reużywać w innych komponentach

---

## Techniki feedbacku

### 1. Question Approach

Zamiast stwierdzać problem, zadaj pytanie. Zachęca do myślenia i jest mniej konfrontacyjne.
````markdown
❌ "To się wysypie gdy lista jest pusta."
✅ "Co się stanie gdy `items` będzie pustą tablicą?"

❌ "Brakuje error handling."
✅ "Jak powinien zachować się komponent gdy API zwróci błąd?"

❌ "To jest nieefektywne."
✅ "Czy rozważałeś wydajność przy 10k użytkowników?"
````

### 2. Suggest, Don't Command

Proponuj zamiast nakazywać. Daj autorowi wybór.
````markdown
❌ "Zmień to na async/await."
✅ "Rozważ async/await — może poprawić czytelność:
```typescript
   const data = await fetchUser(id);
```
   Co myślisz?"

❌ "Wydziel to do osobnej funkcji."
✅ "Ta logika pojawia się w 3 miejscach. Może warto
   wydzielić do `calculateTotal()`? Chętnie omówię."
````

### 3. Context + Problem + Solution

Struktura dla złożonych komentarzy:
````markdown
**Kontekst:** Widzę że używasz `useEffect` do fetchowania danych.

**Problem:** `useEffect` + `useState` do fetch nie obsługuje cache,
dedup, retry ani background refetch. Użyj React Query.

**Propozycja:**
```typescript
// useSuspenseQuery + Suspense — preferowane
function UserProfile({ id }: Props) {
  const { data: user } = useSuspenseQuery({
    queryKey: ["users", id],
    queryFn: () => getUser(id),
  });
  return <div>{user.name}</div>;
}

// Użycie:
<Suspense fallback={<ProfileSkeleton />}>
  <UserProfile id={userId} />
</Suspense>
```

Daj znać jeśli potrzebujesz pomocy z migracją.
````

### 4. Przykłady ❌/✅

Pokaż co jest źle i jak powinno być:
````markdown
**Problem:** Mutacja props w komponencie.

❌ Obecnie:
```typescript
function UserCard({ user }: Props) {
  user.lastSeen = new Date(); // mutacja!
  return <div>{user.name}</div>;
}
```

✅ Powinno być:
```typescript
function UserCard({ user, onView }: Props) {
  useEffect(() => {
    onView(user.id); // callback do rodzica
  }, [user.id, onView]);
  return <div>{user.name}</div>;
}
```
````

---

## Severity Labels

Używaj etykiet aby jasno komunikować priorytet. **Te same etykiety używane są w raporcie końcowym.**

### 🔴 [blocking] — Blokuje merge

Musi być naprawione przed merge. Używaj dla:
- Błędów bezpieczeństwa
- Bugów powodujących crash
- Wycieków danych
- Złamania wymagań krytycznych
- Brak RLS policies na tabelach Supabase
- Brak captureException w catch blokach
````markdown
🔴 [blocking] **src/actions/payment.ts:45**
SQL injection vulnerability — input nie jest walidowany.
Użyj prepared statement lub Zod validation.
````
````markdown
🔴 [blocking] **supabase/migrations/001_users.sql**
Tabela `users` nie ma włączonego RLS — dane wszystkich użytkowników są publicznie dostępne.
Dodaj `ALTER TABLE users ENABLE ROW LEVEL SECURITY` i odpowiednie polityki.
````

### 🟠 [important] — Wymaga poprawy

Powinno być naprawione, ale można dyskutować. Używaj dla:
- Problemów wydajnościowych
- Błędnego użycia frameworka
- Brakujących edge cases
- Problemów z dostępnością
````markdown
🟠 [important] **src/components/UserList.tsx:23**
N+1 query — fetchujesz użytkowników w pętli.
Rozważ `supabase batch operations` lub query z `with` relacją.
````
````markdown
🟠 [important] **src/hooks/useData.ts:12**
useEffect do fetchowania danych — użyj
React Query (`useQuery` / `useSuspenseQuery`).
````

### 🟡 [nit] — Drobiazg

Nice-to-have, nie blokuje. Używaj dla:
- Lepszego nazewnictwa
- Drobnych usprawnień
- Stylistyki (jeśli nie łapie linter)
- Brakujących typów
- Przestarzałych wzorców
````markdown
🟡 [nit] **src/utils/format.ts:12**
`data` → `userData` dla jasności? Nie blokuje.
````
````markdown
🟡 [nit] **src/components/Input.tsx:5**
`forwardRef` jest zbędny w React 19 — ref to zwykły prop.
````

### 🔵 [suggestion] — Propozycja

Alternatywne podejście do rozważenia:
````markdown
🔵 [suggestion] **src/hooks/useAuth.ts**
Rozważ `useActionState()` z React 19 zamiast
manualnego zarządzania loading/error state.
````
````markdown
🔵 [suggestion] **src/app/globals.css**
W Tailwind 4 możesz użyć `field-sizing: content`
zamiast JS hacka do auto-growing textarea.
````

### 💡 [learning] — Edukacyjne

Wyjaśnienie bez wymaganej akcji:
````markdown
💡 [learning] **src/hooks/useItems.ts:5**
FYI: React Query domyślnie cache'uje dane na 0ms (staleTime).
Ustaw `staleTime: 5 * 60 * 1000` dla rzadko zmieniających się danych.
````

### 🎉 [praise] — Pochwała

Doceniaj dobre rozwiązania:
````markdown
🎉 [praise] **src/components/DataTable.tsx**
Świetne użycie `useOptimistic()` — UX jest znacznie lepszy!
````
````markdown
🎉 [praise] **src/lib/supabase.ts**
Czysta konfiguracja klienta z typami. Widać przemyślane podejście.
````

---

## Obsługa trudnych sytuacji

### Gdy autor się nie zgadza

1. **Zrozum perspektywę**
````markdown
   "Pomóż mi zrozumieć — co Cię skłoniło do tego podejścia?"
````

2. **Uznaj dobre argumenty**
````markdown
   "Masz rację co do X, nie wziąłem tego pod uwagę."
````

3. **Dostarcz dane**
````markdown
   "Obawiam się o wydajność. Możemy dodać benchmark?"
````

4. **Eskaluj jeśli trzeba**
````markdown
   "Poprośmy [tech lead] o opinię w tej kwestii."
````

5. **Wiedz kiedy odpuścić**
   Jeśli działa i nie jest [blocking] — approve.
   Perfekcja jest wrogiem postępu.

### Gdy kod wymaga dużych zmian
````markdown
## Ogólna uwaga

Widzę że implementacja działa, ale mam obawy
o skalowalność tego podejścia. Zanim przejdziemy
do szczegółowego review, czy możemy porozmawiać
o architekturze? Chętnie omówię na call.

Główne kwestie:
1. [kwestia 1]
2. [kwestia 2]

Nie chcę blokować niepotrzebnie — może mój kontekst
jest niepełny. Daj znać co myślisz.
````

### Gdy deadline goni
````markdown
## Uwagi do review

Biorąc pod uwagę deadline, oznaczyłem:
- 🔴 [blocking] — musi być przed release
- 🟡 [nit] + [tech-debt] — do naprawy po release

Możemy merge po naprawieniu [blocking], resztę
dodajmy do backlogu jako tech debt.
````

---

## Struktura komentarza review

### Dla pojedynczego problemu
````markdown
🟠 [important] **ścieżka/plik.tsx:linia**

[Krótki opis problemu]

[Opcjonalnie: dlaczego to problem]

[Propozycja rozwiązania / przykład kodu]
````

### Dla podsumowania PR
````markdown
## Review: [nazwa PR/fazy]

### Ogólnie
[1-2 zdania oceny]

### Co mi się podoba
- [pozytyw 1]
- [pozytyw 2]

### Do poprawy
[lista problemów z severity labels]

### Pytania
- [pytanie 1]
- [pytanie 2]

### Decyzja
✅ Approve / ⚠️ Request changes / 💬 Comment
````

---

## Anti-patterns w review

### Unikaj:

| ❌ Anti-pattern | ✅ Zamiast tego |
|-----------------|-----------------|
| Ghosting (request changes i zniknięcie) | Bądź dostępny na follow-up |
| Rubber stamping (LGTM bez review) | Przejrzyj naprawdę |
| Bike shedding (debata o [nit]) | Skup się na [blocking]/[important] |
| Scope creep ("a może jeszcze...") | Trzymaj się zakresu PR |
| Perfectionism (blokowanie przez [nit]) | Approve z sugestiami |
| Inconsistency (różne standardy) | Te same zasady dla wszystkich |

---

## Timing

- **Odpowiadaj szybko** — najlepiej w ciągu 24h
- **Review w blokach** — max 60 min, potem przerwa
- **Limit rozmiaru PR** — 200-400 linii optymalnie
- **Nie reviewuj gdy zmęczony** — jakość spada