# Kalkulator Kredytu Hipotecznego

Dwa interaktywne narzędzia do analizy kredytu hipotecznego z uwzględnieniem historycznych notowań WIBOR oraz inflacji CPI GUS.

## Narzędzia

### 1. Kalkulator kredytu (`index.html`)

Porównuje **nominalny** i **realny** koszt dwóch wariantów kredytu (krótszy vs dłuższy okres).

### 2. Symulator nadpłat (`symulator-nadplat.html`)

Symuluje wpływ nadpłat, wcześniejszej spłaty i refinansowania na harmonogram kredytu. Porównuje **harmonogram bazowy** (bez zmian) z **harmonogramem zmodyfikowanym** (po zdarzeniach). Zawiera analizę **kosztu utraconych możliwości inwestycyjnych** — czy pieniądze przeznaczone na nadpłatę lepiej byłoby zainwestować.

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
- Prowizja banku (%) — koszt jednorazowy (domyślnie 2,0%)
- Typ raty: **rata równa** (annuitet) lub **rata malejąca**
- Wybór wskaźnika: WIBOR 1M, WIBOR 3M lub WIBOR 6M
- Wybór danych CPI: roczne (GUS) lub miesięczne m/m (GUS, „poprzedni miesiąc = 100”)
- Wybór źródła danych wynagrodzeń: przeciętne wynagrodzenie / wynagrodzenie minimalne
- Sekcja **„Projekcje przyszłe”**: przyszły WIBOR, przyszła inflacja CPI, przyszły wzrost wynagrodzeń
- Dwa okresy kredytowania do porównania: **Wariant A** (długi) vs **Wariant B** (krótki)
- Pola dziesiętne akceptują zarówno kropkę (`1.85`), jak i przecinek (`1,85`)

### Obliczenia
- **Harmonogram ratalny** z refixingiem WIBOR co 1, 3 lub 6 miesięcy od daty startu, dla rat równych i malejących
- **Prowizja banku** jest doliczana jako koszt jednorazowy na starcie i nie zwiększa salda kredytu
- **Realna wartość płatności** — każda rata dyskontowana skumulowanym deflaktorem CPI (deflator = 1,0 w miesiącu 0; dla CPI rocznego używany jest miesięczny pierwiastek 12., dla CPI m/m bezpośredni mnożnik miesięczny)
- **Koszty realne**: całkowita kwota realna = suma rat realnych + prowizja; realne odsetki = suma rat realnych − kwota kredytu (bez prowizji)

### Analiza czynników realnego kosztu

Sekcja **"Rozkład realnego kosztu wg czynników"** rozkłada realne odsetki z rat (**bez prowizji**) na dwa addytywne składniki:

| Składnik | Opis |
|---|---|
| **Wkład marży banku** | Różnica kosztu realnego z marżą vs bez marży — jedyny element negocjowalny przez kredytobiorcę |
| **Efekt spreadu WIBOR−CPI** | Koszt realny przy marży 0%; ujemny gdy inflacja > WIBOR (inflacja „pracuje" na korzyść dłużnika) |

Dodatkowo pokazuje średnie WIBOR, CPI i spread w okresie kredytowania oraz **efekt wydłużenia** (różnica realnych odsetek A vs B).
Prowizja jest prezentowana osobno w podsumowaniu kosztu całkowitego (nominalnego i realnego).

### Wykresy
- **Nominalne** — skumulowane przepływy pieniężne (PLN nominalne)
- **Realne (po inflacji)** — skumulowane przepływy zdyskontowane CPI
- **WIBOR historia** — historyczne notowania WIBOR 1M/3M/6M i inflacji CPI od 2000 r.
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
- Wybór wskaźnika: WIBOR 1M, WIBOR 3M lub WIBOR 6M (domyślnie WIBOR 3M)
- Wybór danych CPI i źródła wynagrodzeń (jak w kalkulatorze)
- Pola dziesiętne akceptują zarówno kropkę (`1.85`), jak i przecinek (`1,85`)
- Domyślne wartości startowe: rok **2005**, miesiąc **styczeń**, okres **360 miesięcy**, marża **2,0%**, prowizja **2,0%**, porównanie z inwestycją: **Brak (nie porównuj)**

### Projekcje przyszłe
Konfigurowalne wartości domyślne dla okresów bez danych historycznych:
- Przyszły WIBOR 1M/3M/6M (domyślnie 3,0%)
- Przyszła inflacja CPI (domyślnie 3,0%)
- Przyszły wzrost wynagrodzeń (domyślnie 3,5%)
- Przyszła stopa zwrotu z akcji (domyślnie 5,0%)
- Przyszłe oprocentowanie lokaty (domyślnie 3,0%)
- Przyszły kurs USD/PLN (domyślnie 3,5)

### Inwestycja alternatywna (koszt utraconych możliwości)
Analiza porównawcza: co by było, gdyby pieniądze przeznaczone na nadpłaty zostały zainwestowane zamiast wpłacone do banku.

Dostępne instrumenty inwestycyjne:
- **WIG30** — indeks 30 największych spółek GPW (dane miesięczne od 1991)
- **WIG** — szeroki indeks GPW (dane miesięczne od 1991)
- **S&P 500** — indeks giełdy USA przeliczony na PLN kursem USD/PLN (dane od 1984)
- **Lokata** — oprocentowanie wg stopy referencyjnej NBP (dane od 1998)
- **Gotówka** — zero zwrotu, traci na inflacji

Zasady kalkulacji:
- Portfel liczony miesięcznie: `portfel[m] = (portfel[m-1] + wpłata[m]) × (1 + stopa_miesięczna[m])`
- **Podatek Belki (19%)** naliczany na koniec okresu od zysku brutto (brak podatku przy stracie)
- **Zysk realny netto** uwzględnia miesięczny deflator CPI zarówno dla wpłat, jak i wartości końcowej portfela
- Bilans nominalny: `oszczędność_odsetek_nom − zysk_netto_nom`
- Bilans realny: `oszczędność_odsetek_real − zysk_realny_netto`
- Pominięte: koszty transakcyjne, prowizje, spread walutowy, dywidendy

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
- **Inwestycja** — wartość portfela inwestycyjnego (nominalna i realna, po Belce na końcu) vs skumulowane oszczędności odsetek

### Tabela miesięczna
Harmonogram z wyróżnieniem miesięcy, w których wystąpiły zdarzenia (kolor, etykieta). Po wybraniu instrumentu inwestycyjnego tabela rozszerza się o kolumny: wartość portfela i stopa zwrotu.

---

## Źródła danych

| Plik | Dane | Źródło |
|---|---|---|
| `data-wibor6m.js` | WIBOR 6M — notowania miesięczne (zamknięcie) 1997–2026 | `sources/csv/plopln6m_m.csv` |
| `data-wibor3m.js` | WIBOR 3M — notowania miesięczne (zamknięcie) 1997–2026 | `sources/csv/plopln3m_m.csv` |
| `data-wibor1m.js` | WIBOR 1M — notowania miesięczne (zamknięcie) 1995–2026 | `sources/csv/plopln1m_m.csv` |
| `data-cpi-annual.js` | Roczne wskaźniki CPI od 1997 r. | `sources/csv/rocznewskaznikicentowarowiuslugkonsumpcyjnychod1950roku_2.csv` |
| `data-cpi-monthly.js` | Miesięczne wskaźniki CPI m/m od 1982 r. (poprzedni miesiąc = 100, wartość = wskaźnik−100) | `sources/csv/miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv` |
| `data-wynagrodzenia-przecietne.js` | Przeciętne miesięczne wynagrodzenie brutto (ogółem) | BDL GUS — zmienna 64428 + ZUS (lata 2000–2001) |
| `data-wynagrodzenia-minimalne.js` | Minimalne wynagrodzenie za pracę (roczne) | ZUS (od 2003 r.) + dane historyczne 2000–2002 |
| `data-nbp-rate.js` | Stopa referencyjna NBP — wartości miesięczne fill-forward 1998–2026 | `sources/csv/inrtpl_m_m.csv` |
| `data-wig30.js` | WIG30 — notowania miesięczne (zamknięcie) 1991–2026 | `sources/csv/wig30_m.csv` |
| `data-wig.js` | WIG — notowania miesięczne (zamknięcie) 1991–2026 | `sources/csv/wig_m.csv` |
| `data-spx.js` | S&P 500 — notowania miesięczne (zamknięcie) 1984–2026 | `sources/csv/spx_m.csv` |
| `data-usdpln.js` | Kurs USD/PLN — wartości miesięczne 1984–2026 | `sources/csv/usdpln_m.csv` |
| `kalkulator-kredytu.js` | Logika kalkulatora kredytu | — |
| `symulator-nadplat.js` | Logika symulatora nadpłat | — |

Pliki CSV są wyłącznie źródłem referencyjnym (katalog `sources/csv/`) — dane są wyekstrahowane do plików JS i nie są wczytywane w czasie wykonania.

## Aktualizacja danych z CSV

Nowe wersje plików CSV podmieniaj ręcznie w `sources/csv/`, a następnie uruchom parsery w Pythonie (bez zewnętrznych bibliotek):

```bash
# wszystkie parsery równolegle (docelowo nadpisuje data-*.js w katalogu głównym)
python3 scripts/csv_to_js/run_all.py

# tylko wybrane serie
python3 scripts/csv_to_js/run_all.py --only wibor3m --only cpi-monthly

# pojedynczy parser
python3 scripts/csv_to_js/jobs/parse_nbp_rate.py
```

Każdy parser działa w czystym kontekście (`1 input CSV -> 1 output data-*.js`), a `run_all.py` uruchamia je równolegle.

| Job key (`--only`) | Parser | Wejście CSV | Wyjście JS |
|---|---|---|---|
| `wibor1m` | `scripts/csv_to_js/jobs/parse_wibor1m.py` | `sources/csv/plopln1m_m.csv` | `data-wibor1m.js` |
| `wibor3m` | `scripts/csv_to_js/jobs/parse_wibor3m.py` | `sources/csv/plopln3m_m.csv` | `data-wibor3m.js` |
| `wibor6m` | `scripts/csv_to_js/jobs/parse_wibor6m.py` | `sources/csv/plopln6m_m.csv` | `data-wibor6m.js` |
| `nbp-rate` | `scripts/csv_to_js/jobs/parse_nbp_rate.py` | `sources/csv/inrtpl_m_m.csv` | `data-nbp-rate.js` |
| `wig` | `scripts/csv_to_js/jobs/parse_wig.py` | `sources/csv/wig_m.csv` | `data-wig.js` |
| `wig30` | `scripts/csv_to_js/jobs/parse_wig30.py` | `sources/csv/wig30_m.csv` | `data-wig30.js` |
| `spx` | `scripts/csv_to_js/jobs/parse_spx.py` | `sources/csv/spx_m.csv` | `data-spx.js` |
| `usdpln` | `scripts/csv_to_js/jobs/parse_usdpln.py` | `sources/csv/usdpln_m.csv` | `data-usdpln.js` |
| `cpi-monthly` | `scripts/csv_to_js/jobs/parse_cpi_monthly.py` | `sources/csv/miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv` | `data-cpi-monthly.js` |
| `cpi-annual` | `scripts/csv_to_js/jobs/parse_cpi_annual.py` | `sources/csv/rocznewskaznikicentowarowiuslugkonsumpcyjnychod1950roku_2.csv` | `data-cpi-annual.js` |

Przydatne opcje:
- `--workers N` — liczba procesów równoległych.
- `--output-dir /sciezka` — wygenerowanie plików do katalogu tymczasowego zamiast nadpisywania głównych `data-*.js`.

## Projekcja przyszłości

### Kalkulator kredytu (`index.html`)
Konfigurowalne parametry z poziomu interfejsu (sekcja „Projekcje przyszłe"):
- Przyszły WIBOR (domyślnie 3,0%) — stosowany dla WIBOR 1M, 3M i 6M
- Przyszła inflacja CPI (domyślnie 3,0%); w trybie CPI m/m przeliczana automatycznie
- Przyszły wzrost wynagrodzeń (domyślnie 3,5%)

### Symulator nadpłat (`symulator-nadplat.html`)
Konfigurowalne parametry z poziomu interfejsu (sekcja „Projekcje przyszłe"):
- Przyszły WIBOR (domyślnie 3,0%) — stosowany dla WIBOR 1M, 3M i 6M
- Przyszła inflacja CPI (domyślnie 3,0%); w trybie CPI m/m przeliczana automatycznie
- Przyszły wzrost wynagrodzeń (domyślnie 3,5%)
- Przyszła stopa zwrotu z akcji (domyślnie 5,0%) — dla WIG30, WIG, S&P 500
- Przyszłe oprocentowanie lokaty (domyślnie 3,0%)
- Przyszły kurs USD/PLN (domyślnie 3,5)

## Testy

Zestawy testów weryfikują poprawność obliczeń w `kalkulator-kredytu.js` i `symulator-nadplat.js`. Testy nie wymagają żadnych zależności poza Node.js.

### Uruchomienie

```bash
node tests/run-tests.js          # Kalkulator kredytu
node tests/run-tests-nadplat.js  # Symulator nadpłat
# pełna regresja:
node tests/run-tests.js && node tests/run-tests-nadplat.js
```

### Jak działają

Każdy test runner (`tests/run-tests.js`, `tests/run-tests-nadplat.js`) ładuje pliki danych i odpowiedni skrypt JS do piaskownicy `vm.createContext()` z zaślepkami DOM/Chart.js, a następnie wykonuje plik testowy wewnątrz tego kontekstu. Dzięki temu testy mają bezpośredni dostęp do wszystkich `const`/`let`/`function` z kodu źródłowego.

### Kalkulator kredytu (39 grup, 106 asercji)

| # | Grupa | Co weryfikuje |
|---|---|---|
| 1 | Stopa miesięczna | `calcMonthlyRate()` — poprawność konwersji roczna→miesięczna |
| 2 | Wzór annuitetowy | `calcRata()` — porównanie z wartościami referencyjnymi |
| 3 | Zerowa stopa | Edge case: stopa 0% → rata = kwota/n |
| 4 | Harmonogram pierwsze miesiące | Fixing, deflator m0=1, rata=odsetki+kapitał |
| 5 | Zbieżność salda | Saldo → 0 po ostatniej racie, suma kapitału = kwota |
| 6 | Raty malejące | Poprawność schematu malejącego, saldo końcowe |
| 7 | Deflator skumulowany (roczny) | Akumulacja deflatora przez 12+ miesięcy |
| 8 | Deflator CPI miesięczny | Tryb m/m — deflator m1 z poprawnego miesiąca |
| 9 | Sumy nominalne | Odsetki = suma rat − kapitał |
| 10 | Sumy realne i zysk inflacyjny | Realne < nominalne; dłuższy kredyt → większy zysk inflacyjny |
| 11 | Dekompozycja czynników | marża\_contrib + wibor\_cpi\_contrib = odsetki realne |
| 12 | Interwały fixingu WIBOR | 1M co 1 mies., 3M co 3 mies., 6M co 6 mies. |
| 13 | Mapowanie miesiąca startowego | calMonth/rok przy starcie w lipcu |
| 14 | Agregacja roczna | `aggregateYearly()` — suma roczna = suma miesięczna |
| 15 | Annualizacja CPI | `annualizeMonthlyCpi()` — round-trip roczne↔miesięczne |
| 16 | Fallback przyszłości | `DEFAULT_FUTURE_WIBOR/CPI/CPI_MONTHLY` |
| 17 | Ujemne odsetki realne | Scenariusz 2021 z niską marżą → odsetki realne < 0 |
| 18 | Malejące: przeliczenie przy fixingu | Część kapitałowa = saldo/remaining |
| 19 | Spot-check danych | CPI 2022, WIBOR 1M/6M 2010, wynagrodzenia |
| 20 | Średnie roczne WIBOR | `WIBOR1M_ANNUAL` / `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` wyliczone |
| 21 | Cross-check annuitet | Porównanie z ręcznie obliczonymi wartościami |
| 22 | calcAvgStats | avgSpread = avgWibor − avgCpi |
| 23 | Deflacja | CPI 2015 < 0 → deflator > 1 |
| 24 | Edge cases: różne okresy | 3-letni i 35-letni kredyt |
| 25 | WIBOR 6M vs 3M/1M | Porównanie harmonogramów trybów WIBOR |
| 26 | Różne miesiące startowe | Styczeń vs październik |
| 27 | rata = odsetki + kapitał | Każdy wiersz harmonogramu (annuitet i malejące) |
| 28 | Saldo monotoniczne (annuitet) | Saldo nierosnące w każdym kroku |
| 29 | Saldo monotoniczne (malejące) | Saldo nierosnące w każdym kroku |
| 30 | Wysoka inflacja 2022 | Deflator < 0.90 po 12 mies. przy CPI 14.4% |
| 31 | Prowizja | 2% z kwoty; realna = nominalna (deflator=1 w m0) |
| 32 | Werdykt — kierunek | 30-letni realnie droższy od 10-letniego przy marży 2% |
| 33 | Granica roku — deflator | Przejście deflatora na styku lat (CPI roku bieżącego) |
| 34 | WIBOR 6M w harmonogramie | Wartość z `getWibor()`, brak fixingu między interwałami |
| 35 | Wskaźnik przystępności | rata / wynagrodzenie w rozsądnym zakresie |
| 36 | getWynagr fallback | Rok przed zakresem i ekstrapolacja 7% |
| 37 | getMonthlyDeflatorFactor | Oba tryby CPI — wartości w rozsądnym zakresie |
| 38 | aggregateYearly — wynagrodzenia | Pole wynagr zgodne z getWynagr() |
| 39 | Parsowanie liczb dziesiętnych | `parseLocaleFloat()` i stany przejściowe inputu (`1,`, `1.`) |

### Symulator nadpłat (98 grup, 284 asercji)

| # | Grupa | Co weryfikuje |
|---|---|---|
| 1 | Stopa miesięczna | `calcMonthlyRate()` — konwersja roczna→miesięczna |
| 2 | Wzór annuitetowy | `calcRataRowna()` — porównanie z wartościami referencyjnymi |
| 3 | Zerowa stopa | Edge case: stopa 0% → rata = kwota/n |
| 4 | Harmonogram bazowy (annuitet) | Fixing, deflator m0=1, rata=odsetki+kapitał |
| 5 | Zbieżność salda (annuitet) | Saldo → 0 po ostatniej racie, suma kapitału = kwota |
| 6 | Raty malejące | Poprawność schematu malejącego, stała część kapitałowa między fixingami |
| 7 | Interwały fixingu WIBOR | 1M co 1 mies., 3M co 3 mies., 6M co 6 mies., poprawne oznaczenie isFix |
| 8 | Deflator skumulowany (roczny) | Akumulacja deflatora przez 12+ miesięcy |
| 9 | Deflator CPI miesięczny | Tryb m/m — deflator m1 z poprawnego miesiąca |
| 10 | Sumy nominalne — spójność | Odsetki = suma rat − kapitał |
| 11 | Mapowanie miesiąca startowego | calMonth/rok przy starcie w lipcu, przejście roku |
| 12 | Agregacja roczna | `aggregateYearly()` — suma roczna = suma miesięczna |
| 13 | Annualizacja CPI | `annualizeMonthlyCpi()` — round-trip roczne↔miesięczne |
| 14 | Fallback przyszłości | `DEFAULT_FUTURE_WIBOR/CPI/CPI_MONTHLY` dla lat poza danymi |
| 15 | rata = odsetki + kapitał | Tożsamość w każdym wierszu (annuitet i malejące) |
| 16 | Saldo monotoniczne | Saldo nierosnące (annuitet i malejące) |
| 17 | Wysoka inflacja 2022 | Deflator < 0.90 po 12 mies. |
| 18 | Spot-check danych | CPI 2022, WIBOR 1M/3M/6M styczeń 2010 |
| 19 | Kwota kredytu — różne wartości | 50k i 1.5M: saldo→0, większa kwota → większa rata |
| 20 | Okres kredytu — różne wartości | 36 i 420 miesięcy: saldo→0, krótszy okres → wyższa rata |
| 21 | Data startu — różne miesiące | Październik: calMonth, rok, przejście roku, nazwy |
| 22 | WIBOR 3M vs 6M | Porównanie harmonogramów, oba zbiegają do 0 |
| 23 | Marża i prowizja | Wyższa marża → wyższa rata/stopa/koszt |
| 24 | Harmonogram z wydarzeniami — brak zdarzeń | Identyczny z bazowym, prowizja=kwota*pct |
| 25 | Nadpłata jednorazowa — krótszy okres | Mniej wierszy, saldo→0, kwota/event poprawne |
| 26 | Nadpłata jednorazowa — niższa rata | Okres bez zmian (360), rata niższa po nadpłacie |
| 27 | Pełna wcześniejsza spłata | Kredyt zamknięty w miesiącu splaty, saldo=0 |
| 28 | Refinansowanie | Nowa marża, prowizja ref, wiersz z eventem |
| 29 | Refinansowanie ze zmianą WIBOR | Zmiana z 3M na 6M, natychmiastowy fixing |
| 30 | Nadpłata cykliczna — doKońca=true | `expandEvents()` rozwija do końca kredytu |
| 31 | Nadpłata cykliczna — doKońca=false | `expandEvents()` rozwija do wskazanej daty (24 zdarzenia) |
| 32 | Nadpłata cykliczna — harmonogram | Skrócenie kredytu, wiele wierszy z nadpłatami |
| 33 | Nadpłata cykliczna — niższa rata | Mała kwota: okres 360; duża kwota: saldo→0 wcześniej |
| 34 | Nadpłata zamykająca kredyt | Nadpłata > saldo: kredyt zamknięty natychmiast |
| 35 | expandEvents — jednorazowe | Nadpłata/spłata/refinansowanie: 3 elementy bez rozwijania |
| 36 | expandEvents — graniczne daty | Zdarzenia sprzed startu kredytu odfiltrowane |
| 37 | Kolejność przetwarzania zdarzeń | Refinansowanie → nadpłata → spłata w tym samym miesiącu |
| 38 | Malejące + nadpłata — krótszy okres | Mniej wierszy, saldo→0 |
| 39 | Malejące + nadpłata — niższa rata | Okres bez zmian (360) |
| 40 | Malejące + pełna spłata | Kredyt zamknięty, saldo=0 |
| 41 | Malejące + refinansowanie | Wiersz refinansowania z fixing=true |
| 42 | Prowizje — początkowa i refinansowania | Łączne prowizje, realne < nominalne |
| 43 | Wiele zdarzeń w różnych miesiącach | Łączna nadpłata, prowizje ≥ początkowej |
| 44 | Spójność: raty + nadpłaty = kapitał + odsetki | Tożsamość bilansowa |
| 45 | Nadpłata oszczędza odsetki | Odsetki z nadpłatą < odsetki bazowe |
| 46 | Deflator w harmonogramie z wydarzeniami | Deflator m0=1, m12<1 |
| 47 | Metodyka krok 1: oprocentowanie | WIBOR startu, stopa=WIBOR+marża |
| 48 | Metodyka krok 2: rata miesięczna | Annuitet i malejące: wzory poprawne |
| 49 | Metodyka krok 3: rata realna | Deflator m1, rata realna < nominalna |
| 50 | Metodyka krok 4: efekt nadpłaty | Krótszy okres vs niższa rata |
| 51 | Metodyka krok 5: refinansowanie | Nowa marża, natychmiastowy fixing, stopa po ref |
| 52 | Metodyka krok 6: prowizje | Prowizja nie zwiększa salda |
| 53 | Walidacja kolumn tabeli | Wszystkie pola wiersza harmonogramu obecne |
| 54 | Tabela z wydarzeniami — pola | Nadpłata/spłata: poprawne pola event/nadplata/saldo |
| 55 | Formatowanie (fmtOkres) | 360m=30lat, 120m=10lat, 5m, 25m=2lat 1mies |
| 56 | Porównanie bazowy vs zmodyfikowany | Suma rat zmodyfikowanego < bazowego |
| 57 | CPI roczne vs miesięczne | Raty nominalne identyczne, deflatory różne |
| 58 | getWynagr i calcAvgStats | Wynagrodzenia, ekstrapolacja, avgSpread |
| 59 | Salary source — różne źródła | Minimalne < przeciętne |
| 60 | Nadpłata w miesiącu 0 | Nadpłata na starcie kredytu |
| 61 | Wielokrotna nadpłata w tym samym miesiącu | Łączna kwota dwóch nadpłat |
| 62 | Refinansowanie + nadpłata w tym samym miesiącu | Kolejność: ref→nadpłata, prowizje |
| 63 | fixCounterSinceReset po refinansowaniu | Nowy cykl fixingu po refinansowaniu |
| 64 | Prowizja zerowa | 0% → totalProwizje = 0 |
| 65 | Nadpłata nie przekracza salda | Obcięcie kwoty do salda |
| 66 | Data label format | Poprawny format „sty 2010", „gru 2010" |
| 67–72 | Dane inwestycyjne — spot-check | WIG30, WIG, SPX, USDPLN, WIBOR1M, NBP_RATE: istnienie kluczy, wartości > 0, fill-forward bez luk |
| 73–77 | getMonthlyInvestmentReturn | WIG30, S&P 500 w PLN, fallback dla przyszłości, lokata historyczna i fallback |
| 78–83 | calcInvestmentPortfolio | Brak nadpłat → null; WIG30, lokata, gotówka, S&P 500, cykliczne nadpłaty |
| 84–85 | Podatek Belki | 19% od zysku na koniec; brak podatku przy stracie |
| 86 | Bilans: nadpłata vs inwestycja | Bilans nominalny = oszczędność odsetek nom. − zysk netto nom. |
| 87–88 | Portfel realny | Wartość realna z deflatorem CPI, spójność wpłat |
| 89 | investment_type = none | Brak instrumentu → null |
| 90–91 | WIBOR 1M | fixInterval=1 (każdy miesiąc to fixing), roczne średnie |
| 92–95 | Projekcje przyszłe | Fallback WIBOR/CPI/wynagrodzenia, stopa gotówki = 0 |
| 96 | Deflator inwestycji (CPI miesięczne) | Iloczyn miesięcznych deflatorów CPI i zgodność portfela real netto |
| 97 | Zysk realny netto inwestycji | Realne wpłaty `Σ(wpłata×deflator)` i bilans realny bez mieszania z nominalem |
| 98 | Parsowanie liczb dziesiętnych | `parseLocaleFloat()` i stany przejściowe inputu (`1,`, `1.`) |

## Ograniczenia

Oba narzędzia mają charakter poglądowy. Nie uwzględniają: ubezpieczeń, wakacji kredytowych, spreadu walutowego. Kalkulator i symulator uwzględniają prowizje (kalkulator: początkową; symulator: początkową i przy refinansowaniu), ale traktują je jako koszt pozabilansowy (niepowiększający salda). Analiza inwestycyjna pomija koszty transakcyjne, prowizje maklerskie, spread walutowy i dywidendy. Podatek Belki (19%) jest naliczany od zysku na koniec okresu.
