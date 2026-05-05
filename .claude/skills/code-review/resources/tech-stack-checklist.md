# Tech Stack Checklist

Checklisty do code review dla każdej technologii w projekcie.

---

## React 19

### Nowe API
- [ ] `use()` zamiast `useEffect` + `useState` dla async data
- [ ] `useFormStatus()` dla form loading states
- [ ] `useOptimistic()` dla optimistic updates
- [ ] `useActionState()` dla form actions (client-side)

### Usunięte/zmienione wzorce
- [ ] Brak `forwardRef` — ref to zwykły prop w React 19
- [ ] `<Context>` zamiast `<Context.Provider>`
- [ ] Brak `useContext` gdzie można użyć `use(Context)` — pozwala na warunkowe użycie (w if/loop), czego useContext nie obsługuje

### React Compiler (jeśli włączony)
- [ ] Brak ręcznych `useMemo` (compiler optymalizuje automatycznie)
- [ ] Brak ręcznych `useCallback` (compiler optymalizuje automatycznie)
- [ ] Brak `React.memo` wrapperów (compiler decyduje o memoizacji)

### Rendering
- [ ] Suspense boundaries dla async components
- [ ] Brak niepotrzebnych renderów
- [ ] Stan na odpowiednim poziomie (lifting vs colocation)
- [ ] Keys w listach są stabilne i unikalne

### Forms
- [ ] Native form actions gdzie możliwe
- [ ] `formAction` prop na `<button>`
- [ ] React Hook Form + zodResolver jako domyślne podejście
- [ ] Native form actions jako alternatywa dla prostych formularzy

---

## Async / Race Conditions

### useEffect cleanup
- [ ] useEffect z async ma AbortController w cleanup
- [ ] setTimeout/setInterval ma clearTimeout/clearInterval w useEffect return
- [ ] requestAnimationFrame loop sprawdza cancel flag
- [ ] WebSocket / EventSource zamykany w cleanup
- [ ] IntersectionObserver / MutationObserver disconnected w cleanup
- [ ] Supabase realtime subscription unsubscribed w cleanup

### State management
- [ ] Więcej niż 1 boolean ładowania = discriminated union / state machine
- [ ] Operacje wzajemnie wykluczające się mają guard (nie ładuj kolejnego preview jeśli poprzedni trwa)
- [ ] Promise.allSettled dla równoległych operacji które mogą niezależnie failować

### Async patterns
- [ ] Promise.finally() do cleanup zamiast duplikacji w resolve/reject
- [ ] Brak fire-and-forget promises (każdy promise obsłużony lub świadomie zignorowany z komentarzem)
- [ ] Brak floating promises w event handlerach (`.catch()` lub `void`)

---

## Supabase

### RLS (Row Level Security)
- [ ] Polityki RLS włączone na wszystkich tabelach
- [ ] Polityki SELECT/INSERT/UPDATE/DELETE zdefiniowane osobno
- [ ] Brak tabel z wyłączonym RLS w produkcji

### Auth
- [ ] Sprawdzenie `auth.uid()` w politykach RLS
- [ ] Weryfikacja sesji przed operacjami na danych
- [ ] Brak bezpośrednich operacji bez sprawdzenia auth

### Error handling
- [ ] Obsługa błędów z odpowiedzi Supabase (`error` sprawdzany po każdym zapytaniu)
- [ ] Rozróżnienie błędów auth vs database vs network
- [ ] Sensowne komunikaty błędów dla użytkownika

### Typy
- [ ] Typy TypeScript generowane ze schematu bazy (`supabase gen types`)
- [ ] Typy używane w całej aplikacji (brak `any` przy operacjach DB)
- [ ] `Database` type używany w kliencie Supabase

### Edge Functions
- [ ] Service role key używany tylko w Edge Functions (nigdy po stronie klienta)
- [ ] Walidacja inputów w Edge Functions (Zod)
- [ ] Proper error responses (status codes + JSON body)

---

## Sentry

### Capture
- [ ] Wszystkie bloki `catch` raportują do Sentry (`Sentry.captureException`)
- [ ] Proper error levels: `fatal` / `error` / `warning` używane adekwatnie
- [ ] Brak zgłaszania oczekiwanych błędów (np. walidacja formularza)

### GDPR / Prywatność
- [ ] Maskowanie emaili w `beforeSend` callback
- [ ] Brak danych wrażliwych w kontekście Sentry (hasła, tokeny, PII)
- [ ] `beforeBreadcrumb` filtruje wrażliwe URL-e i dane

### Error Boundary
- [ ] `Sentry.ErrorBoundary` opakowuje aplikację
- [ ] Fallback UI wyświetlany przy crashu
- [ ] `componentStack` raportowany z błędem

### Kontekst
- [ ] `Sentry.setUser()` po zalogowaniu (tylko ID, bez PII)
- [ ] `Sentry.setTag()` dla kluczowych metadanych (environment, feature)
- [ ] Brak danych wrażliwych w `Sentry.setExtra()` / `Sentry.setContext()`

---

## React Data Fetching (React Query)

### useQuery
- [ ] `useQuery` / `useSuspenseQuery` do pobierania danych (nie `useEffect` + `fetch`)
- [ ] `queryKey` ma prawidłową strukturę (hierarchiczną, z parametrami)
- [ ] `staleTime` skonfigurowane odpowiednio do typu danych
- [ ] `queryFn` nie łamie zasad hooks

### Stany
- [ ] Loading state obsłużony (`isLoading` / `isPending`)
- [ ] Error state obsłużony (`isError` + `error`)
- [ ] Empty state obsłużony (dane puste ale nie error)
- [ ] Placeholder/skeleton podczas ładowania

### Mutacje
- [ ] `useMutation` do operacji zapisu
- [ ] `onSuccess` invaliduje powiązane queries (`queryClient.invalidateQueries`)
- [ ] Optimistic updates gdzie UX tego wymaga (`onMutate` + `onError` rollback)
- [ ] Error handling w `onError` callback

### Performance
- [ ] Deduplikacja zapytań (ten sam `queryKey` nie fetchuje wielokrotnie)
- [ ] `enabled` flag do warunkowego fetchowania
- [ ] `select` do transformacji danych (unikanie re-renderów)

---

## Tailwind CSS 4

### Konfiguracja (v4 breaking change)
- [ ] Konfiguracja przez blok `@theme` w CSS (nie `tailwind.config.js`)
- [ ] Zmienne CSS definiowane w `@theme { }` lub `:root { }`
- [ ] Import Tailwind przez `@import "tailwindcss"` w CSS
- [ ] Brak starego `tailwind.config.js` (lub świadoma migracja)

### Klasy
- [ ] Uporządkowane (prettier-plugin-tailwindcss)
- [ ] Brak przestarzałych utility classes
- [ ] Brak `@apply` — kompozycja w React zamiast tego
- [ ] Unikanie arbitrary values (`w-[123px]`) — preferuj tokeny z design systemu

### Theming
- [ ] Zmienne CSS w bloku `@theme`
- [ ] Dark mode obsłużony (`dark:`)
- [ ] Spójne spacing, colors, typography
- [ ] `field-sizing: content` dla auto-growing textarea (zamiast JS hacków)

### Responsive
- [ ] Mobile-first approach
- [ ] Breakpointy używane konsekwentnie
- [ ] Testowane na różnych rozmiarach

### Komponenty
- [ ] Radix UI stylowany spójnie
- [ ] Hover/focus/active states zdefiniowane
- [ ] Transitions dla interakcji

---

## shadcn/ui / Radix UI

### Użycie
- [ ] Odpowiedni komponent (Dialog vs AlertDialog, etc.)
- [ ] Prawidłowa kompozycja (Root, Trigger, Content)
- [ ] Portal używany dla overlays

### Accessibility
- [ ] `aria-label` gdzie brak widocznego tekstu
- [ ] `aria-describedby` dla opisów
- [ ] Focus trap w modalach
- [ ] Escape zamyka overlay

### Styling
- [ ] `data-state` używane do stylowania stanów
- [ ] Animacje przez CSS/Tailwind
- [ ] Spójne z resztą UI

### Icons (Lucide)
- [ ] Spójny rozmiar (np. `size={20}`)
- [ ] `aria-hidden` lub `aria-label`
- [ ] Stroke width konsekwentny

---

## TypeScript

### Typy
- [ ] Brak `any` (użyj `unknown` jeśli trzeba)
- [ ] Interfejsy/typy eksportowane gdzie potrzeba
- [ ] Props komponentów typowane
- [ ] Return types dla funkcji (explicit lub inferred)

### Strict mode
- [ ] `strictNullChecks` respektowane
- [ ] Brak `!` (non-null assertion) bez uzasadnienia
- [ ] Optional chaining (`?.`) zamiast `&&`

### Imports
- [ ] Type imports (`import type { X }`)
- [ ] Brak circular dependencies
- [ ] Path aliases używane konsekwentnie (`@/`)

---

## Bezpieczeństwo

### Input
- [ ] Walidacja Zod na operacjach zapisu
- [ ] Sanityzacja danych użytkownika
- [ ] Parametryzowane zapytania (Supabase domyślnie)

### Auth/Authz
- [ ] Sprawdzenie `supabase.auth.getUser()` przed operacją
- [ ] Polityki RLS wymuszają dostęp per-user
- [ ] Brak danych innych użytkowników (RLS + sprawdzenie w kodzie)
- [ ] Sprawdzenie uprawnień przed operacją

### Secrets
- [ ] Brak hardcoded secrets
- [ ] Env variables przez `import.meta.env`
- [ ] `.env` w `.gitignore`

### Output
- [ ] Brak XSS (React domyślnie escapuje)
- [ ] `dangerouslySetInnerHTML` tylko z sanityzowanym contentem (DOMPurify)
- [ ] Error messages nie zdradzają internals

---

## Wydajność

### Bundle
- [ ] Dynamic imports dla dużych komponentów
- [ ] `React.lazy()` z `<Suspense fallback={...}>` dla lazy loading
- [ ] Tree shaking działa (named imports)

### Images
- [ ] `<img>` z `loading="lazy"` dla obrazów poniżej fold
- [ ] `fetchpriority="high"` dla obrazów above-the-fold (LCP)
- [ ] Width/height zdefiniowane (zapobieganie layout shift)
- [ ] Formaty next-gen (WebP/AVIF) gdzie możliwe

### Lists
- [ ] Wirtualizacja dla długich list (>100 items)
- [ ] Pagination/infinite scroll
- [ ] Stable keys

---

## Dostępność (a11y)

### Interactive elements
- [ ] Touch targets min 44x44px
- [ ] Focus visible (outline)
- [ ] Keyboard navigation działa

### Semantics
- [ ] Headings w hierarchii (h1 → h2 → h3)
- [ ] Landmarks (`main`, `nav`, `aside`)
- [ ] Labels dla form inputs

### ARIA
- [ ] `aria-label` dla icon buttons
- [ ] `aria-live` dla dynamicznych treści
- [ ] `role` gdzie semantyczny HTML nie wystarczy

### Visual
- [ ] Kontrast WCAG 2.2 AA (4.5:1 text, 3:1 UI)
- [ ] Nie tylko kolor przekazuje informację
- [ ] Animacje respektują `prefers-reduced-motion`
