# Performance Analysis

Analiza wydajnosci: Big O, N+1, scalability projection, caching, benchmarks.

---

## Big O Analysis Framework

### Jak okreslac zlozonosc

1. Zidentyfikuj "n" -- co rosnie? (liczba rekordow, rozmiar inputu, liczba uzytkownikow)
2. Policz zagniezdzone petle -- kazda petla mnozy zlozonosc
3. Uwazaj na ukryte zlozonosci: `.sort()` wewnatrz `.map()`, `.includes()` w petli
4. Sprawdz operacje na strukturach danych -- lookup w tablicy vs lookup w mapie/secie

### Typowe pulapki (hidden quadratic)

| Kod ktory wyglada niewinnie | Rzeczywista zlozonosc | Dlaczego |
|-----------------------------|-----------------------|----------|
| `arr.filter(x => other.includes(x))` | O(n * m) | `includes` to O(m) w petli O(n) |
| `arr.sort().filter(...)` | O(n log n) + O(n) | sort dominuje, ale bywa pomijany |
| `arr.map(x => arr2.find(y => y.id === x.id))` | O(n * m) | find to O(m) w petli O(n) |
| Petla z `Set.has()` lub `Map.get()` | O(n) | Poprawnie -- lookup O(1) |
| Nested loop z wczesnym break | O(n * m) worst case | break nie zmienia Big O |
| Rekurencja bez memoizacji (np. fib) | O(2^n) | Eksponencjalny wzrost |

### Tabela typowych operacji

| Operacja | Tablica | Map/Set | Posortowana tablica |
|----------|---------|---------|---------------------|
| Lookup po wartosci | O(n) | O(1) | O(log n) binary search |
| Insert | O(1) amortized | O(1) | O(n) shift |
| Delete po indeksie | O(n) shift | O(1) | O(n) shift |
| Szukanie min/max | O(n) | O(n) | O(1) first/last |
| Sprawdzenie duplikatow | O(n^2) naive | O(n) | O(n) porownanie sasiednich |

### Kiedy O(n^2) jest akceptowalne

- **Male n (< 100)** i operacja wykonywana rzadko -- nie optymalizuj przedwczesnie
- **Jednorazowe operacje** (migracja, setup) -- czas developmentu wazniejszy
- **Prostota >> wydajnosc** gdy n jest ograniczone i znane z gory
- **NIE akceptowalne** gdy n zalezy od user input lub moze rosnac nieograniczenie

---

## N+1 Detection Patterns

### Jak rozpoznac

**Wzorzec:** Operacja I/O (fetch, query, file read) wewnatrz petli.

```
// Pseudokod -- N+1
for item in items:
    details = fetch(item.id)     // 1 request per item = N requestow
    process(item, details)
```

**Typowe formy:**
- `forEach` / `map` / `for...of` z `await fetch()` / `await query()` wewnatrz
- ORM lazy loading: dostep do relacji w petli triggeruje osobne zapytanie per rekord
- Plik per rekord: otwieranie pliku w petli
- API call per element: pobieranie szczegolow kazdego elementu osobno

### Jak naprawic

| Problem | Rozwiazanie |
|---------|-------------|
| Query w petli | Batch query: `WHERE id IN (...)` zamiast N x `WHERE id = X` |
| Fetch w petli | `Promise.all()` z batch (nie 1000 rownoleglych -- uzyj chunków po 10-50) |
| ORM lazy loading | Eager loading / preload relacji w glownym zapytaniu |
| Plik per rekord | Odczytaj wszystkie pliki raz, zbuduj mape, lookup w petli |

### Diagnostyka

- Policz ile operacji I/O wykonuje sie dla N elementow
- Jesli odpowiedz to "N" lub "N+1" -- masz problem
- Poprawna odpowiedz: "1" (batch) lub "stala liczba" (join/preload)

---

## Scalability Projection

### Framework: "Co sie stanie przy 10x, 100x, 1000x?"

Dla kazdej kluczowej operacji odpowiedz na pytania:

| Mnoznik | Pytanie | Akcja |
|---------|---------|-------|
| 10x | Czy cos bedzie wolniejsze? | Monitoruj, zaplanuj |
| 100x | Czy cos przestanie dzialac? | Napraw przed wzrostem |
| 1000x | Czy architektura to wytrzyma? | Przeprojektuj jesli potrzeba |

### Pytania kontrolne per warstwa

**API / Backend:**
- Ile zapytan per request? Czy rosnie z danymi?
- Czy jest paginacja? Co sie stanie bez niej przy 100k rekordow?
- Czy sa timeout'y? Co jesli operacja trwa 30s?
- Czy jest rate limiting?

**Baza danych:**
- Czy sa indeksy na kolumnach uzywanych w WHERE/JOIN?
- Czy sa zapytania full table scan?
- Czy transakcje trzymaja locki dluzej niz potrzeba?

**Frontend / Klient:**
- Czy lista renderuje 10000 elementow naraz? (potrzeba wirtualizacji)
- Czy dane sa paginowane?
- Czy pamieci uzywa sie wiecej z czasem? (memory leak)

**Pamiec / Przetwarzanie:**
- Czy caly dataset ladowany do pamieci? Co przy 10GB?
- Czy sa operacje strumieniowe (streaming) gdzie potrzeba?
- Czy batch processing dzieli prace na chunki?

### Kiedy trzeba dzialac vs premature optimization

**Dzialaj teraz:**
- Algorytm O(n^2) na danych ktore rosna -- zmieni sie w produkcji
- Brak paginacji -- kazdy uzytkownik pobiera wszystko
- N+1 na gorącej sciezce (request ktory wykonuje sie 1000x/min)

**Nie optymalizuj przedwczesnie:**
- Operacja wykonywana raz dziennie przez admina
- Dataset ktory z definicji jest maly (lista krajow, enum typow)
- Mikro-optymalizacje ktore nie wplywaja na user experience

---

## Caching Strategies

### Decision tree: kiedy co cachowac

```
Czy dane zmieniaja sie rzadko?
  |-- Tak: Czy sa wspolne dla wielu uzytkownikow?
  |     |-- Tak: Cache aplikacyjny (Redis, in-memory)
  |     |-- Nie: Cache per-user (sesja, local storage)
  |-- Nie: Czy sa drogie do obliczenia?
        |-- Tak: Memoizacja (cache wyniku funkcji)
        |-- Nie: Nie cachuj
```

**Typy cache:**
- **Memoizacja** -- wynik funkcji cachowany na czas zycia procesu/komponentu
- **Cache aplikacyjny** -- wspolny dla wszystkich uzytkownikow, TTL-based
- **CDN** -- statyczne zasoby, public content
- **Browser cache** -- HTTP headers (Cache-Control, ETag)

### Cache invalidation -- typowe bledy

- **Stale data:** Cache nie jest invalidowany po zmianach -- uzytkownik widzi stare dane
- **Thundering herd:** Cache expiruje, 1000 requestow jednoczesnie odbudowuje cache
- **Over-caching:** Cachowanie danych ktore zmieniaja sie co sekunde -- cache nigdy nie jest aktualny
- **Missing invalidation:** Zapis do bazy bez invalidacji cache -- niespojnosc danych

### Kiedy NIE cachowac

- Dane ktore zmieniaja sie przy kazdym uzyciu (np. current timestamp)
- Dane wrazliwe (tokeny, hasla) -- ryzyko wycieku z cache
- Dane per-request ktore nie sa reuzywane
- Kiedy koszt cache (pamiec, zlozonosc) > koszt ponownego obliczenia

---

## Performance Benchmarks

Orientacyjne wartosci -- przekroczenie wymaga uzasadnienia lub optymalizacji.

### API / Backend

| Metryka | Cel | Akcja jesli przekroczony |
|---------|-----|--------------------------|
| Response time (standard) | < 200ms | Sprawdz zapytania DB, N+1, brak indeksow |
| Response time (zlozony) | < 1s | Rozważ async processing, cache |
| Response time (raport) | < 5s | Background job + polling/webhook |
| Queries per request | < 10 | Szukaj N+1, batchuj, joinuj |

### Algorytmy

| Metryka | Cel | Akcja jesli przekroczony |
|---------|-----|--------------------------|
| Zlozonosc hot path | Max O(n log n) | Optymalizuj algorytm |
| Zlozonosc cold path | Max O(n^2) z malym n | Dokumentuj limit n |
| Lookup operacje | O(1) z Map/Set | Zamien tablice na Map/Set |

### Frontend

| Metryka | Cel | Akcja jesli przekroczony |
|---------|-----|--------------------------|
| Bundle per feature | < 5KB gzip | Code splitting, dynamic import |
| Lista bez wirtualizacji | < 100 elementow | React-window / react-virtuoso |
| Re-rendery per interakcja | < 5 komponentow | Sprawdz state colocation |

### Background Processing

| Metryka | Cel | Akcja jesli przekroczony |
|---------|-----|--------------------------|
| Batch size | 100-1000 per chunk | Tunuj do optimal throughput |
| Memory per batch | < 100MB | Streaming zamiast load-all |
| Retry policy | Max 3 retries z backoff | Dead letter queue po wyczerpaniu |
