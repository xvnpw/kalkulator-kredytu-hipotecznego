# Copilot Instructions

## Architecture

This repository contains **two browser applications** with **two HTML entry files**. There is no build step, package manager, or test suite.

| File | Purpose |
|---|---|
| `index.html` | Default GitHub Pages entrypoint for the mortgage cost calculator (Variant A vs B real-value analysis) |
| `symulator-nadplat.html` | Mortgage overpayment simulator — compares base schedule vs schedule modified by overpayments, early payoff, or refinancing |

Both share the same external CSS (`kalkulator-kredytu.css`) and the same seven data JS files loaded via `<script src="...">` before the main script block:

| File | Exported constant | Contents |
|---|---|---|
| `data-wibor6m.js` | `WIBOR6M_MONTHLY` | WIBOR 6M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `plopln6m_m.csv`. |
| `data-wibor3m.js` | `WIBOR3M_MONTHLY` | WIBOR 3M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `plopln3m_m.csv`. |
| `data-cpi-annual.js` | `CPI_ANNUAL` | Annual Polish CPI as **percentage points** (e.g. `14.4` means 14.4%). Source: GUS annual series. |
| `data-cpi-monthly.js` | `CPI_MONTHLY` | Monthly CPI m/m (previous month = 100, stored as `index - 100`). Key: `"YYYY-MM"`. Source: GUS monthly series. |
| `data-wynagrodzenia-prywatny.js` | `WYNAGRODZENIA_PRYWATNY_2020` | Annual average monthly gross wage in private sector (PLN) from 2020 onward (GUS DBW API). |
| `data-wynagrodzenia-przecietne.js` | `WYNAGRODZENIA_PRZECIETNE` | Annual average monthly gross wage (PLN, overall). |
| `data-wynagrodzenia-minimalne.js` | `WYNAGRODZENIA_MINIMALNE` | Annual minimum wage values (PLN). |

The CSV source files are **reference only** — never read at runtime.
Both HTML entry files use the shared `favicon.svg` (`💸`).

## Data layer (in-script constants)

Both applications define similar constants in their `<script>` blocks:

| Constant | Contents |
|---|---|
| `SALARY_SOURCE_CONFIG` | Salary source registry (`private`, `average`, `minimum`) with labels, tooltips, and yearly data maps. |
| `WYNAGRODZENIA_SEKTOR_HIST` | Historical supplement (2000–2019) used only for private-sector mode continuity. |
| `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` | Annual averages computed at startup from `WIBOR6M_MONTHLY` / `WIBOR3M_MONTHLY`; used only for the WIBOR history chart. |
| `DEFAULT_FUTURE_WIBOR` / `DEFAULT_FUTURE_CPI` / `DEFAULT_FUTURE_CPI_MONTHLY` | Fallback projection values; monthly CPI fallback is derived from annual CPI default. |

## Shared calculation conventions

- **WIBOR fixing** happens every `fixInterval` months from the loan start month (3 for WIBOR 3M, 6 for WIBOR 6M). There are no fixed calendar dates — the interval is purely relative to month index `m`: `isFix = (m % fixInterval === 0)`.
- **Real payment** uses a **cumulative monthly deflator** that starts at `1.0` in month 0 (so `rataReal[0] === rata[0]`). The deflator is updated *after* each month: for annual CPI mode `cumulativeDeflator *= 1 / (1 + annualCPI/100)^(1/12)`, for monthly CPI mode `cumulativeDeflator *= 1 / (1 + monthlyCPI/100)`.
- **Provision (`prowizja`)** is an off-balance one-time cost at month 0 (does not increase `saldo`). In real totals it is added 1:1 (month-0 deflator is `1.0`).
- **Real interest** can legitimately be **negative** when high inflation deflates total real payments below the principal. Do not clamp with `Math.max(0, ...)`.
- **Affordability ratio** uses the currently selected salary source from `SALARY_SOURCE_CONFIG` (private/average/minimum), with monthly values.

## index.html specifics

- Compares two variants: **A** (longer term) vs **B** (shorter term).
- `index.html` includes a prominent header shortcut (`.quick-link`) to `symulator-nadplat.html`.
- Supports two rate types via `rateType` + `setRateType()`: `rowna` (annuity) and `malejaca` (decreasing).
- Includes initial bank provision input (`prowizja`, default `2.0%`) with synced number/range controls.
- Cost summary (`cA_*`, `cB_*`) shows provision separately; totals include provision.
- In methodology: total real amount includes provision, but real-interest decomposition is computed from installments only (without provision).
- CSS custom properties: `var(--accent)` (gold) for Variant A, `var(--accent2)` (blue) for Variant B.
- Chart tabs: `nominal`, `real`, `wibor`, `affordability`.
- Table tabs: `tA` / `tB`.
- `calcAvgStats(rows)` computes average WIBOR, CPI, and spread; reads module-level `cpiMode`.
- Factor analysis: real interest decomposed into **margin contribution** and **WIBOR−CPI spread effect** via zero-margin harmonograms.

## symulator-nadplat.html specifics

- Compares **base schedule** (no events) vs **modified schedule** (with overpayments/refinancing).
- Loan duration is in **months** (36–420, default 300). Display shows "X lat Y mies." via `fmtOkres()`.
- Supports two rate types: **rata równa** (annuity) and **rata malejąca** (decreasing installments).
- **Events system** — four event types stored in the `events` array:
  - `nadplata` — one-time overpayment (amount + date + effect: `nizsza_rata` / `krotszy_okres`)
  - `cykliczna` — recurring monthly overpayment (start month, optional end month or `doKonca`)
  - `splata` — full early payoff at a specific date
  - `refinansowanie` — move to new bank (new margin, optional provision, optional WIBOR type change)
- `expandEvents()` expands `cykliczna` entries into individual monthly `nadplata` events before calculation.
- Event processing order per month: refinansowanie → nadpłata → pełna spłata.
- `effectiveEndMonth` tracks loan shortening for `krotszy_okres` overpayments — at WIBOR fixing, `remaining = effectiveEndMonth - m` (not `nMonths - m`).
- When overpayment fully zeroes the saldo, a final row with `saldo: 0` is recorded.
- **Provisions** (initial + refinancing) are tracked in cost summary but NOT added to loan balance.
- Chart tabs: `nominal`, `real`, `saldo`, `wibor`, `affordability`.
- Colors: `var(--accent)` (gold) for base schedule, `var(--accent2)` (blue) for modified schedule.

## Shared UI conventions

- Input pairs (number input + range slider) are kept in sync via `bindInputs()`; every change calls `calculate()`.
- Polish locale formatting: use `fmt(n, dec)` for numbers and `fmtPLN(n)` / `fmtPct(n)` helpers — never format manually.
- Colors: `highlight-positive` (green, `var(--success)`) for borrower-favorable values; `highlight-negative` (red, `var(--danger)`) for costs.
- Dark/light theme toggle via `toggleTheme()` with `localStorage` persistence.

## Language

UI text, variable names in comments, and all displayed strings are in **Polish**. Keep this consistent when adding new UI elements or comments.
