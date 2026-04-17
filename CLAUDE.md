# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Two static-browser apps — no build step, no package manager, no runtime server. Just open the HTML files, or deploy the repo root to GitHub Pages (see `.github/workflows/deploy-pages.yml`).

| Entry file | Purpose |
|---|---|
| `index.html` + `kalkulator-kredytu.js` | Mortgage cost calculator — compares Variant A (long term) vs Variant B (short term), nominal vs real cost. |
| `symulator-nadplat.html` + `symulator-nadplat.js` | Overpayment / refinance / early-payoff simulator — base schedule vs modified schedule, plus investment opportunity-cost analysis. |

Both share `kalkulator-kredytu.css` and a stack of `data-*.js` files loaded via `<script src>` before the app script.

## Commands

```bash
# Tests — zero deps, Node.js only
node tests/run-tests.js           # Calculator (38 groups, 104 assertions)
node tests/run-tests-nadplat.js   # Overpayment simulator (100 groups, 306 assertions)

# Full regression
node tests/run-tests.js && node tests/run-tests-nadplat.js

# Regenerate data-*.js from CSV (after editing files in sources/csv/)
python3 scripts/csv_to_js/run_all.py                   # all parsers, parallel
python3 scripts/csv_to_js/run_all.py --only wibor3m    # single job (repeatable)
python3 scripts/csv_to_js/jobs/parse_nbp_rate.py       # one-shot parser
```

CSV files in `sources/csv/` are reference-only — never read at runtime. The apps read the generated `data-*.js` constants (`WIBOR6M_MONTHLY`, `CPI_MONTHLY`, `WIG30_MONTHLY`, etc., keyed `"YYYY-MM"`).

## Architecture essentials

**Shared calculation conventions** (apply to both apps — violating these will silently produce wrong numbers):

- **WIBOR fixing** is purely relative to loan-start month index: `isFix = (m % fixInterval === 0)` where `fixInterval` is 1 / 3 / 6. No calendar-anchored refixing.
- **Cumulative deflator** starts at `1.0` at month 0 (so `rataReal[0] === rata[0]`) and updates *after* each month: `*= 1 / (1 + cpi_m_over_m/100)` using `CPI_MONTHLY` (GUS m/m). Future-year fallback is derived from the annual `future_cpi` UI input via 12th-root.
- **Provision (`prowizja`)** is off-balance: it's a month-0 cash cost but does NOT increase `saldo`. In real totals it adds 1:1 (deflator is 1.0 at m0).
- **Real interest can legitimately be negative** (high-inflation years). Do NOT clamp with `Math.max(0, ...)`.
- **Event ordering** in `symulator-nadplat.js` per month: `refinansowanie` → `wydłużenie` → `nadpłata` → `pełna spłata`. This is enforced by a sort comparator using explicit sort keys (`refinansowanie = 0`, `wydluzenie = 1`, overpayments = 2, `splata = 3`) — **must be independent of the order events were added in the UI**. Use `??` not `||` when reading the sort key so `0` does not collapse into the fallback. `expandEvents()` must unroll `cykliczna` into individual `nadplata` entries before the main schedule loop.
- **`wydluzenie` semantics**: extends `effectiveEndMonth` by N months, recomputes the rata (annuity) or principal share (decreasing) on the spot. Does NOT touch balance, WIBOR, or `fixCounterSinceReset` — `monthHadFix` stays false unless a natural fixing coincides that month.
- **Investment portfolio recurrence**: `portfel[m] = (portfel[m-1] + wpłata[m]) × (1 + stopa_miesięczna[m])`. Belka tax (19%) is applied once at the end on `max(0, portfel - Σwpłaty)` — never on losses.

**Polish language is load-bearing.** All UI strings, chart labels, variable names in comments, and event/tab identifiers (`nadplata`, `cykliczna`, `refinansowanie`, `rowna`, `malejaca`, `krotszy_okres`, `nizsza_rata`) are in Polish. Keep this consistent when adding features.

**Decimal input pattern**: inputs are paired `type="number"` + range slider kept in sync by `bindInputs()`. Use `parseLocaleFloat` + `normalizeNumericString` to accept both `1.85` and `1,85`. In `commitInput()` (blur), always write `inp.value = String(parsed)` — never read back from the range slider, which snaps to its step and loses precision. Never switch numeric inputs to `type="text"` (breaks CSS).

**Formatting**: use `fmt(n, dec)`, `fmtPLN(n)`, `fmtPct(n)` — never hand-format numbers. Polish locale throughout.

## Testing architecture

Tests run in a `vm.createContext()` sandbox. The test runner loads `data-*.js` and the app script into the sandbox with DOM + Chart.js stubs, then executes the test file *inside* that same context. This matters because `const`/`let` in a VM context are NOT visible as properties of the sandbox object — so tests must execute inside the context to see them. When adding tests, assume all app functions/constants are in scope; set global mode vars (`wiborMode`, `salarySource`) freely between groups. Use `assert(cond, msg)` and `assertClose(a, b, tol, msg)`.

## Further reference

`.github/copilot-instructions.md` contains exhaustive detail on data-file schemas, default UI values, investment-engine semantics, and per-app UI conventions (chart tabs, CSS vars, event types). Consult it before making non-trivial changes to either app.
