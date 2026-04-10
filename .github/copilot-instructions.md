# Copilot Instructions

## Architecture

This is a **single-file application**: `kalkulator-kredytu.html` contains all HTML, CSS (inline `<style>`), and JavaScript (inline `<script>`). There is no build step, package manager, or test suite — open the file directly in a browser.

Data is split across four external JS files loaded via `<script src="...">` before the main script block:

| File | Exported constant | Contents |
|---|---|---|
| `data-wibor6m.js` | `WIBOR6M_MONTHLY` | WIBOR 6M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `plopln6m_m.csv`. |
| `data-wibor3m.js` | `WIBOR3M_MONTHLY` | WIBOR 3M monthly closing values. Key: `"YYYY-MM"`, value: % rate. Source: `plopln3m_m.csv`. |
| `data-cpi-annual.js` | `CPI_ANNUAL` | Annual Polish CPI as **percentage points** (e.g. `14.4` means 14.4%). Source: GUS annual series. |
| `data-cpi-monthly.js` | `CPI_MONTHLY` | Monthly CPI m/m (previous month = 100, stored as `index - 100`). Key: `"YYYY-MM"`. Source: GUS monthly series. |

The CSV source files are **reference only** — never read at runtime.

## Data layer (in-script constants)

Defined in the main `<script>` block:

| Constant | Contents |
|---|---|
| `WYNAGRODZENIA` | Monthly gross salary (PLN), enterprise sector, GUS. Key: year (int). |
| `IT_MULTIPLIER` | Year-specific multiplier applied on top of `WYNAGRODZENIA` to estimate IT-sector pay. |
| `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` | Annual averages computed at startup from `WIBOR6M_MONTHLY` / `WIBOR3M_MONTHLY`; used only for the WIBOR history chart. |
| `DEFAULT_FUTURE_WIBOR` / `DEFAULT_FUTURE_CPI` / `DEFAULT_FUTURE_CPI_MONTHLY` | Fallback projection values; monthly CPI fallback is derived from annual CPI default. |

## Calculation conventions

- **WIBOR fixing** happens every `fixInterval` months from the loan start month (3 for WIBOR 3M, 6 for WIBOR 6M). There are no fixed calendar dates — the interval is purely relative to month index `m`: `isFix = (m % fixInterval === 0)`.
- **Real payment** uses a **cumulative monthly deflator** that starts at `1.0` in month 0 (so `rataReal[0] === rata[0]`). The deflator is updated *after* each month: for annual CPI mode `cumulativeDeflator *= 1 / (1 + annualCPI/100)^(1/12)`, for monthly CPI mode `cumulativeDeflator *= 1 / (1 + monthlyCPI/100)`.
- **Real interest** (`odsetRealA/B`) can legitimately be **negative** when high inflation deflates total real payments below the principal. Do not clamp with `Math.max(0, ...)`.
- **Affordability ratio** uses the monthly salary from `WYNAGRODZENIA` (already monthly), not annual.
- `calcSimpleRealTotal` uses a constant real rate `(WIBOR_start + marża − CPI_start)` for the full term — in monthly mode `CPI_start` is annualized from the m/m reading.
- `calcAvgStats(rows)` computes average WIBOR, average CPI, and average WIBOR−CPI spread over a loan's rows array; it reads the module-level `cpiMode` variable.

## Factor analysis (real cost decomposition)

The comparison panel includes a **"Rozkład realnego kosztu wg czynników"** section. For each variant the real interest is additively decomposed into:

- **Wkład marży banku** = `odsetReal(marza) − odsetReal(marza=0)` — the bank margin's contribution in today's PLN.
- **Efekt spreadu WIBOR−CPI** = `odsetReal(marza=0)` — the pure macro effect; negative when inflation exceeded WIBOR on average.

These two components sum exactly to total real interest: `marzaContrib + wiborCpiContrib = odsetReal`.

The section also shows average WIBOR, CPI, and spread over the loan's lifetime, plus the **duration effect** = real interest difference between variant A and B.

To compute this, `calculate()` runs two extra zero-margin harmonograms (`rowsA0`, `rowsB0`) alongside the main ones.

## UI conventions

- The calculator compares two variants: **A** (longer term, `latA`) vs **B** (shorter term, `latB`).
- CSS custom properties are defined in `:root` — use `var(--accent)` (gold) for Variant A highlights and `var(--accent2)` (blue) for Variant B.
- Chart tabs: `nominal`, `real`, `wibor`, `affordability` — rendered by `renderChart()` which reads `currentTab`.
- Table tabs: `tA` / `tB` — toggled by `switchTableTab()`.
- Input pairs (number input + range slider) are kept in sync via `bindInputs()`; every change calls `calculate()`.
- The simplified-model note is plain text ("Uproszczony model zakłada ..."); do not reintroduce the old label with the "punkt 2" suffix.
- Polish locale formatting: use `fmt(n, dec)` for numbers and `fmtPLN(n)` / `fmtPct(n)` helpers — never format manually.
- Colors: `highlight-positive` (green, `var(--success)`) for borrower-favorable values; `highlight-negative` (red, `var(--danger)`) for costs.

## Language

UI text, variable names in comments, and all displayed strings are in **Polish**. Keep this consistent when adding new UI elements or comments.
