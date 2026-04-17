# Copilot Instructions

## Architecture

This repository contains **two browser applications** with **two HTML entry files**. There is no build step or package manager. Tests are plain Node.js scripts in `tests/`.

| File | Purpose |
|---|---|
| `index.html` | Default GitHub Pages entrypoint for the mortgage cost calculator (Variant A vs B real-value analysis) |
| `symulator-nadplat.html` | Mortgage overpayment simulator — compares base schedule vs schedule modified by overpayments, early payoff, or refinancing |

Both share the same external CSS (`kalkulator-kredytu.css`) and a set of data JS files loaded via `<script src="...">` before the main script block.

### CSV and parser directories

| Path | Purpose |
|---|---|
| `sources/csv/` | Manually updated source CSV files (reference-only input data) |
| `scripts/csv_to_js/run_all.py` | Parallel orchestrator for regenerating `data-*.js` files |
| `scripts/csv_to_js/jobs/` | One parser per CSV (`1 input CSV -> 1 output data JS`) |
| `scripts/csv_to_js/lib/` | Shared Python stdlib helpers (CSV parsing, dates, formatting, checks) |

### Shared data files (both HTML files)

| File | Exported constant | Contents |
|---|---|---|
| `data-wibor6m.js` | `WIBOR6M_MONTHLY` | WIBOR 6M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `sources/csv/plopln6m_m.csv`. |
| `data-wibor3m.js` | `WIBOR3M_MONTHLY` | WIBOR 3M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `sources/csv/plopln3m_m.csv`. |
| `data-wibor1m.js` | `WIBOR1M_MONTHLY` | WIBOR 1M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `sources/csv/plopln1m_m.csv`. |
| `data-cpi-monthly.js` | `CPI_MONTHLY` | Monthly CPI m/m (previous month = 100, stored as `index - 100`). Key: `"YYYY-MM"`. Source: `sources/csv/miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv`. |
| `data-wynagrodzenia-przecietne.js` | `WYNAGRODZENIA_PRZECIETNE` | Monthly average gross wage indexed by year (PLN/month). |
| `data-wynagrodzenia-minimalne.js` | `WYNAGRODZENIA_MINIMALNE` | Monthly minimum wage indexed by year (PLN/month). |

### Additional data files (symulator-nadplat.html only)

| File | Exported constant | Contents |
|---|---|---|
| `data-nbp-rate.js` | `NBP_RATE_MONTHLY` | NBP reference rate — monthly fill-forward values. Key: `"YYYY-MM"`, value: % rate. Source: `sources/csv/inrtpl_m_m.csv`. |
| `data-wig30.js` | `WIG30_MONTHLY` | WIG30 index monthly closing values. Key: `"YYYY-MM"`. Source: `sources/csv/wig30_m.csv`. |
| `data-wig.js` | `WIG_MONTHLY` | WIG index monthly closing values. Key: `"YYYY-MM"`. Source: `sources/csv/wig_m.csv`. |
| `data-spx.js` | `SPX_MONTHLY` | S&P 500 index monthly closing values (USD). Key: `"YYYY-MM"`. Source: `sources/csv/spx_m.csv`. |
| `data-usdpln.js` | `USDPLN_MONTHLY` | USD/PLN exchange rate monthly values. Key: `"YYYY-MM"`. Source: `sources/csv/usdpln_m.csv`. |

The CSV source files are **reference only** — never read at runtime. Manual update flow: replace files in `sources/csv/`, then regenerate JS data using `python3 scripts/csv_to_js/run_all.py` (optionally `--only <job>`).
Both HTML entry files use the shared `favicon.svg` (`💸`).

## Data layer (in-script constants)

Both applications define similar constants in their `<script>` blocks:

| Constant | Contents |
|---|---|
| `SALARY_SOURCE_CONFIG` | Salary source registry (`average`, `minimum`) with labels, tooltips, and yearly data maps. |
| `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` / `WIBOR1M_ANNUAL` | Annual averages computed at startup from monthly WIBOR datasets; used only for the WIBOR history chart. |
| `DEFAULT_FUTURE_WIBOR` / `DEFAULT_FUTURE_CPI` / `DEFAULT_FUTURE_CPI_MONTHLY` | Default fallback projection values (`DEFAULT_FUTURE_WIBOR = 4.0%` = inflation default + 1 pp; `DEFAULT_FUTURE_CPI = 3.0%`). In `index.html` active future parameters are configurable from UI (`future_wibor`, `future_cpi`, `future_salary`). The user-facing `future_cpi` input is expressed as annual % and is automatically converted to its monthly-equivalent via `(1 + annual/100)^(1/12) − 1`. |

The overpayment simulator (`symulator-nadplat.js`) additionally computes:

| Constant / Function | Contents |
|---|---|
| `getFutureWibor()` | Dynamic getter — reads from `#future_wibor` input, default **4.0%** (inflation default + 1 pp). Uses `Number.isFinite` fallback, so a legitimate `0` input is preserved (not silently replaced). |
| `getFutureCpi()` | Dynamic getter — reads from `#future_cpi` input, default 3.0%. `Number.isFinite` fallback preserves `0` input. |
| `getFutureSalaryGrowth()` | Dynamic getter — reads from `#future_salary` input, default 3.5%. |
| `getFutureStockReturn()` | Dynamic getter — reads from `#future_stock_return` input, default 5.0%. |
| `getFutureDepositRate()` | Dynamic getter — reads from `#future_deposit_rate` input, default 3.0%. |
| `getFutureUsdPln()` | Dynamic getter — reads from `#future_usdpln` input, default 3.5. |

## Shared calculation conventions

- **WIBOR fixing** happens every `fixInterval` months from the loan start month (1 for WIBOR 1M, 3 for WIBOR 3M, 6 for WIBOR 6M). There are no fixed calendar dates — the interval is purely relative to month index `m`: `isFix = (m % fixInterval === 0)`.
- **Real payment** uses a **cumulative monthly deflator** that starts at `1.0` in month 0 (so `rataReal[0] === rata[0]`). The deflator is updated *after* each month: `cumulativeDeflator *= 1 / (1 + monthlyCPI/100)` where `monthlyCPI` is sourced from `CPI_MONTHLY` (m/m), falling back to the monthly-equivalent of the annual projection input.
- **Provision (`prowizja`)** is an off-balance one-time cost at month 0 (does not increase `saldo`). In real totals it is added 1:1 (month-0 deflator is `1.0`).
- **Real interest** can legitimately be **negative** when high inflation deflates total real payments below the principal. Do not clamp with `Math.max(0, ...)`.
- **Affordability ratio** uses the currently selected salary source from `SALARY_SOURCE_CONFIG` (average/minimum), with monthly values.

## index.html specifics

- Compares two variants: **A** (longer term) vs **B** (shorter term).
- `index.html` includes a prominent header shortcut (`.quick-link`) to `symulator-nadplat.html`.
- Supports two rate types via `rateType` + `setRateType()`: `rowna` (annuity) and `malejaca` (decreasing).
- WIBOR toggle order in the UI is `WIBOR 1M` then `WIBOR 3M` (active by default) then `WIBOR 6M`.
- Includes initial bank provision input (`prowizja`, default `2.0%`) with synced number/range controls.
- Cost summary (`cA_*`, `cB_*`) shows provision separately; totals include provision.
- In methodology: total real amount includes provision, but real-interest decomposition is computed from installments only (without provision).
- CSS custom properties: `var(--accent)` (gold) for Variant A, `var(--accent2)` (blue) for Variant B.
- Chart tabs: `nominal`, `real`, `wibor`, `affordability`.
- Table tabs: `tA` / `tB`.
- `calcAvgStats(rows)` computes average WIBOR, CPI, and spread; annualizes per-month CPI m/m for comparability.
- Factor analysis: real interest decomposed into **margin contribution** and **WIBOR−CPI spread effect** via zero-margin harmonograms.

## symulator-nadplat.html specifics

- Compares **base schedule** (no events) vs **modified schedule** (with overpayments/refinancing).
- Loan duration is in **months** (36–420, default 360). Display shows "X lat Y mies." via `fmtOkres()`.
- Default startup values in `symulator-nadplat.html`: year `2005`, month `styczeń` (`1`), margin `2.0%`, initial provision `2.0%`, and WIBOR mode `3M`.
- WIBOR toggle order in the UI is `WIBOR 1M` then `WIBOR 3M` (active by default) then `WIBOR 6M`.
- Supports two rate types: **rata równa** (annuity) and **rata malejąca** (decreasing installments).
- **Events system** — five event types stored in the `events` array:
  - `nadplata` — one-time overpayment (amount + date + effect: `nizsza_rata` / `krotszy_okres`)
  - `cykliczna` — recurring monthly overpayment (start month, optional end month or `doKonca`)
  - `splata` — full early payoff at a specific date
  - `refinansowanie` — move to new bank (new margin, optional provision, optional WIBOR type change)
  - `wydluzenie` — extend the remaining schedule by N months; recomputes rata (or principal share for decreasing) on the spot, no balance or WIBOR change
- `expandEvents()` expands `cykliczna` entries into individual monthly `nadplata` events before calculation.
- Event processing order per month: **refinansowanie → wydłużenie → nadpłata → pełna spłata**. Enforced by a sort comparator on explicit keys (`refinansowanie = 0`, `wydluzenie = 1`, overpayments = 2, `splata = 3`) and is independent of the order the user added the events in the UI. Use `??` (not `||`) when reading the key, otherwise `0` collapses to the fallback.
- `effectiveEndMonth` tracks loan shortening for `krotszy_okres` overpayments — at WIBOR fixing, `remaining = effectiveEndMonth - m` (not `nMonths - m`).
- When overpayment fully zeroes the saldo, a final row with `saldo: 0` is recorded.
- **Provisions** (initial + refinancing) are tracked in cost summary but NOT added to loan balance.
- **Investment opportunity cost** — compares overpayment savings vs investing the same money:
  - Investment types: `wig30`, `wig`, `sp500`, `lokata`, `gotowka`, `none` (disabled).
  - `calcInvestmentPortfolio(overpayments, rokStart, startMonth, nMonths, investmentType)` builds a monthly portfolio from overpayment cash flows, applying instrument-specific monthly returns.
  - Portfolio recurrence: `portfel[m] = (portfel[m-1] + wpłata[m]) × (1 + stopa_miesięczna[m])`.
  - S&P 500 returns are in PLN: `SPX[m] × USDPLN[m]` captures both stock return and currency effect.
  - `lokata` uses NBP reference rate / 12 as monthly return; `gotowka` uses 0.
  - **Belka tax (19%)** is applied once at the end: `max(0, portfolio - totalContributions) * 0.19`. No tax on losses.
  - Real investment gain uses monthly CPI deflator for both contributions and ending portfolio value: `zysk_realny_netto = (portfel_netto_koniec × deflator_koniec) − Σ(wpłata[m] × deflator[m])`.
  - Bilans nominalny = `oszczędność_odsetek_nom − zysk_netto_nom`.
  - Bilans realny = `oszczędność_odsetek_real − zysk_realny_netto`.
  - Positive bilans → overpayment better; negative → investment better.
  - The 4th summary card ("Bilans vs. inwestycja") shows/hides based on `investment_type !== 'none'`.
  - For dates beyond historical data, uses `getFutureStockReturn()`, `getFutureDepositRate()`, `getFutureUsdPln()`.
- Chart tabs: `nominal`, `real`, `saldo`, `wibor`, `affordability`, `investment`.
- The `investment` chart tab shows: portfolio nominal value, portfolio real value, and cumulative interest savings (nominal and real).
- Colors: `var(--accent)` (gold) for base schedule, `var(--accent2)` (blue) for modified schedule.

## Shared UI conventions

- Input pairs (number input + range slider) are kept in sync via `bindInputs()`. Range changes recalculate immediately; transient decimal edit states (`''`, `'-'`, `'1.'`) are allowed while typing.
- Decimal inputs use `type="number"` with `step="0.001"` to allow up to 3 decimal places. **Never use `type="text"`** for numeric inputs — it breaks CSS styling. Range sliders keep coarser steps (e.g. `0.05`) for drag UX.
- In `commitInput()` (blur handler), always set `inp.value = String(parsed)` directly — **never read back from `ran.value`** because the range slider may snap to its step and lose precision.
- For decimal inputs, treat comma and dot as equivalent (`parseLocaleFloat` + `normalizeNumericString` pattern).
- Polish locale formatting: use `fmt(n, dec)` for numbers and `fmtPLN(n)` / `fmtPct(n)` helpers — never format manually.
- Colors: `highlight-positive` (green, `var(--success)`) for borrower-favorable values; `highlight-negative` (red, `var(--danger)`) for costs.
- Dark/light theme toggle via `toggleTheme()` with `localStorage` persistence.

## Language

UI text, variable names in comments, and all displayed strings are in **Polish**. Keep this consistent when adding new UI elements or comments.

## Testing

### Running tests

```bash
node tests/run-tests.js          # Calculator tests (38 groups, 104 assertions)
node tests/run-tests-nadplat.js  # Overpayment simulator tests (96 groups, 283 assertions)
```

No npm packages needed — only Node.js (built-in `vm` and `fs` modules).

### How it works

The test runner (`tests/run-tests.js`) loads all data JS files and `kalkulator-kredytu.js` into a Node.js `vm.createContext()` sandbox with DOM/Chart.js stubs. The actual test assertions live in `tests/test-kalkulator.js`, which runs **inside** the VM context — this is critical because `const`/`let` declarations in a VM context are NOT accessible as properties on the sandbox object, but code executed inside the context can reference them directly.

### DOM mocking pattern

The sandbox needs minimal DOM stubs because `kalkulator-kredytu.js` calls `calculate()` at init:
- `document.getElementById()` → returns mock elements with `.value`, `.textContent`, `.classList.toggle()`, `.getContext()`, etc.
- `Chart` → constructor function mock with `this.destroy = ()=>{}`
- `localStorage` → `getItem()` returns `null`, `setItem()` is no-op
- `window.matchMedia` → returns `{ matches: false }`
- `getComputedStyle` → returns stub with `getPropertyValue()` returning `''`

### Adding new tests

1. Open `tests/test-kalkulator.js`
2. Add a new `group('N. Name')` section
3. Use `assert(cond, msg)` for boolean checks or `assertClose(a, b, tol, msg)` for numeric tolerance
4. All functions/constants from `kalkulator-kredytu.js` and data files are available in scope
5. Global mode variables (`wiborMode`, `salarySource`) can be set freely between tests
6. Run `node tests/run-tests.js` to verify — exit code 0 = all pass, 1 = failures

### Test coverage areas (38 groups, 104 assertions)

Core math: annuity formula, monthly rate, zero-rate edge case, declining installments.
Harmonogram: first months, final balance convergence, row-level identity (rata = odsetki + kapitał), saldo monotonicity.
Real values: cumulative deflator (monthly CPI m/m), inflation savings, year-boundary transitions, deflation handling, negative real interest scenario.
Factor analysis: margin contribution + WIBOR-CPI contribution = real interest (via zero-margin harmonogram).
WIBOR: fixing intervals (1M/3M/6M), different start months, 6M vs 3M/1M comparison.
Data integrity: spot-checks on CPI/WIBOR/salary data, WIBOR annual averages, future fallbacks.
Aggregation: yearly totals match monthly sums, salary fields populated correctly.
Edge cases: 3-year and 35-year loans, high inflation (2022), provision identity, verdict direction logic.
Input handling: locale decimal parsing (comma/dot) and transient input states (`1.`, `1,`).

### Symulator nadpłat tests (`tests/run-tests-nadplat.js` + `tests/test-nadplat.js`)

The overpayment simulator test runner (`tests/run-tests-nadplat.js`) loads data JS files (including 6 investment/projection data files) and `symulator-nadplat.js` into a VM sandbox with DOM stubs (default input values matching `symulator-nadplat.html`: kwota=350000, rok_start=2005, miesiac_start=1, okres=360, marża=2, prowizja=2, plus projection defaults: future_wibor=3.0, future_cpi=3.0, future_salary=3.5, future_stock_return=5.0, future_deposit_rate=3.0, future_usdpln=3.5, investment_type=none). It also provides `document.createElement()` and `document.querySelectorAll()` stubs since the simulator builds dynamic event UI.

#### Test coverage areas (96 groups, 283 assertions)

Core math: annuity formula (`calcRataRowna`), monthly rate, zero-rate edge case, declining installments, WIBOR fixing intervals (3M/6M).
Harmonogram: base schedule convergence, row-level identity, saldo monotonicity, calendar month mapping, yearly aggregation.
Real values: cumulative deflator (monthly CPI m/m), high inflation (2022), year boundaries.
Data integrity: spot-checks on CPI/WIBOR data, future fallbacks, annualization round-trip.
Events — nadpłata: single overpayment (shorter term / lower installment), overpayment exceeding balance, overpayment at month 0, multiple in same month.
Events — cykliczna: recurring overpayment (doKońca=true expands to end, doKońca=false to specified date), combined with shorter/lower-rata modes.
Events — spłata: early full payoff, balance drops to 0 in payoff month.
Events — refinansowanie: new margin applied, provision calculated, WIBOR type change, `fixCounterSinceReset` restarts.
Events — wydluzenie: `effectiveEndMonth += N`, rata/k recomputed on spot, saldo and WIBOR untouched.
Event ordering: refinansowanie → wydłużenie → nadpłata → spłata in same month.
Combined events: multiple events across different months, balance identity (raty + nadpłaty ≈ kapitał + odsetki).
Methodology verification: steps 1–6 (rate calculation, installment formula, real values, overpayment effect, refinancing, provisions).
Table validation: all column fields present, event-specific fields populated.
Comparison: modified schedule cheaper than base.
Edge cases: zero provision, date boundary filtering, formatting (`fmtOkres`), salary sources.
Investment engine: data file spot-checks (WIG30, WIG, SPX, USDPLN, WIBOR1M, NBP_RATE), `getMonthlyInvestmentReturn()` for all instrument types with historical and fallback values, `calcInvestmentPortfolio()` for single/cyclic overpayments across all instruments, Belka tax (gain and loss scenarios), bilans comparison, real portfolio deflation, CPI-monthly deflator compounding, real net gain with deflated contributions, WIBOR 1M fixing interval, projection parameter getters.
Input handling: locale decimal parsing (comma/dot) and transient input states (`1.`, `1,`).

# Always follow these instructions

- After your done is finished, check if you need to update copilot instructions file, README, tests or long term memory.
- If you encountered any issue in running commands - update your long term memory to avoid it in the future.
- If you fixed any bug in the code, add a test that covers it and update long term memory to avoid it in the future.