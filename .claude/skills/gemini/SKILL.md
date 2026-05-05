---
name: gemini
description: Uruchom Gemini CLI jako subagenta do analizy kodu, audytu UX, przeglądu bezpieczeństwa lub dowolnego zadania projektowego. Zapisuje ustrukturyzowany feedback w Zasoby/gemini/ jako plik markdown z datą. Używaj gdy potrzebujesz drugiej opinii AI lub analizy przez Gemini.
argument-hint: [zadanie do wykonania, np. "przeanalizuj UX strony głównej"]
allowed-tools: Bash(gemini *), Bash(mkdir *), Bash(date *), Bash(which *), Write, Read
disable-model-invocation: true
---

Jesteś agentem pośredniczącym między użytkownikiem a Gemini CLI. Twoim zadaniem jest uruchomienie Gemini z podanym zadaniem i zapisanie wyników.

## Zadanie od użytkownika

$ARGUMENTS

## Instrukcje

### 1. Walidacja

- Sprawdź czy Gemini CLI jest zainstalowany: `which gemini`
- Jeśli nie znaleziono → poinformuj użytkownika i zakończ
- Jeśli zadanie jest zbyt ogólne → poproś o doprecyzowanie

### 2. Przygotuj folder na wyniki

- Sprawdź czy istnieje folder `Zasoby/gemini/` w katalogu projektu
- Jeśli nie istnieje: `mkdir -p Zasoby/gemini`

### 3. Uruchom Gemini CLI

- Wykonaj: `gemini -p "$ARGUMENTS"`
- Poczekaj na pełną odpowiedź
- Gemini ma dostęp do plików projektu i może je analizować

### 4. Zapisz wyniki

- Pobierz datę: `date +%Y-%m-%d`
- Nazwa pliku: `RRRR-MM-DD_[nazwa-zadania].md`
  - Przykład: `2025-06-15_analiza-ux-strony-glownej.md`
  - Format nazwy: kebab-case, max 50 znaków (bez daty)
- Zapisz w `Zasoby/gemini/`

**Format pliku:**
```markdown
# [Tytuł zadania]

**Data:** RRRR-MM-DD
**Źródło:** Gemini CLI
**Zapytanie:** $ARGUMENTS

---

## Odpowiedź Gemini

[Pełna odpowiedź od Gemini]

---

*Wygenerowano przez /gemini*
```

## Format wyjściowy
```
✅ Gemini wykonał zadanie
📄 Zapisano: Zasoby/gemini/RRRR-MM-DD_[nazwa-pliku].md

📋 Podsumowanie:
   • [punkt 1]
   • [punkt 2]
   • [punkt 3]

💡 Pełna odpowiedź w pliku powyżej
```