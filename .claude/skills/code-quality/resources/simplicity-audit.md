# Simplicity Audit

Audyt prostoty kodu: YAGNI, abstrakcje, redundancja, LOC metrics, wzorce upraszczania.

---

## YAGNI Audit

5 pytan kontrolnych. Dla kazdego elementu kodu (klasy, interfejsu, funkcji, konfiguracji) zadaj:

### 1. "Czy to jest explicite wymagane TERAZ?"

- Jesli odpowiedz to "na przyszlosc", "na wypadek gdyby", "moze sie przyda" -- usun
- Jesli odpowiedz to "tak, uzywane w X i Y" -- zostaw
- Koszt utrzymania kodu ktory nie jest uzywany jest wyzszy niz koszt napisania go pozniej

### 2. "Czy ktos uzywa tego interfejsu poza jednym miejscem?"

- Interfejs z jednym konsumentem = abstrakcja bez uzasadnienia
- Jesli interfejs ma 1 implementacje i 1 konsumenta -- inline
- Wyjątek: boundary (API, plugin) gdzie interfejs jest kontraktem publicznym

### 3. "Czy ta abstrakcja ma 2+ implementacje?"

- Factory z jednym typem produktu = zbedny factory
- Strategy z jedna strategia = zbedny pattern
- Abstract class z jednym potomkiem = zbedna hierarchia
- Regula: abstrakcja jest uzasadniona dopiero gdy ma 2+ rozne implementacje

### 4. "Czy ten config jest kiedykolwiek zmieniany?"

- Plik konfiguracyjny z wartosciami ktore nigdy sie nie zmienily od stworzenia
- Environment variable dla stalej ktora jest taka sama w dev, staging i prod
- Regula: jesli wartosc jest stala -- hardkoduj jako named constant, nie twórz konfiguracji

### 5. "Czy ten error handling obsluguje scenariusz ktory moze sie wydarzyc?"

- Try/catch na operacji ktora nie moze rzucic wyjatku
- Walidacja na danych ktore sa juz zwalidowane wyzej
- Null check na wartosci ktora nigdy nie jest null (bo system typow to gwarantuje)
- Regula: defensywny kod jest dobry, ale obrona przed scenariuszem ktory nie istnieje = szum

---

## Abstraction Challenge

### Kiedy abstrakcja jest uzasadniona

- **2+ implementacje** -- interfejs, abstract class, strategy -- uzasadnione
- **Rozne warianty zachowania** -- polimorfizm ma sens gdy sa rozne sciezki
- **Boundary/kontrakt** -- API publiczne, plugin interface, integracja z external service
- **Testability** -- dependency injection przez interfejs umozliwia mockowanie

### Kiedy abstrakcja NIE jest uzasadniona

- **Jeden consumer, jedna implementacja** -- inline zamiast interfejsu
- **"Na przyszlosc"** -- abstrakcja ktora moze sie przyda "kiedys"
- **Over-engineered DI** -- 5 warstw abstrakcji dla prostej operacji
- **Wrapper ktory nic nie dodaje** -- klasa ktora deleguje kazde wywolanie do jednego pola

### Regula kciuka

Inline dopoki nie jest bolesne. Kiedy widzisz, ze duplikujesz logike po raz drugi -- WTEDY wyciagnij abstrakcje. Nie wczesniej.

Koszt abstrakcji:
- Wiecej plikow do nawigacji
- Wiecej indirection (musisz "skakac" miedzy plikami zeby zrozumiec flow)
- Wiecej kodu do utrzymania
- Wiecej kontekstu potrzebnego do zrozumienia systemu

---

## Redundancy Detection

### Duplikaty walidacji

**Symptom:** Ta sama regula walidacji w 3+ miejscach.

**Jak wykryc:**
- Grep po nazwie pola (np. `email`) i szukaj regex/walidacji
- Porownaj walidacje w: frontend form, API handler, database constraint
- Sprawdz czy zmiana reguly wymaga edycji wielu plikow

**Jak naprawic:**
- Single source of truth: jeden schemat walidacji (np. Zod schema) uzywany wszedzie
- Jesli rozne warstwy wymagaja roznej walidacji -- to nie jest duplikat, to rozne odpowiedzialnosci

### Powtorzony error handling

**Symptom:** Ten sam blok try/catch skopiowany w 10 funkcjach.

**Jak wykryc:**
- Grep po `catch` -- porownaj bloki catch w podobnych funkcjach
- Szukaj identycznego kodu w catch (ten sam logging, ten sam format odpowiedzi)

**Jak naprawic:**
- Higher-order function: `withErrorHandling(fn)` ktora opakowuje logike
- Middleware pattern: error handling na granicy (API middleware, error boundary)
- Nie wyciagaj jesli bloki catch sa ROZNE -- wtedy to nie jest duplikat

### Dead code

**Symptom:** Importy, zmienne, funkcje, eksporty ktore nigdy nie sa uzywane.

**Jak wykryc:**
- Nieuzywane importy: linter / IDE powinien flagowac
- Nieuzywane eksporty: grep po nazwie eksportu -- czy ktos importuje?
- Zakomentowany kod: usun (git ma historie)
- Funkcje wywolywane z 0 miejsc: grep po nazwie funkcji
- Feature flags ktore sa zawsze true/false

**Jak naprawic:**
- Usun agresywnie. Git ma historie -- mozna przywrocic
- Zakomentowany kod = usun zawsze. "Na pozniej" nigdy nie nastepuje
- Nieuzywane feature flags = usun flag, zostaw aktywna sciezke

---

## LOC Metrics

### Co liczyc

- **Logic lines** -- linie ktore wykonuja prace (instrukcje, wyrazenia, deklaracje)
- **NIE licz:** pustych linii, komentarzy, importow, deklaracji typow, nawiasow zamykajacych

### Jak mierzyc

1. Policz linie logiki w analizowanym zakresie
2. Zidentyfikuj linie ktore mozna usunac (dead code, zbedne abstrakcje, duplikaty)
3. Raportuj: "LOC do potencjalnego usuniecia: ~X (Y% analizowanego zakresu)"

### Complexity Score

| Score | Liczba issues | Interpretacja |
|-------|---------------|---------------|
| Low | < 10 | Kod w dobrym stanie, punktowe poprawki |
| Medium | 10-25 | Tech debt wymaga zaplanowanej pracy |
| High | > 25 | Znaczaca refaktoryzacja potrzebna |

---

## Simplification Patterns

### Early return zamiast deep nesting

```
// Zamiast:
function process(input) {
    if (input) {
        if (input.isValid) {
            if (input.hasPermission) {
                // logika 3 poziomy gleboko
            }
        }
    }
}

// Uzyj:
function process(input) {
    if (!input) return;
    if (!input.isValid) return;
    if (!input.hasPermission) return;
    // logika na poziomie 0
}
```

### Guard clauses na poczatku funkcji

- Wszystkie warunki wstepne (preconditions) na samym poczatku
- Fail fast: jesli input jest bledny, zwroc/rzuc natychmiast
- Glowna logika zaczyna sie dopiero po walidacji -- na zero level nestingu

### Inline simple one-use functions

- Funkcja wywolywana z jednego miejsca, 3-5 linii, nazwa nie dodaje jasnosci -- inline
- Wyjątek: jesli nazwa funkcji dokumentuje intencje lepiej niz sam kod
- Regula: jesli musisz "skoczyc" do definicji zeby zrozumiec flow -- inline moze byc lepszy

### Remove dead code aggressively

- Zakomentowany kod: usun (git pamięta)
- Funkcja z 0 callers: usun
- Import nieuzywany: usun
- Feature flag zawsze true: usun flag, zostaw aktywna sciezke
- Nie zostawiaj "na wszelki wypadek" -- koszt utrzymania > koszt odtworzenia

### Flatten conditionals

```
// Zamiast nested if-else:
if (type === "a") {
    // ...
} else {
    if (type === "b") {
        // ...
    } else {
        if (type === "c") {
            // ...
        }
    }
}

// Uzyj switch lub mape:
switch (type) {
    case "a": /* ... */ break;
    case "b": /* ... */ break;
    case "c": /* ... */ break;
}

// Lub mapa strategii:
const handlers = { a: handleA, b: handleB, c: handleC };
handlers[type]?.();
```
