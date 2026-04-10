# Copilot Instructions

## Architecture

This is a **single-file application**: `kalkulator-kredytu.html` contains all HTML, CSS (inline `<style>`), and JavaScript (inline `<script>`). There is no build step, package manager, or test suite — open the file directly in a browser.

The two CSV files are **reference sources only** — their data has already been extracted and hard-coded into JavaScript arrays in the HTML. Do not read from them at runtime.

## Data layer (JavaScript constants)

All historical data lives in named objects at the top of the `<script>` block:

| Constant | Contents |
|---|---|
| `WIBOR6M_SEMI` | WIBOR 6M semi-annual fixings — key format `"YYYY-H1"` / `"YYYY-H2"` (H1 = May close, H2 = November close). Source: `plopln6m_m.csv`. |
| `WIBOR6M` | Annual averages derived from `WIBOR6M_SEMI`; used only for the WIBOR/CPI chart. |
| `CPI` | Annual Polish CPI as **percentage points** (e.g. `14.4` means 14.4% inflation). Source: `rocznewskaznikicentowarowiuslugkonsumpcyjnychod1950roku_2.csv`. |
| `WYNAGRODZENIA` | Monthly gross salary (PLN) in the enterprise sector, from GUS. |
| `IT_MULTIPLIER` | Year-specific multiplier applied on top of `WYNAGRODZENIA` to estimate IT-sector pay. |

Projection constants for years beyond the last historical data point: `DEFAULT_FUTURE_WIBOR` (%) and `DEFAULT_FUTURE_CPI` (%).

## Calculation conventions

- **WIBOR fixing** happens at loan start, then every May and November (`calMonth === 4` or `calMonth === 10`). The fixing half is determined by calendar month, not loan month index.
- **Real payment** uses a **cumulative monthly deflator** that starts at `1.0` in month 0 (so `rataReal[0] === rata[0]`). The deflator is updated *after* each month: `cumulativeDeflator *= 1 / (1 + annualCPI)^(1/12)`.
- **Real interest** (`odsetRealA/B`) can legitimately be **negative** when high inflation makes the total real payments fall below principal. Do not clamp with `Math.max(0, ...)`.
- **Affordability ratio** uses the monthly salary from `WYNAGRODZENIA` (already monthly), not annual.
- `calcSimpleRealTotal` uses a constant real rate `(WIBOR_start + marża − CPI_start)` for the full term — this is the "simplified" comparison model, not the authoritative one.

## UI conventions

- The calculator compares two variants: **A** (longer term, `latA`) vs **B** (shorter term, `latB`).
- CSS custom properties are defined in `:root` — use `var(--accent)` (gold) for Variant A highlights and `var(--accent2)` (blue) for Variant B.
- Chart tabs: `nominal`, `real`, `wibor`, `affordability` — rendered by `renderChart()` which reads `currentTab`.
- Table tabs: `tA` / `tB` — toggled by `switchTableTab()`.
- Input pairs (number input + range slider) are kept in sync via `bindInputs()`; every change calls `calculate()`.
- Polish locale formatting: use `fmt(n, dec)` for numbers and `fmtPLN(n)` / `fmtPct(n)` helpers — never format manually.

## Language

UI text, variable names in comments, and all displayed strings are in **Polish**. Keep this consistent when adding new UI elements or comments.
