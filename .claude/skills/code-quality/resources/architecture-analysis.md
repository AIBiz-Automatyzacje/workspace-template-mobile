# Architecture Analysis

Gleboka analiza architektonalna: SOLID principles, dependency mapping, layer boundaries, anti-patterns.

---

## SOLID Principles

Dla kazdej zasady: pytanie kontrolne, typowe naruszenie, jak naprawic.

### S -- Single Responsibility Principle

**Pytanie kontrolne:** "Czy ten modul ma jeden powod do zmiany?"

**Typowe naruszenie:**
- Klasa `UserService` ktora: waliduje dane, hashuje hasla, wysyla emaile, loguje do bazy, generuje raporty
- Plik 500+ linii z mieszanymi odpowiedzialnosciami
- Funkcja ktora parsuje input, wykonuje logike biznesowa i formatuje output

**Jak naprawic:**
- Zidentyfikuj "powody do zmiany" -- kazdy powod = osobny modul
- Wyciagnij: `UserValidator`, `PasswordHasher`, `EmailService`, `UserRepository`
- Regula kciuka: jesli nie mozesz opisac modulu jednym zdaniem bez "i" -- za duzo odpowiedzialnosci

### O -- Open/Closed Principle

**Pytanie kontrolne:** "Czy moge dodac nowa funkcjonalnosc bez modyfikacji istniejacego kodu?"

**Typowe naruszenie:**
- Switch/if-else na typach ktory rosnie z kazdym nowym typem
- Funkcja z parametrem `type` i rozna logika per typ
- Kazde nowe wymaganie wymaga edycji tego samego pliku

**Jak naprawic:**
- Uzyj polimorfizmu: interfejs + implementacje per typ
- Strategy pattern: zamien switch na mape strategii
- Plugin architecture: zarejestruj handlery zamiast hardkodowac

### L -- Liskov Substitution Principle

**Pytanie kontrolne:** "Czy podtyp zachowuje sie jak typ bazowy?"

**Typowe naruszenie:**
- Klasa potomna ktora rzuca wyjatkiem w metodzie bazowej (`NotImplementedError`)
- Overwrite ktory zmienia semantyke metody (np. `save()` ktore w podklasie nie zapisuje)
- Podtyp ktory wymaga dodatkowych warunkow wstepnych

**Jak naprawic:**
- Jesli podtyp nie moze spelnic kontraktu bazowego -- to nie jest podtyp, uzyj kompozycji
- Sprawdz ze podtyp nie zaciesnia preconditions i nie rozluźnia postconditions
- Preferuj kompozycje nad dziedziczenie

### I -- Interface Segregation Principle

**Pytanie kontrolne:** "Czy konsument uzywa wszystkich metod interfejsu?"

**Typowe naruszenie:**
- Interfejs z 15 metodami, z ktorych kazdy consumer uzywa 3
- "God interface" ktory opisuje caly modul zamiast poszczegolnych ról
- Implementacja z pustymi metodami (`// not needed here`)

**Jak naprawic:**
- Podziel duzy interfejs na mniejsze, wyspecjalizowane (role-based)
- Klient powinien zalezec tylko od metod ktorych uzywa
- Jesli widzisz puste implementacje -- interfejs jest za szeroki

### D -- Dependency Inversion Principle

**Pytanie kontrolne:** "Czy modul zalezy od abstrakcji czy konkretnych implementacji?"

**Typowe naruszenie:**
- Serwis biznesowy ktory bezposrednio importuje klienta bazy danych
- Modul ktory tworzy swoje zaleznosci wewnatrz (`new DatabaseClient()`)
- Brak mozliwosci podmiany implementacji (np. na mock w testach)

**Jak naprawic:**
- Wstrzykuj zaleznosci przez konstruktor/parametry
- Zdefiniuj interfejs w warstwie konsumenta, implementacje w warstwie dostawcy
- High-level modul definiuje "czego potrzebuje", low-level modul implementuje

---

## Dependency Mapping

### Jak zidentyfikowac circular dependencies

**Metody detekcji:**
- Grep importow: sprawdz czy modul A importuje z B, a B importuje z A
- Analiza tranzytywna: A -> B -> C -> A (cykl dluzszy niz 2 elementy)
- Narzedzia statyczne: `madge`, `dependency-cruiser`, `deptree` (jesli dostepne)
- Manualna analiza: dla kazdego modulu wypisz "co importuje" i "kto go importuje"

**Typowe sygnaly:**
- Dwa pliki importuja nawzajem z siebie
- Modul "utility" ktory importuje z modulu biznesowego
- Typy zdefiniowane w module ktory ich uzywa (zamiast w osobnym pliku typow)
- Plik `index.ts` ktory re-exportuje i jednoczesnie importuje z tego samego katalogu

**Jak naprawic:**
- **Dependency Inversion** -- wyciagnij interfejs do trzeciego modulu, oba moduly zaleza od interfejsu
- **Extract interface** -- wspolna zaleznosc idzie do osobnego pliku (typy, kontrakty)
- **Mediator pattern** -- trzeci modul koordynuje komunikacje miedzy dwoma
- **Event system** -- zamiast bezposredniego importu, komunikacja przez eventy

### Mapa zaleznosci -- jak budowac

1. Wypisz wszystkie moduly/katalogi najwyzszego poziomu
2. Dla kazdego: wypisz importy zewnetrzne (z innych modulow)
3. Narysuj graf: strzalka od importujacego do importowanego
4. Szukaj cykli i skupien (modul z 10+ importujacymi = potencjalny God Object)

---

## Layer Boundaries

### Typowy podzial warstw

```
UI / Presentation
    |
    v
Business Logic / Domain
    |
    v
Data Access / Repository
    |
    v
External Services / Infrastructure
```

### Reguly warstw

- Warstwa wyzsza MOZE importowac z nizszej
- Warstwa nizsza NIGDY nie importuje z wyzszej
- Warstwy nie przeskakuja -- UI nie importuje bezposrednio z External Services
- Kazda warstwa ma zdefiniowany interfejs (kontrakt) z sasiednią

### Typowe naruszenia

| Naruszenie | Przyklad | Jak naprawic |
|------------|----------|--------------|
| UI z logika bazy danych | Komponent ktory buduje SQL query | Wyciagnij do warstwy Data Access |
| Serwis z logika prezentacji | Funkcja biznesowa ktora formatuje HTML/JSX | Rozdziel logike od prezentacji |
| Data layer z logika biznesowa | Repository ktore waliduje reguly biznesowe | Przenies walidacje do warstwy Business Logic |
| Przeskakiwanie warstw | UI importuje bezposrednio driver bazy | Dodaj wartswe posrednia (serwis, repository) |
| Shared state miedzy warstwami | Globalny obiekt uzywany przez wszystkie warstwy | Przekazuj dane przez parametry/interfejsy |

### Jak sprawdzic

1. Wypisz katalogi projektu i przypisz je do warstw
2. Sprawdz importy: czy sa zgodne z kierunkiem warstw?
3. Szukaj "skip layer" -- czy UI importuje bezposrednio z infrastructure?
4. Sprawdz czy kazda warstwa ma jasno zdefiniowany interfejs publiczny

---

## Anti-patterns Catalog

### God Object

**Co to jest:** Klasa/modul z 10+ odpowiedzialnosciami, ktory "wie wszystko" i "robi wszystko".

**Jak wykryc:**
- Plik 500+ linii
- Modul importowany przez > 10 innych modulow
- Klasa z > 10 publicznymi metodami z roznych domen
- Kazda zmiana w systemie wymaga edycji tego modulu

**Jak naprawic:**
- Zidentyfikuj klastry odpowiedzialnosci w module
- Wyciagnij kazdy klaster do osobnego modulu
- Facade pattern jesli potrzebujesz zachowac wsteczna kompatybilnosc

### Feature Envy

**Co to jest:** Funkcja ktora operuje glownie na danych innego modulu, nie swojego.

**Jak wykryc:**
- Funkcja ktora 80% czasu odwoluje sie do pol innego obiektu
- Ciagi `other.getX()`, `other.getY()`, `other.getZ()` w jednej funkcji
- Logika ktora "powinna byc" w innym module ale jest tutaj "bo bylo wygodniej"

**Jak naprawic:**
- Przenies funkcje do modulu ktorego dane przetwarza
- Lub: popros ten modul o wykonanie operacji (Tell, Don't Ask)

### Inappropriate Intimacy

**Co to jest:** Dwa moduly ktore znaja za duzo swoich wewnetrznych szczegolow.

**Jak wykryc:**
- Modul A uzywa prywatnych/wewnetrznych elementow modulu B
- Zmiana wewnetrznej struktury B lamie A
- Dwa moduly ktore mozna zmienic tylko razem

**Jak naprawic:**
- Zdefiniuj jasny publiczny interfejs miedzy modulami
- Ukryj szczegoly implementacji (enkapsulacja)
- Jesli moduly sa nierozlaczne -- polacz je w jeden

### Shotgun Surgery

**Co to jest:** Jedna zmiana logiczna wymaga edycji 10+ plikow.

**Jak wykryc:**
- Dodanie nowego typu/statusu wymaga zmian w 5+ plikach
- Zmiana formatu danych wymaga aktualizacji parsera, walidatora, serializera, UI, testow osobno
- Kazdy PR dotyka dziesiątek plikow dla prostej zmiany

**Jak naprawic:**
- Kolokacja: przenies powiazana logike blizej siebie
- Extract module: zgrupuj rozproszona logike w jednym miejscu
- Registry/plugin pattern: nowy typ = nowy plik, zero zmian w istniejacych
