#!/bin/bash

# Mobile Anti-Pattern Check
# Hook Stop — sprawdza czy w zmienionych plikach nie ma webowych wzorcow,
# ktore nie dzialaja w React Native (Expo).
#
# Wykrywa:
#   - localStorage              -> expo-secure-store / AsyncStorage
#   - <div>, <span>, <button>,  -> View, Text, Pressable, TextInput, Link
#     <input>, <a>
#   - react-router(-dom)        -> expo-router
#   - useNavigate / useLocation -> useRouter / usePathname (expo-router)
#   - window. / document.       -> crash w RN (brak DOM)
#   - import.meta.env           -> process.env.EXPO_PUBLIC_*
#
# Exit codes: 0 = OK, 2 = blocking (Claude widzi stderr i kontynuuje prace).

set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR"

# Pobierz liste zmienionych plikow (staged + unstaged + untracked)
CHANGED_FILES=$(
    {
        git diff --name-only HEAD 2>/dev/null || true
        git diff --name-only 2>/dev/null || true
        git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u
)

if [ -z "$CHANGED_FILES" ]; then
    exit 0
fi

# Filtruj pliki TS/TSX, pomin testy, konfiguracje, declaration files
FILES=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx)$' \
    | grep -v '\.test\.' \
    | grep -v '\.spec\.' \
    | grep -v '\.d\.ts$' \
    | grep -v '\.config\.' \
    | grep -v 'node_modules' \
    || true)

if [ -z "$FILES" ]; then
    exit 0
fi

WARNINGS=""
WARNING_COUNT=0

# Helper: dopisz hity z grep do FILE_HITS z numerami linii
append_hits() {
    local hits="$1"
    local message="$2"
    if [ -z "$hits" ]; then
        return
    fi
    FILE_HITS="${FILE_HITS}\n     ${message}"
    while IFS= read -r line; do
        LINE_NUM=$(echo "$line" | cut -d: -f1)
        FILE_HITS="${FILE_HITS}\n        Linia ${LINE_NUM}"
    done <<< "$hits"
}

for file in $FILES; do
    [ -f "$PROJECT_DIR/$file" ] || continue

    FILE_HITS=""

    # localStorage / sessionStorage
    HITS=$(grep -nE '\b(localStorage|sessionStorage)\b' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "localStorage/sessionStorage -> uzyj expo-secure-store (sesja) lub AsyncStorage (cache):"

    # HTML primitives w JSX: <div>, <span>, <button>, <input>, <a >
    HITS=$(grep -nE '<(div|span|button|input|a)[ />]' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "HTML elementy -> uzyj RN: <View>, <Text>, <Pressable>, <TextInput>, <Link> (expo-router):"

    # react-router(-dom)
    HITS=$(grep -nE "from ['\"]react-router(-dom)?['\"]" "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "react-router -> uzyj 'expo-router':"

    # useNavigate / useLocation
    HITS=$(grep -nE '\b(useNavigate|useLocation)\s*\(' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "useNavigate/useLocation -> uzyj useRouter()/usePathname() z expo-router:"

    # window. / document. (crash w RN; pomija komentarze)
    HITS=$(grep -nE '\b(window|document)\.' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "window./document. -> crash w RN (brak DOM); usun lub guard 'Platform.OS === \"web\"':"

    # import.meta.env (Vite-only, nie istnieje w Metro/Expo)
    HITS=$(grep -nE 'import\.meta\.env' "$PROJECT_DIR/$file" \
        | grep -v '^\s*//' \
        | grep -v '^\s*\*' \
        || true)
    append_hits "$HITS" "import.meta.env -> uzyj process.env.EXPO_PUBLIC_*:"

    if [ -n "$FILE_HITS" ]; then
        WARNINGS="${WARNINGS}\n   ${file}${FILE_HITS}\n"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
done

if [ "$WARNING_COUNT" -gt 0 ]; then
    {
        echo ""
        echo "MOBILE ANTI-PATTERN CHECK: ${WARNING_COUNT} plik(ow) z webowymi wzorcami"
        echo ""
        echo -e "$WARNINGS"
        echo "React Native nie ma DOM ani Web API. Te wzorce crashuja apke na emulatorze."
        echo "Patrz skill expo-overview (sekcja 'Konwencje RN vs web')."
        echo ""
    } >&2
    exit 2
fi

exit 0
