# Kalkulator Kredytu Hipotecznego

Interaktywny kalkulator porównujący **nominalny** i **realny** koszt kredytu hipotecznego z uwzględnieniem historycznych notowań WIBOR oraz inflacji CPI GUS.

## Uruchomienie

Otwórz `kalkulator-kredytu.html` bezpośrednio w przeglądarce. Brak zależności, serwera ani kroku budowania.

## Funkcjonalność

### Parametry wejściowe
- Kwota kredytu, rok i miesiąc zaciągnięcia
- Marża banku (%)
- Wybór wskaźnika: WIBOR 3M lub WIBOR 6M
- Wybór danych CPI: roczne (GUS) lub miesięczne m/m (GUS, „poprzedni miesiąc = 100”)
- Dwa okresy kredytowania do porównania: **Wariant A** (długi) vs **Wariant B** (krótki)

### Obliczenia
- **Harmonogram ratalny** z refixingiem WIBOR co 3 lub 6 miesięcy od daty startu
- **Realna wartość płatności** — każda rata dyskontowana skumulowanym deflaktorem CPI (deflator = 1,0 w miesiącu 0; dla CPI rocznego używany jest miesięczny pierwiastek 12., dla CPI m/m bezpośredni mnożnik miesięczny)
- **Notka „Uproszczony model”** — stała stopa realna `(WIBOR_start + marża − CPI_start)` dla całego okresu (w trybie m/m `CPI_start` jest annualizowane), jako porównanie do pełnego harmonogramu

Opis uproszczonego modelu w UI jest prezentowany bez dawnej etykiety z dopiskiem „punkt 2”.

### Analiza czynników realnego kosztu

Sekcja **"Rozkład realnego kosztu wg czynników"** rozkłada realne odsetki na dwa addytywne składniki:

| Składnik | Opis |
|---|---|
| **Wkład marży banku** | Różnica kosztu realnego z marżą vs bez marży — jedyny element negocjowalny przez kredytobiorcę |
| **Efekt spreadu WIBOR−CPI** | Koszt realny przy marży 0%; ujemny gdy inflacja > WIBOR (inflacja „pracuje" na korzyść dłużnika) |

Dodatkowo pokazuje średnie WIBOR, CPI i spread w okresie kredytowania oraz **efekt wydłużenia** (różnica realnych odsetek A vs B).

### Wykresy
- **Nominalne** — skumulowane przepływy pieniężne (PLN nominalne)
- **Realne (po inflacji)** — skumulowane przepływy zdyskontowane CPI
- **WIBOR historia** — historyczne notowania WIBOR 3M/6M i inflacji CPI od 2000 r.
- **Rata vs zarobki** — rata jako % wynagrodzenia (sektor przedsiębiorstw GUS i szacowane IT)

### Szczegółowa tabela miesięczna
Pełny harmonogram z kolumnami: WIBOR, stopa łączna, rata nominalna, rata realna, odsetki, kapitał, saldo, wynagrodzenia (sektor / IT) i wskaźnik rata/wynagrodzenie z kolorowaniem (zielony &lt;35%, żółty 35–50%, czerwony &gt;50%).

## Źródła danych

| Plik | Dane | Źródło |
|---|---|---|
| `data-wibor6m.js` | WIBOR 6M — notowania miesięczne (zamknięcie) 1997–2026 | `plopln6m_m.csv` |
| `data-wibor3m.js` | WIBOR 3M — notowania miesięczne (zamknięcie) 1997–2026 | `plopln3m_m.csv` |
| `data-cpi-annual.js` | Roczne wskaźniki CPI od 1997 r. | GUS — roczne wskaźniki cen towarów i usług konsumpcyjnych |
| `data-cpi-monthly.js` | Miesięczne wskaźniki CPI m/m od 1982 r. (poprzedni miesiąc = 100, wartość = wskaźnik−100) | GUS — miesięczne wskaźniki cen towarów i usług konsumpcyjnych |
| (in-script) | Przeciętne wynagrodzenie brutto — sektor przedsiębiorstw | GUS — komunikaty Prezesa GUS, dane roczne |

Pliki CSV są wyłącznie źródłem referencyjnym — dane zostały wyekstrahowane do plików JS i nie są wczytywane w czasie wykonania.

## Projekcja przyszłości

Dla miesięcy poza zakresem danych historycznych stosowane są stałe wartości domyślne:
- `DEFAULT_FUTURE_WIBOR = 4.5%`
- `DEFAULT_FUTURE_CPI = 3.5%`

W trybie CPI m/m fallback jest automatycznie wyliczany miesięcznie z `DEFAULT_FUTURE_CPI` (annual → monthly).

## Ograniczenia

Kalkulator ma charakter poglądowy. Nie uwzględnia: prowizji, ubezpieczeń, wakacji kredytowych, wcześniejszej spłaty, spreadu walutowego, ani podatku od odsetek.
