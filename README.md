# Kalkulator Kredytu Hipotecznego

Dwa interaktywne narzędzia do analizy kredytu hipotecznego z uwzględnieniem historycznych notowań WIBOR oraz inflacji CPI GUS.

## Narzędzia

### 1. Kalkulator kredytu (`index.html`)

Porównuje **nominalny** i **realny** koszt dwóch wariantów kredytu (krótszy vs dłuższy okres).

### 2. Symulator nadpłat (`symulator-nadplat.html`)

Symuluje wpływ nadpłat, wcześniejszej spłaty i refinansowania na harmonogram kredytu. Porównuje **harmonogram bazowy** (bez zmian) z **harmonogramem zmodyfikowanym** (po zdarzeniach).

## Uruchomienie

W GitHub Pages domyślnie ładuje się `index.html`.
Lokalnie otwórz bezpośrednio `index.html` albo `symulator-nadplat.html` w przeglądarce.
Brak zależności, serwera ani kroku budowania.
Na stronie startowej (`index.html`) jest wyróżniony skrót do symulatora nadpłat.

---

## Kalkulator kredytu

### Parametry wejściowe
- Kwota kredytu, rok i miesiąc zaciągnięcia
- Marża banku (%)
- Wybór wskaźnika: WIBOR 3M lub WIBOR 6M
- Wybór danych CPI: roczne (GUS) lub miesięczne m/m (GUS, „poprzedni miesiąc = 100”)
- Wybór źródła danych wynagrodzeń: sektor prywatny / przeciętne wynagrodzenie / wynagrodzenie minimalne
- Dwa okresy kredytowania do porównania: **Wariant A** (długi) vs **Wariant B** (krótki)

### Obliczenia
- **Harmonogram ratalny** z refixingiem WIBOR co 3 lub 6 miesięcy od daty startu
- **Realna wartość płatności** — każda rata dyskontowana skumulowanym deflaktorem CPI (deflator = 1,0 w miesiącu 0; dla CPI rocznego używany jest miesięczny pierwiastek 12., dla CPI m/m bezpośredni mnożnik miesięczny)

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
- **Rata vs zarobki** — rata jako % wybranego źródła wynagrodzeń

### Szczegółowa tabela miesięczna
Pełny harmonogram z kolumnami: WIBOR, stopa łączna, rata nominalna, rata realna, odsetki, kapitał, saldo, wynagrodzenie (zgodnie z wybranym źródłem) i wskaźnik rata/wynagrodzenie z kolorowaniem (zielony &lt;35%, żółty 35–50%, czerwony &gt;50%).

---

## Symulator nadpłat

### Parametry wejściowe
- Kwota kredytu, rok i miesiąc zaciągnięcia
- Okres kredytowania w **miesiącach** (36–420, wyświetlany jako „X lat Y mies.")
- Typ raty: **rata równa** (annuitet) lub **rata malejąca**
- Marża banku (%), prowizja początkowa (%)
- Wybór wskaźnika: WIBOR 3M lub WIBOR 6M
- Wybór danych CPI i źródła wynagrodzeń (jak w kalkulatorze)

### Zdarzenia (do 20)
Użytkownik dodaje zdarzenia modyfikujące harmonogram:

| Typ | Opis |
|---|---|
| 💰 **Nadpłata jednorazowa** | Kwota, data, efekt: niższa rata lub krótszy okres |
| 🔄 **Nadpłata cykliczna** | Kwota/miesiąc, data startu i końca (lub „do końca kredytu"), efekt j.w. |
| ✅ **Pełna spłata** | Wcześniejsza spłata całości w danym miesiącu |
| 🏦 **Refinansowanie** | Przeniesienie do nowego banku: nowa marża, prowizja, opcjonalna zmiana WIBOR 6M↔3M |

### Porównanie
- **Harmonogram bazowy** (bez zdarzeń) vs **harmonogram zmodyfikowany** (ze zdarzeniami)
- Panel porównawczy: suma rat, suma odsetek, prowizje, łączny koszt — nominalnie i realnie
- Werdykt tekstowy z podsumowaniem oszczędności

### Wykresy
- **Nominalne** — rata bazowa vs zmodyfikowana w czasie
- **Realne (po inflacji)** — to samo po deflacji CPI
- **Saldo** — przebieg salda bazowego vs zmodyfikowanego
- **WIBOR historia** — historyczne notowania WIBOR i CPI
- **Rata vs zarobki** — rata jako % wynagrodzenia

### Tabela miesięczna
Harmonogram z wyróżnieniem miesięcy, w których wystąpiły zdarzenia (kolor, etykieta).

---

## Źródła danych

| Plik | Dane | Źródło |
|---|---|---|
| `data-wibor6m.js` | WIBOR 6M — notowania miesięczne (zamknięcie) 1997–2026 | `plopln6m_m.csv` |
| `data-wibor3m.js` | WIBOR 3M — notowania miesięczne (zamknięcie) 1997–2026 | `plopln3m_m.csv` |
| `data-cpi-annual.js` | Roczne wskaźniki CPI od 1997 r. | GUS — roczne wskaźniki cen towarów i usług konsumpcyjnych |
| `data-cpi-monthly.js` | Miesięczne wskaźniki CPI m/m od 1982 r. (poprzedni miesiąc = 100, wartość = wskaźnik−100) | GUS — miesięczne wskaźniki cen towarów i usług konsumpcyjnych |
| `data-wynagrodzenia-prywatny.js` | Przeciętne miesięczne wynagrodzenie brutto — sektor prywatny (od 2020 r.) | API DBW GUS — zmienna 398, przekrój 688 „Polska; Sektor własności”, pozycja „sektor prywatny” |
| `data-wynagrodzenia-przecietne.js` | Przeciętne miesięczne wynagrodzenie brutto (ogółem) | BDL GUS — zmienna 64428 + ZUS (lata 2000–2001) |
| `data-wynagrodzenia-minimalne.js` | Minimalne wynagrodzenie za pracę (roczne) | ZUS (od 2003 r.) + dane historyczne 2000–2002 |
| `kalkulator-kredytu.js` | Uzupełnienie historyczne dla wariantu „sektor prywatny” (2000–2019) i logika kalkulatora | GUS — dane roczne sektora przedsiębiorstw |

Pliki CSV są wyłącznie źródłem referencyjnym — dane zostały wyekstrahowane do plików JS i nie są wczytywane w czasie wykonania.

## Projekcja przyszłości

Dla miesięcy poza zakresem danych historycznych stosowane są stałe wartości domyślne:
- `DEFAULT_FUTURE_WIBOR = 4.5%`
- `DEFAULT_FUTURE_CPI = 3.5%`

W trybie CPI m/m fallback jest automatycznie wyliczany miesięcznie z `DEFAULT_FUTURE_CPI` (annual → monthly).

## Ograniczenia

Oba narzędzia mają charakter poglądowy. Nie uwzględniają: ubezpieczeń, wakacji kredytowych, spreadu walutowego, ani podatku od odsetek. Symulator nadpłat uwzględnia prowizje (początkową i przy refinansowaniu), ale traktuje je jako koszt pozabilansowy.
