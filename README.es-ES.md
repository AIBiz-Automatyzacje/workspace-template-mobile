

# Workspace Template Mobile

> Starter valorado de Claude Code para product engineering **mobile** en el stack **Expo (React Native) + TypeScript + Supabase + NativeWind**.
> Catálogo completo `.claude/` (skills, agentes, workflows, reglas, hooks) + pipeline `dev-*` desde la idea hasta el despliegue — con auto-piloto autónomo, code review multi-agente, E2E en emulador vía Maestro y acumulación de conocimiento.

**Última actualización:** 2026-07-12 · **Repo:** `AIBiz-Automatyzacje/workspace-template-mobile` · Variante web: [`claude-code-starter`](https://github.com/AIBiz-Automatyzacje/claude-code-starter)

---

## Inicio rápido

Clona → copia el catálogo `.claude/` a tu proyecto Expo → tienes un sistema de trabajo listo y coherente con Claude Code.

```bash
npx degit AIBiz-Automatyzacje/workspace-template-mobile/.claude .claude
```

O sin terminal — pega en tu asistente AI:

```
Descarga la carpeta `.claude/` desde la rama main del repo
https://github.com/AIBiz-Automatyzacje/workspace-template-mobile
y cópiala al directorio principal de mi proyecto. Si `.claude/` ya
existe, muéstrame primero el diff y espera confirmación. Al final
resume qué se instaló (skills/agentes/hooks/workflows).
```

Lo que obtienes:

- **Pipeline `dev-*`** — desde la ideación, pasando por el plan, hasta la implementación autónoma con revisión y correcciones (`dev-autopilot-wf`).
- **Skills `expo-*` / `eas-*`** — 13 skills oficiales de Expo (upstream: [`expo/skills`](https://github.com/expo/skills), convención `expo-*` = framework OSS, `eas-*` = servicio pago EAS) + hub `expo-overview` con decision tree.
- **Skills técnicos** para el stack — Supabase, UX/UI mobile (iOS HIG vs Material 3), seguridad (OWASP + Mobile Top 10), Sentry, Maestro E2E, EAS Update.
- **15 agentes especializados** — builders de capas mobile, revisores, tester E2E, investigación.
- **Acumulación de conocimiento** — problemas resueltos (`docs/solutions/`), reglas (`learned-patterns.md`) y diccionario de dominio vivo (`docs/CONCEPTS.md`).
- **Reglas de codificación** y catálogo de anti-patrones AI (`.claude/rules/coding-rules.md`).

---

## Bonus: Output Style „adhd"

¿Cansado de respuestas demasiado verbosas? En [`output-styles/adhd.md`](output-styles/adhd.md) encontrarás
un Output Style listo que hace que Claude empiece con lo concreto en lugar de una pared de texto.
Escrito según las directrices de Anthropic para los modelos de la serie 5 (cero prohibiciones — objetivo descrito,
el resto lo deduce el modelo). Inspiración: skill [i-have-adhd](https://github.com/ayghri/i-have-adhd)
del hilo viral en r/ClaudeAI.

1. Copia `output-styles/adhd.md` a la carpeta `.claude/output-styles/` en tu proyecto
   (o a `~/.claude/output-styles/` de forma global).
2. Reinicia la sesión de Claude Code.
3. Escribe `/config`, selecciona **Output style → adhd** y confirma con enter.

---

## Changelog

| Fecha | Cambio |
|------|--------|
| **2026-08-03** | **Port de mejoras desde `claude-code-starter` (web, commits `eb5ad6c..cc29eb5`):** **routing de revisores v2 (dominio)** — flags de capas desde el context-packager en lugar del umbral „≤2 archivos" (núcleo security/spec/simplicity/test siempre; perf/arch/ts/E2E condicionalmente, fail-open sin flags; E2E con segunda puerta para checkboxes `[E2E]`), sección `## Flujo de review` en el reporte + métricas de routing/dedupe/verify en el estado y telemetría, **blocs LÍMITES DE CONFIANZA** (scripts de migración/ETL/seed = límite de API; también en `security-sentinel` y `coding-rules §9`) y **LÍMITE P3** (máx. 5 nits accionables por revisor), **volcado del diff de la fase como artefacto** (el packager escribe a /tmp, los revisores leen 1 Readme), **recuperación del scribe** (inspector de disco tras fallo — reporte completo = no repetimos el review), **guard de archivos binarios tras fix** (bytes de control crudos en archivo fuente = STOP en lugar de serie de APIError), **tokens por etapa** (execute/review/fix por separado) y telemetría de toda la tarea (fases de runs anteriores desde el estado). Nuevos skills: **`sync-template`** (actualización de `.claude/` desde el template en proyectos hijo), **`coderabbit-setup`** (review AI de PRs), Output Style **`adhd`**. **Sync `expo/skills`:** housekeeping de links a docs versionados en `expo-upgrade`, referencia a `expo-migrate-module` en `expo-module`, nuevo skill **`expo-project-structure`** (estructura greenfield). |
| **2026-07-12** | **Port de mejoras desde `claude-code-starter` (web):** diccionario de dominio `docs/CONCEPTS.md` (writer en `dev-compound`, readers en plan/docs/builders, `compound-refresh` scoped en autopiloto), auditoría de skills técnicos (OWASP Top 10:2025, `user_metadata` → regla en `coding-rules §9`, Stripe v22, `search_path=''`, Sentry Deno 2.x, `getClaims()`), **8. revisor** (`code-simplicity-reviewer`) + **routing de revisores según mapa de cambios** + **dedup semántico (Haiku)** en review-wf, **targeted verify P1/KOD tras fix**, retry del scribe + flag `scribeFail`, warmup degrada en lugar de STOP, readers `learned-patterns.md` (planner/revisores/builders), auditoría console.log/Sentry en cierre de fase, semántica RESUME correcta (run fresco tras STOP de puerta vs resume tras fallo), skills `/dev-docs-execute`+`/dev-docs-review` = wrappers delgados para workflows, `web-research-specialist` en brainstorm/ideate, eliminado `auto-error-resolver` contaminado, skill local `figma-design-to-code` (nombre anterior no existía), ruta unificada `docs/brainstorms/`, **`/freshness-audit`** (auditoría cíclica de vigencia de skills en fuentes vivas; `expo-*` fuera de alcance — upstream-owned), telemetría de runs del autopiloto (`~/.claude/telemetry/autopilot-runs.jsonl`), campo `paths` en skills de guía. **Sync de skills Expo con upstream tras reorganización `expo/skills` (2026-07-07, PR #98):** nueva convención de nombres `expo-*`/`eas-*` (ej. `expo-building-native-ui`→`expo-native-ui`, `expo-native-data-fetching`→`expo-data-fetching`, `expo-api-routes`→`eas-hosting`, `expo-deployment`→`eas-app-stores`, `expo-cicd-workflows`→`eas-workflows`, `expo-upgrading`→`expo-upgrade`, `expo-use-dom`→`expo-dom`, `expo-ui-swift-ui`+`expo-ui-jetpack-compose`→`expo-ui`), **nuevo skill `expo-router`** (navegación), actualización de contenido de todos los skills al estado upstream, descripciones en polaco conservadas. |
| 2026-06-24 | Cerrados tres falsos positivos por los que el autopiloto omitía silenciosamente E2E; antes: flujo Maestro + seed como deliverables del builder, puerta opt-in E2E (STOP duro en lugar de omisión silenciosa). |
| 2026-06-11 | **E2E autónomo en el autopiloto** — entorno gestionado con `.env.e2e` (proyecto Supabase e2e dedicado, Metro + simulador con dev-client, seeds por fase). |
| 2026-06-09 | **Reconstrucción de 4 pilares tras auditoría (27 hallazgos)** + smoke-harness: estado máquina `.autopilot-state.json`, BLOQUE de comandos largos (watchdog), puertas calculadas en JS, `.claude/templates/smoke-autopilot/`. |
| 2026-06-04 | Sincronización del pipeline con el template web: revisor spec-compliance, frames de ideación, reglas TDD (tracer bullets), regla seam. |
| 2026-05-31 | Dev Autopilot como **Dynamic Workflows** (`.claude/workflows/*-wf.js`) — mobile fue el primero; web adoptó este modelo el 2026-06-21. |
| 2026-05-20 | Sync de skills Expo con upstream (`expo/skills @ main`): + `expo-api-routes`, re-sync `expo-module`. |
| 2026-05-11 | Skill `ux-ui-guidelines-mobile` (investigación: Apple/Google oficial, Hoober, teardowns de apps premium); `sentry-integration` en builders mobile. |
| 2026-05-05 | Separación del template mobile desde `workspace-template` (web → Expo + EAS + Maestro). |

---

## Pipeline `dev-*` — vista general

```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs → [ dev-autopilot-wf ] → listo
  (ideas)       (QUÉ construir)    (CÓMO)      (estructura)   (pipeline auto completo)

dev-autopilot-wf orquesta:
  bootstrap → por fase( execute-wf → review-wf + adversarial verify → fix ) → compound-wf → compound-refresh(scoped) → complete-wf
```

Reglas generales:
- Los skills `dev-*` **funcionan SIN argumentos** (extraen contexto de la sesión). Los argumentos son opcionales.
- La fase de implementación es dirigida por defecto por **`dev-autopilot-wf`** (dynamic workflow). Los skills `/dev-docs-execute` y `/dev-docs-review` también puedes ejecutarlos manualmente, fase a fase.

### Dynamic Workflows (`-wf`)

Orquestadores deterministas en JavaScript en `.claude/workflows/*.js` (sufijo `-wf` para evitar colisiones de nombres con skills). El orquestador mantiene el plan y el control en código, mientras los builders/revisores son **leaf-agents** llamados vía `agentType`.

| Workflow | Qué hace |
|----------|---------|
| `dev-autopilot-wf` | Pipeline autónomo: bootstrap (estado desde `.autopilot-state.json` + calentamiento cache de tests + entorno E2E) → por fase (execute → review + adversarial verify → fix + targeted verify P1) → compound → **compound-refresh (scoped)** → complete → **telemetría** (1 línea JSONL a `~/.claude/telemetry/autopilot-runs.jsonl` global). |
| `dev-docs-execute-wf` | Ejecución de UNA sola fase: planner lee Implementation Units desde `docs/plans/`, builders `feature-builder-mobile-*` los implementan vía `agentType`, luego validación + commit + actualización de docs. |
| `dev-docs-review-wf` | Revisión de una fase: context-packager → routing de revisores según mapa de cambios (núcleo siempre; perf/arquitectura condicional en fases pequeñas) → hasta 8 revisores en paralelo (incluyendo E2E Maestro) → dedup 2-pases (JS + semántico Haiku) → adversarial verify P1/P2 → scribe guarda reporte + bookkeeping de checkboxes `Weryfikacja:` → severity gate. |
| `dev-docs-complete-wf` | Archivado: `docs/active/<tarea>` → `docs/completed/`, resumen, actualización de docs del proyecto, commit. |
| `dev-compound-wf` | Documenta problemas resueltos a `docs/solutions/`, evalúa rule-worthy a `learned-patterns.md`, actualiza `docs/CONCEPTS.md`. |
| `freshness-audit-wf` | Auditoría cíclica de vigencia de skills técnicos: afirmaciones sobre el mundo (versiones, pines, patrones API) → verificación en fuentes **vivas** (docs, changelogs de GitHub, npm — prohibido usar memoria del modelo) → adversarial verify P1/P2 → reporte a `docs/reviews/freshness-<fecha>.md`. No modifica los skills. Skills `expo-*` fuera de alcance (upstream-owned). |

**Cómo ejecutarlo:** con la herramienta `Workflow`, ej. `Workflow({scriptPath: ".claude/workflows/dev-autopilot-wf.js"}, args)`.
**RESUME tras un run interrumpido:** `Workflow({scriptPath, resumeFromRunId})` + **SIEMPRE pasa `args` nuevamente** (no sobreviven entre llamadas). Tras un **STOP de puerta** (entorno E2E, fix FALLIDO, P1 sin resolver), cuando hayas corregido algo — **run nuevo sin resume** (el estado de fases se reanudará desde `.autopilot-state.json`; resume devolvería el fallo de la puerta desde el cache).

---

## Skills — lista completa

### Pipeline `dev-*`

#### Discovery

**`/dev-ideate`** — generación de ideas para mejoras. Agentes escanean el proyecto desde diferentes perspectivas (+ grounding externo opcional vía `web-research-specialist`), Devil's Advocate filtra las débiles. → `docs/ideation/`

**`/dev-brainstorm`** — validación de la idea (**QUÉ** construir). Diálogo interactivo: una pregunta a la vez, test de presión, exploración de enfoques, investigación opcional de prior art. → `docs/brainstorms/*-requirements.md`

#### Planificación

**`/dev-plan`** — planificación técnica (**CÓMO** construir). Busca requisitos en `docs/brainstorms/`, escanea el repo con agentes de investigación, crea Implementation Units (Goal, Files, Approach, Test scenarios, Verification). Lee `docs/CONCEPTS.md`. Para escenarios `[E2E]` aplica convención de harness gestionado (§3.4b): flujo `.maestro/<flow>.yaml` + seed idempotente como deliverables del **builder**, límites de Maestro (superficies nativas del OS → inject vía service_role o `[Manual]`). → `docs/plans/`

**`/dev-docs`** — estructura de gestión de tareas. Crea rama `feature/[nombre]` + 3 archivos en `docs/active/[nombre]/` (plan, contexto, tareas). Importa contexto de diseño (SPEC.md/DESIGN.md/Figma) a `kontekst.md`.

#### Implementación

**`dev-autopilot-wf docs/active/[nombre]`** *(workflow, ruta predeterminada)* — ejecución automática de TODAS las fases con review y correcciones. Bootstrap prepara el entorno E2E (si existe `.env.e2e`: **STOP duro** hasta que Metro + simulador con dev-client estén listos — en lugar de degradación silenciosa de E2E a OPERATOR).
- **Condiciones de parada:** P1 tras ciclo de fix (límite fix = 1; cada P1/KOD tras fix pasa adicionalmente **targeted verify independiente**), error de build/tests, scribe falló 2x, entorno E2E no listo con opt-in.
- **Truco:** validas la rama **en la sesión ANTES** de ejecutar — el workflow no pregunta por cambio de rama.

**`/dev-docs-execute docs/active/[nombre]`** *(workflow: `dev-docs-execute-wf`)* — ejecución de una fase. Cada IU delegada vía `agentType` (campo `Delegate to:`): `feature-builder-mobile-ui` | `feature-builder-mobile-data` | `feature-builder-mobile-fullstack`. Para IUs que tocan UI se adjunta contexto de diseño obligatorio (1pt Figma = 1px NativeWind).

**`/dev-docs-review docs/active/[nombre] [fase]`** *(workflow: `dev-docs-review-wf`)* — code review de fase: hasta **8 revisores en paralelo** (Security, Performance, Arquitectura, TypeScript, Spec-compliance, Simplicity/YAGNI, Test-coverage, E2E Maestro) → dedup → **adversarial verify** P1/P2 (**P1 = 3 escépticos, P2 = 1**) → scribe + severity gate.
- **Truco E2E:** `feature-tester-mobile-e2e` prueba en **emulador** (Maestro CLI) vía Metro basado en `.env.e2e`. Recopila checkboxes `[E2E]` de AMBOS prefijos (`Test:` + `Weryfikacja:`). Con `figma_screens` hace visual diff lado a lado con mockups. Sin `.env.e2e`, las verificaciones E2E caen como OPERATOR.

**`/dev-docs-update docs/active/[nombre]`** — guarda estado antes de compactar contexto.

#### Cierre y captura de conocimiento

**`/dev-docs-complete [nombre]`** — archivado de tarea completada → `docs/completed/`.

**`/dev-compound`** — documentación de problema resuelto → `docs/solutions/[category]/`. Rule-worthy → `learned-patterns.md`; término de dominio → `docs/CONCEPTS.md` (Paso 4.5).

**`/dev-compound-refresh`** — revisión de vigencia de la base de conocimiento (Keep / Update / Replace / Archive; dedup `learned-patterns.md` y `CONCEPTS.md`). En el autopiloto se ejecuta **automáticamente, pero scoped**.

### Skills `expo-*` / `eas-*` (upstream-owned)

14 skills del repo oficial **[`expo/skills`](https://github.com/expo/skills)** (estado tras reorganización upstream 2026-07-07: `expo-*` = framework OSS, `eas-*` = servicio pago EAS) + descripciones en polaco en frontmatter (nuestra única capa local). **No modificamos su contenido manualmente** — actualización exclusivamente vía sync diff con upstream (omitimos carpetas `agents/` y secciones „Submitting Feedback" con telemetría upstream).

Hub: **`expo-overview`** (decision tree: qué skill elegir) → `expo-project-structure`, `expo-native-ui`, `expo-router`, `expo-tailwind-setup`, `expo-data-fetching`, `expo-ui`, `expo-dev-client`, `expo-module`, `expo-dom`, `expo-upgrade`, `eas-app-stores`, `eas-workflows`, `eas-hosting`, `eas-update-insights`.

En el upstream también hay skills no importados (nicho fuera del flujo core): `expo-brownfield`, `expo-app-clip`, `expo-web-to-native`, `expo-examples`, `eas-simulator`, `eas-observe`, `expo-skill-feedback` y plugin `expo-experiments` (incl. `expo-migrate-module`).

### Skills técnicos (guías para el stack)

| Skill | Alcance |
|-------|--------|
| **`supabase-dev-guidelines`** | Auth (OAuth vía deep linking `yourapp://`, PKCE con exchange explícito), `expo-secure-store` como storage de sesión, PostgreSQL, RLS (`(SELECT auth.uid())`), SECURITY DEFINER (`search_path=''`), Edge Functions (Deno, Stripe v22), Realtime + ciclo AppState, offline-first. |
| **`ux-ui-guidelines-mobile`** | iOS HIG vs Material 3, tipografía nativa (SF Pro/Roboto, Dynamic Type), grid 8pt + safe areas, dark mode, motion (Reanimated 3), haptics, FlashList, bottom sheets, accesibilidad (VoiceOver/TalkBack), trampas de UI generado por AI, teardowns de apps premium. |
| **`security`** | Auditoría de seguridad mobile: **OWASP Top 10:2025 + Mobile Top 10 (2024)**, RLS, `app_metadata` vs `user_metadata`, secretos en bundle (`EXPO_PUBLIC_*` ¡es público!), SecureStore, deep linking, WebView. |
| **`sentry-integration`** | Seguimiento de errores para React Native + Edge Functions (Deno 2.x): `beforeSend`, `withScope`, `defaultIntegrations: false`, enmascaramiento GDPR. |
| **`mobile-e2e-maestro`** | E2E en emulador vía Maestro CLI: tap/scroll/gestos, deep linking, aserciones, screenshots, **límites de capacidades** (no toca superficies nativas del OS — inject vía service_role). |
| **`eas-update-insights`** | Health check de actualizaciones OTA de EAS: crash rate, conteos install/launch, embedded vs OTA por channel. |
| **`code-quality`** | Auditoría de calidad (agnóstico al stack): arquitectura, performance, simplicidad (YAGNI), patrones. |
| **`code-review`** | Code review para el stack — reporte con clasificación de problemas. |
| **`bugfix`** | Corrección sistemática de bugs (Sentry, E2E fallidos, reportes). |

### Skills de herramientas

| Skill | Para qué |
|-------|----------|
| **`figma-design-to-code`** | Implementación del diseño de Figma como código (design→code). Importado localmente desde el plugin oficial de Figma — funciona también sin el plugin. Precargado en builders UI/fullstack. |
| **`sync-template`** | Actualización del motor `.claude/` desde este repo template en proyectos hijo (clone → diff SHA → backup → apply; „el template siempre gana", archivos locales del proyecto intactos). |
| **`coderabbit-setup`** | Genera `.coderabbit.yaml` para el stack del proyecto (Expo/RN, Supabase…) + verifica instalación de la app GitHub CodeRabbit — AI review de cada PR. |
| **`zroastuj-mnie`** | Entrevista de estrés implacable para testear plan/proyecto; sugiere fijar términos a `docs/CONCEPTS.md`. |
| **`gemini`** | Gemini CLI como subagente (segunda opinión: análisis de código, auditoría UX/security). |
| **`freshness-audit`** *(workflow: `freshness-audit-wf`)* | Auditoría cíclica de vigencia de skills técnicos en fuentes **vivas**. Ejecuta periódicamente (ej. una vez al mes). `expo-*` fuera de alcance — su frescura depende del sync con upstream. |
| **`dev-autopilot`** *(legacy)* | Orquestación manual del pipeline. La ruta predeterminada es `dev-autopilot-wf`. |

---

## Agentes — lista completa (15)

### Builders de capas mobile (llamados por `dev-docs-execute-wf`)

| Agente | Función |
|-------|---------|
| `feature-builder-mobile-ui` | Capa UI: componentes RN, Expo Router, NativeWind, tabs nativos, Reanimated, VoiceOver/TalkBack. Lee contexto de diseño + `docs/CONCEPTS.md` + `learned-patterns.md`. |
| `feature-builder-mobile-data` | Capa de datos: queries Supabase con storage seguro mobile-aware, RLS, migraciones, Zod, Edge Functions, deep linking OAuth. |
| `feature-builder-mobile-fullstack` | Cross-layer (UI + datos a la vez): formularios con auth + deep linking, pantallas con fetch, CRUD end-to-end. |

### Revisores y tester (llamados por `dev-docs-review-wf` — hasta 8 en paralelo)

| Agente | Función |
|-------|---------|
| `security-sentinel` | Auth, RLS, exposición de secretos, validación Zod, OWASP. |
| `performance-oracle` | N+1, tamaño de bundle, memoización, cleanup `useEffect`. |
| `kieran-typescript-reviewer` | Seguridad de tipos, sin `any`, patrones modernos. |
| `architecture-strategist` | SOLID, límites de capas, coupling, deps circulares. |
| `spec-flow-analyzer` | Cumplimiento con spec/plan IU: under-implementation, scope creep, implementación incorrecta. |
| `code-simplicity-reviewer` | YAGNI, complejidad innecesaria, código muerto. |
| `feature-tester-mobile-e2e` | E2E en emulador (Maestro) — checkboxes `[E2E]`, visual diff con Figma. |

> Test-coverage en review-wf cubre el agente por defecto (happy path, inputs inválidos, boundary, tests faltantes).

### Investigación (llamados por `dev-plan`, `dev-brainstorm`, `dev-ideate`)

| Agente | Función |
|-------|---------|
| `repo-research-analyst` | Estructura del repo, convenciones, patrones de implementación. |
| `learnings-researcher` | Busca en `docs/solutions/` + `docs/CONCEPTS.md` hallazgos relacionados. |
| `best-practices-researcher` | Mejores prácticas online (Context7, WebSearch). |
| `framework-docs-researcher` | Documentación de frameworks/libs, versiones, limitaciones. |
| `web-research-specialist` | Investigación iterativa en la web — prior art, patrones de competencia. |

---

## Diccionario de dominio — `docs/CONCEPTS.md`

Glosario vivo de conceptos con significado **específico para el proyecto** (entidades, procesos nombrados, status/enum con sentido custom). Formato: **índice delgado** — `## Término` + 1-2 frases + link a detalles en `CLAUDE.md`.

- **Alimentado** por `/dev-compound` (Paso 4.5).
- **Leído** por `dev-plan`, `dev-docs`, builders y `learnings-researcher` — para no „arreglar" comportamiento en contra de las definiciones.
- **Mantenido** por `/dev-compound-refresh` (dedup, eliminación de entradas muertas).

---

## Reglas, hooks, plantillas

- **`.claude/rules/coding-rules.md`** — 14 secciones de reglas + **catálogo de 10 anti-patrones AI**. Cargados en cada sesión.
- **`.claude/rules/learned-patterns.md`** — reglas producidas por `/dev-compound` (por proyecto, límite ~50).
- **`.claude/hooks/`** — `mobile-anti-pattern-check.sh`, `error-handling-reminder.sh`, `stop-build-check-enhanced.sh`.
- **`.claude/templates/e2e-env/`** — entorno E2E opcional (Maestro en proyecto Supabase e2e dedicado). Opt-in vía `.env.e2e`. Lecciones del campo: pooler en lugar de direct (IPv6), seeds completos.
- **`.claude/templates/smoke-autopilot/`** — smoke-test tras cada cambio en `.claude/workflows/*-wf.js`.

---

## Estructura de directorios

```
docs/
├── ideation/                 ← ideas de /dev-ideate
├── brainstorms/              ← docs de requisitos de /dev-brainstorm
├── plans/                    ← planes técnicos de /dev-plan
├── CONCEPTS.md               ← diccionario de dominio (vivo)
├── solutions/                ← problemas resueltos de /dev-compound
├── reviews/                  ← reportes de freshness-audit
├── active/                   ← tareas activas de /dev-docs
│   └── [nombre]/  { plan.md · kontekst.md · zadania.md · .autopilot-state.json }
└── completed/                ← archivadas de /dev-docs-complete

.maestro/                     ← flujo E2E (<flow>.yaml) + seeds (<flow>-seed.sql) + inject-*.js
```

---

## Escenarios típicos

**1. Autopiloto completo (recomendado para cambios mayores)**
```
/dev-brainstorm pantalla de onboarding        ← aclara QUÉ
/dev-plan                                     ← plan técnico (IU)
/dev-docs                                     ← estructura de tareas + rama
# valida la rama en la sesión, luego:
dev-autopilot-wf docs/active/onboarding       ← execute→review→fix→compound→refresh→complete
```

**2. Nuevo feature paso a paso (control manual)**
```
/dev-ideate → /dev-brainstorm → /dev-plan → /dev-docs
/dev-docs-execute docs/active/nombre
/dev-docs-review  docs/active/nombre 1
/dev-docs-complete nombre
```

**3. Bugfix con documentación**
```
/bugfix [descripción o link de Sentry]
/dev-compound
```

**4. Mantenimiento**
```
/dev-compound-refresh                         ← revisa la base de conocimiento
/freshness-audit                              ← auditoría de vigencia de skills (una vez al mes)
# sync de skills expo-*: diff desde github.com/expo/skills (conserva descripciones en polaco del frontmatter)
```

---

## Trucos y trampas (los más importantes)

- **Autopiloto: valida la rama ANTES de ejecutar** — el workflow no pregunta por cambio de rama.
- **RESUME solo tras fallo de un run** (siempre con los mismos `args`). Tras un **STOP de puerta** (entorno E2E, fix FAIL), cuando hayas corregido algo — **run nuevo sin `resumeFromRunId`**: resume devolvería el fallo de la puerta desde el cache; el estado de fases se reanudará desde `.autopilot-state.json`.
- **E2E es un emulador real** (Maestro), no una simulación — requiere Metro basado en `.env.e2e` + simulador con dev-client. Sin `.env.e2e`, verificaciones E2E → OPERATOR. **Metro manual en `.env.local` sabotea el run** (la app apunta a dev en lugar de e2e).
- **Maestro no controla superficies nativas del SO** (picker de fotos, cámara, share sheet, Alert nativo, biometría) — inyecta datos vía service_role (`runScript: .maestro/inject-*.js`, GraalJS: binarios inline, no ruta de archivo), confirm nativo → `[Manual]`.
- **`EXPO_PUBLIC_*` es público en el bundle** — solo clave anónima y URLs explícitas; claves pagas para Edge Function (o API route — skill `eas-hosting`).
- **Límite de ciclo de fix = 1** — tras el fix, cada P1/KOD pasa **targeted verify independiente** (verificador checkea código, no self-report del fix).
- **No autorices con base en `user_metadata`** (Supabase) — editable por el usuario; usa `app_metadata` o tabla de roles (regla en `coding-rules §9`).
- **Tras cada cambio en `.claude/workflows/*-wf.js`** ejecuta smoke-test desde `.claude/templates/smoke-autopilot/`.
- **Los skills `expo-*` son upstream-owned** — no edites su contenido; actualiza vía sync con `expo/skills`.

---

## Licencia

MIT.
