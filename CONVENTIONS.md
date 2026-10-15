# Conventions

**This file is the single source of truth for how we write code in this project.**

It applies to every contributor and to **every coding agent, whatever the provider** — Claude Code, Cursor, Copilot, Codex, Windsurf, or a human with a text editor. If a tool's default style conflicts with this file, this file wins.

> **Enforcement over trust.** Every rule here that *can* be checked by a machine *is* checked by a machine, in pre-commit and in CI. A convention that depends on people remembering it is not a convention — it is a wish. If you find a rule below that is not enforced, that is a bug in our tooling; open an issue.

---

## 0. Agent instructions

Agent-facing instruction files at the repo root **must not restate these rules**. They point here:

```
CONVENTIONS.md        ← the source of truth (this file)
AGENTS.md             ← "Read CONVENTIONS.md before writing code." Cross-tool standard
CLAUDE.md             ← same one-liner, for Claude Code
.cursorrules          ← same one-liner, for Cursor
```

One place to change, many places to read. Duplicating the rules into each agent file guarantees they drift apart.

---

## 1. Language

| What | Language |
|---|---|
| Code: identifiers, functions, classes, modules | **English** |
| Comments and docstrings | **English** |
| Commit messages, branch names, PR titles | **English** |
| Test names | **English** |
| API fields, DB columns, config keys | **English** |
| Log messages | **English** |
| **Product copy: UI strings, labels, empty states** | **Spanish** |
| **Deliverables: `docs/`, technical report, deck** | **Spanish** |

The line is: **anything a machine reads is English; anything the client reads is Spanish.** The UI is Spanish because the users are a Mexican front office; the code is English because that is the language the ecosystem is written in and because it keeps us portable.

No Spanglish identifiers, ever. Not `calcular_stuff`, not `getLanzamientos`. Either `calculate_stuff` or nothing.

---

## 2. The domain glossary

This project has a real naming hazard: **the vendor data is PascalCase, our code is snake_case, and our UI is Spanish.** Three vocabularies for the same concept. Get this wrong and nobody can grep anything.

### 2.1 The boundary rule

```
raw layer      →  keep vendor names EXACTLY as delivered (RelSpeed, InducedVertBreak)
curated layer  →  normalized to our canonical snake_case names
API            →  canonical names, camelCase on the wire
UI             →  Spanish labels, mapped in one i18n file — never inline
```

Renaming happens **once**, at the raw→curated boundary, in `packages/contracts/mapping.py`. Nowhere else. If you find yourself writing `df["RelSpeed"]` outside the raw layer, you are in the wrong layer.

### 2.2 Canonical names

| Vendor (raw) | Canonical (code) | UI (Spanish) |
|---|---|---|
| `RelSpeed` | `release_speed` | Velocidad de salida |
| `SpinRate` | `spin_rate` | Spin rate |
| `SpinAxis` | `spin_axis` | Eje de giro |
| `InducedVertBreak` | `ivb` | IVB |
| `HorzBreak` | `horizontal_break` | Break horizontal |
| `Extension` | `extension` | Extensión |
| `RelHeight` | `release_height` | Altura de liberación |
| `RelSide` | `release_side` | Lado de liberación |
| `PlateLocHeight` | `plate_height` | Altura en el plato |
| `PlateLocSide` | `plate_side` | Lado en el plato |
| `AutoPitchType` | `pitch_type` | Tipo de lanzamiento |
| `PitcherThrows` | `pitcher_hand` | Mano del lanzador |
| `BatterSide` | `batter_hand` | Lado del bateador |
| `altitude_category` | `environment` | Entorno |
| `PitchUID` | `pitch_id` | — |
| — | `density_index` | Índice de Densidad |
| — | `stuff_plus` | Stuff+ |
| — | `stuff_plus_hh` | Stuff+ altitud extrema (`hh`: el bucket `Extreme Altitude`, cinco parques) |
| — | `altitude_tax` | Impuesto de Altitud |
| — | `altitude_seal` | Sello de Altitud |
| — | `altitude_trap` | Sufre en la altura (antes «Trampa de Altitud», cambiado el 14 oct) |

**`ivb` stays `ivb`**, not `induced_vertical_break`. It is the term of art; expanding it helps nobody and makes every line longer. Same for `xrv`.

**Sabermetric terms stay in English in the UI too** — Stuff+, whiff, break, chase, arsenal. That was a deliberate brand decision (`docs/02-DESIGN-BRIEF.md`), not an oversight.

### 2.3 The `+` problem

`Stuff+` cannot be an identifier. Fixed forms:

| Context | Form |
|---|---|
| Python / DB | `stuff_plus`, `location_plus`, `pitching_plus` |
| TypeScript | `stuffPlus` |
| JSON on the wire | `stuffPlus` |
| UI | `Stuff+` |

Never `stuffplus`, never `stuff_p`, never `sp`.

---

## 3. Python

**Tooling:** `uv` for dependencies, `ruff` for lint and format, `mypy --strict` for types, `pytest` for tests. No black, no isort, no flake8 — ruff does all of it and is one tool.

```python
# Modules and packages: snake_case, singular
packages/models/features/arsenal.py

# Functions: verb first, snake_case
def compute_density_index(...) -> pd.Series: ...
def translate_shape(...) -> TranslatedShape: ...

# Predicates read as a question
def is_in_strike_zone(...) -> bool: ...
def has_sufficient_sample(...) -> bool: ...

# Classes: PascalCase, nouns
class PitchShape: ...
class AltitudeTranslator: ...

# Constants: UPPER_SNAKE, module level, with the source of the number
MAGNUS_RATIO_EXTREME = 0.754   # measured, evidence.json → density.magnus_ratio
MIN_PITCHES_FOR_SCORE = 100    # product rule: below this we show "muestra insuficiente"

# Private: one leading underscore. No dunder name mangling
def _fit_baseline(...): ...
```

**Rules:**

1. **Type hints are mandatory** on every public function. `mypy --strict` runs in CI.
2. **No bare `except:`.** Catch the specific exception or let it raise.
3. **No mutable default arguments.** Ever.
4. **Docstrings on public functions**, Google style, and they say *why* — the *what* is in the signature.
5. **Magic numbers carry their provenance in a comment.** `0.754` without `# measured, evidence.json` is a bug waiting to happen.
6. **Pure functions in `packages/core/`.** No I/O, no globals, no reading files. That is what makes it testable and portable.
7. **Pandas: no chained assignment, no `inplace=True`.** Return new frames.
8. **f-strings only.** No `%` and no `.format()`.

---

## 4. TypeScript / React

**Tooling:** `pnpm`, `eslint` + `typescript-eslint`, `prettier`, `vitest`.

```ts
// Components: PascalCase, one per file, file named after the component
components/MetricValue.tsx

// Hooks: useSomething
function usePitcherScores(pitcherId: string) { ... }

// Types: PascalCase, no I-prefix, no T-prefix
type PitchShape = { ... }
type AltitudeSeal = 'resistant' | 'neutral' | 'fragile'

// Handlers: handleX on the component, onX on the prop
function handleSortChange(...) { ... }
<SortToggle onSortChange={handleSortChange} />

// Booleans read as assertions
const isLoading = ...
const hasSufficientSample = ...
```

**Rules:**

1. **`strict: true` in tsconfig.** No exceptions.
2. **`any` is banned.** Use `unknown` and narrow it. ESLint enforces this.
3. **Every API response is parsed with Zod** at the boundary. Types alone do not protect you from a backend that changed.
4. **No default exports** except where Next.js requires them (pages, layouts). Named exports grep better and rename safely.
5. **Server Components by default.** `"use client"` only where interactivity actually requires it, and as deep in the tree as possible.
6. **No business logic in components.** Scoring lives in the API; components render.
7. **Enum-like unions use the canonical English values**; the Spanish label is applied at render, from the i18n map.

---

## 5. Data, API, and model naming

### 5.1 Database and files

```sql
-- Tables: plural snake_case          pitches, pitcher_seasons, decisions
-- Columns: snake_case, no prefixes   stuff_plus  (not pitch_stuff_plus)
-- Booleans: is_ / has_               is_whiff, has_tracking
-- Timestamps: _at, always UTC        scored_at, created_at
-- Foreign keys: <singular>_id        pitcher_id, game_id
-- Every table carries tenant_id      (see docs/07 §6 — multi-tenancy is how this scales)
```

Data files: `scores_{season}_{model_version}.parquet` — lowercase, underscores, never spaces.

### 5.2 API

```
GET  /api/v1/pitchers/{pitcherId}/scores?environment=harp_helu
POST /api/v1/simulate
POST /api/v1/translate
```

Paths: plural nouns, kebab-case if multi-word. Query params and JSON bodies: `camelCase`. Versioned from day one — `/v1/` costs nothing now and saves a migration later.

### 5.3 Model versions

`MAJOR.MINOR.PATCH+<git-sha7>` — e.g. `1.2.0+a3f9c1`

| Bump | When |
|---|---|
| MAJOR | The Stuff+ scale changes meaning. Old scores are not comparable |
| MINOR | Retrain, new features, same scale |
| PATCH | Bug fix, scores move slightly |

**A MAJOR bump requires rescoring history**, or the product is comparing numbers that do not mean the same thing.

### 5.4 MLflow

```
Experiment:  superestela/<track>/<question>        superestela/A-target/A1
Run name:    <question>-<architecture>-<seed>    A1-lgbm-7
```

Required tags on every run: `question`, `hypothesis`, `report_section`, `product_claim`, `status`, `dataset_hash`. A run missing any of these **does not count as evidence** (`docs/05-PROTOCOLO-CIENTIFICO.md` §4).

---

## 6. Git

### 6.1 Branches

```
<type>/<short-description>        feat/altitude-translator
                                  fix/density-index-nan
                                  docs/model-card
```

Lowercase, hyphens, English, no ticket numbers in the name.

### 6.2 Commits — Conventional Commits

```
<type>(<scope>): <imperative summary, lowercase, no period>

feat(core): add density index from trajectory decomposition
fix(models): correct point-in-time window in arsenal features
docs(report): regenerate tables from mlflow
test(core): add property tests for magnus scaling
```

Types: `feat` `fix` `docs` `test` `refactor` `perf` `chore` `ci`.
Scopes: `core` `models` `contracts` `api` `web` `report` `ci`.

The scope is optional. A change to `docs/` alone, or one that spans several areas, goes without it
(`docs: record the q&a`); a change to `analysis/` goes under `report`. The whole summary is lowercase,
names included.

Enforced by `commitlint` in pre-commit. It also generates the changelog for free.

### 6.3 Pull requests

- **One PR per task** of the checklist in `docs/08` §0.0, from `main` and into `main`. The task's
  documentation goes in the same PR, and so does ticking its box: when the PR lands, the docs are
  already true.
- **Aim for under 400 changed lines.** Bigger than that and the review is theater. When a task cannot
  fit, the PR says so in its first line and is **reviewable commit by commit**: each commit stands on
  its own, passes the checks, and its message says what to look at.
- Title follows the commit convention.
- Body says **what changed and why**, how it was verified, and what is left to decide.
- **If it touches model code, the PR body carries the metrics table** that CI generated.
- **CI green is required to merge.** If it can be bypassed, it is not CI.
- **Every PR gets a review from someone other than its author.** Not for control — it is how four
  people stay in the same codebase. `CODEOWNERS` says who must look; anyone else may approve.

**When one PR needs another.** Stacking a PR on another's branch failed three times (#22–#31,
#37–#39, #52–#54): a PR merged into a `feat/` branch lands nothing on `main`, and GitHub still marks it
MERGED. So a PR **never** points at another branch:

- Prefer waiting: start the next task from `main` once the previous one lands.
- If it cannot wait, the second PR **contains** the first (branch it from the first's branch), points
  at `main`, opens as a **draft**, and says which PR to review first. Mark it ready once the first is
  in `main`; its diff then shows only its own change.
- `.github/workflows/pr-base.yml` turns any PR whose base is not `main` red, with the reason.

**Merging and cleaning up.**

- Merge with a **merge commit**, so each PR's commits stay reviewable in the history.
- **Delete the branch after the merge.** With every PR pointing at `main`, no other PR depends on it.
  Before deleting a branch by hand, `git log --no-merges origin/main..<branch>` must be empty (or
  `git cherry origin/main <branch>` shows no `+`, for a rebased copy).
- Whether something reached `main` is checked with `git ls-tree origin/main <path>`, not with the
  PR's MERGED label.

---

## 7. Testing

```python
# File mirrors the module:  packages/core/density.py → tests/core/test_density.py
# Name says the behaviour, not the function:

def test_density_index_is_one_at_sea_level(): ...
def test_translate_shrinks_break_at_altitude(): ...
def test_score_rejects_sample_below_minimum(): ...
```

**What must be tested, non-negotiable:**

1. Everything in `packages/core/` — it is pure, there is no excuse.
2. Every Pandera contract, with a fixture that passes and one that fails.
3. The physics, as **property tests**: density ratio in `(0, 1.05]`; break magnitude never grows when density drops; translating to the same density is the identity.
4. Every API endpoint: happy path, validation error, empty result.

Coverage is reported, not gated on a number. A coverage target invites tests written to satisfy it.

---

## 8. Rules specific to this project

These exist because of what this product is. They are not generic hygiene.

1. **No number without a run.** Any figure shown in the UI, deck, or report traces to an MLflow run or a cell in `analysis/evidence.py`. No exceptions, least of all in the final week.
2. **No score without its uncertainty.** The `<Metric>` component does not accept a value without `se`. The rule is enforced by the type, not by discipline.
3. **Below `MIN_PITCHES_FOR_SCORE`, show "muestra insuficiente"** — never a number with a huge band.
4. **`data/` never enters git.** A pre-commit hook rejects `.parquet`, `.csv`, `.xlsx` on any path. The competition rules forbid redistributing the data; a leak is a rule violation, not an accident.
   **One declared exception:** `docs/reference/stuff_plus_data_dictionary.csv`, which describes the columns and contains no rows from the dataset. It is listed by full path in `scripts/check_no_data_files.py`; the hook takes no globs, so the exception cannot quietly widen. Test fixtures are generated from a seed (`packages/contracts/fixtures.py`) rather than committed, so they need no exception at all.
5. **Notebooks are exploration only.** Nothing in `notebooks/` is ever imported by `packages/`. When exploration becomes real, it moves into a module with tests.
6. **`packages/core/` stays free of competition data.** It is the IP boundary (`docs/04-NEGOCIO.md` §5.1). No imports from `models/`, no dataset paths, no hardcoded LMB constants beyond measured physical ratios with their provenance.
7. **Secrets never in code or YAML.** `.env` locally, GitHub Environments in CI. `gitleaks` runs in pre-commit.

---

## 9. What enforces what

| Rule | Enforced by |
|---|---|
| Format and lint (Python) | `ruff` · pre-commit + CI |
| Types (Python) | `mypy --strict` · CI |
| Format and lint (TS) | `eslint` + `prettier` · pre-commit + CI |
| No `any` | `typescript-eslint` · CI |
| Commit format | `commitlint` · pre-commit |
| No data files in git | custom pre-commit hook |
| No secrets | `gitleaks` · pre-commit |
| Data contracts | `pandera` · CI (`contracts.yml`) |
| Accessibility | `axe-core` in Playwright · CI |
| Tests pass | `pytest` + `vitest` · CI, required to merge |
| A PR lands on `main`, not on another branch | drafts for chained PRs · `pr-base.yml` flags it, cannot block it |

Everything above installs with one command: `pre-commit install`. That is the whole onboarding for conventions — which is the point.

---

## 10. When a convention is wrong

Open a PR that changes this file, with the reason. Discuss it there, not in chat, so the decision survives the conversation.

Do **not** silently deviate: a codebase where the rules are half-followed is worse than one with no rules, because nobody knows which half is real.
