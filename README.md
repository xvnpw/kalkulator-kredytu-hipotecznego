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
- Źródło CPI: miesięczne m/m (GUS, „poprzedni miesiąc = 100”)
- Wybór źródła danych wynagrodzeń: przeciętne wynagrodzenie / wynagrodzenie minimalne
- Sekcja **„Projekcje przyszłe”**: przyszły WIBOR, przyszła inflacja CPI, przyszły wzrost wynagrodzeń
- Dwa okresy kredytowania do porównania: **Wariant A** (długi) vs **Wariant B** (krótki)
- Pola dziesiętne akceptują zarówno kropkę (`1.85`), jak i przecinek (`1,85`)

### Obliczenia
- **Harmonogram ratalny** z refixingiem WIBOR co 1, 3 lub 6 miesięcy od daty startu, dla rat równych i malejących
- **Prowizja banku** jest doliczana jako koszt jednorazowy na starcie i nie zwiększa salda kredytu
- **Realna wartość płatności** — każda rata dyskontowana skumulowanym deflaktorem CPI (deflator = 1,0 w miesiącu 0; dla każdego miesiąca bezpośredni mnożnik `1 / (1 + CPI m/m)`)
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
- CPI m/m (GUS) oraz wybór źródła wynagrodzeń (jak w kalkulatorze)
- Pola dziesiętne akceptują zarówno kropkę (`1.85`), jak i przecinek (`1,85`)
- Domyślne wartości startowe: rok **2005**, miesiąc **styczeń**, okres **360 miesięcy**, marża **2,0%**, prowizja **2,0%**, porównanie z inwestycją: **Brak (nie porównuj)**

### Projekcje przyszłe
Konfigurowalne wartości domyślne dla okresów bez danych historycznych:
- Przyszły WIBOR 1M/3M/6M (domyślnie 4,0% — inflacja + 1 pp)
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
| ⏩ **Wydłużenie okresu** | Dodaj N miesięcy do pozostałego harmonogramu — rata przeliczana natychmiast na nową, niższą (saldo i stopa bez zmian) |

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
| `data-cpi-monthly.js` | Miesięczne wskaźniki CPI m/m od 1982 r. (poprzedni miesiąc = 100, wartość = wskaźnik−100) | `sources/csv/miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv` |
| `data-wynagrodzenia-przecietne.js` | Przeciętne miesięczne wynagrodzenie brutto (ogółem) | BDL GUS — zmienna 64428 + ZUS (lata 2000–2001) |
| `data-wynagrodzenia-minimalne.js` | Minimalne wynagrodzenie za pracę (miesięczna stawka, wartość per rok) | ZUS (od 2003 r.) + dane historyczne 2000–2002 |
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

Przydatne opcje:
- `--workers N` — liczba procesów równoległych.
- `--output-dir /sciezka` — wygenerowanie plików do katalogu tymczasowego zamiast nadpisywania głównych `data-*.js`.

## Projekcja przyszłości

### Kalkulator kredytu (`index.html`)
Konfigurowalne parametry z poziomu interfejsu (sekcja „Projekcje przyszłe"):
- Przyszły WIBOR (domyślnie 4,0% — inflacja + 1 pp) — stosowany dla WIBOR 1M, 3M i 6M
- Przyszła inflacja CPI (domyślnie 3,0% rocznie, automatycznie przeliczana na m/m)
- Przyszły wzrost wynagrodzeń (domyślnie 3,5%)

### Symulator nadpłat (`symulator-nadplat.html`)
Konfigurowalne parametry z poziomu interfejsu (sekcja „Projekcje przyszłe"):
- Przyszły WIBOR (domyślnie 4,0% — inflacja + 1 pp) — stosowany dla WIBOR 1M, 3M i 6M
- Przyszła inflacja CPI (domyślnie 3,0% rocznie, automatycznie przeliczana na m/m)
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

### Kalkulator kredytu (38 grup, 104 asercje)

| # | Grupa | Co weryfikuje |
|---|---|---|
| 1 | Stopa miesięczna | `calcMonthlyRate()` — poprawność konwersji roczna→miesięczna |
| 2 | Wzór annuitetowy | `calcRata()` — porównanie z wartościami referencyjnymi |
| 3 | Zerowa stopa | Edge case: stopa 0% → rata = kwota/n |
| 4 | Harmonogram pierwsze miesiące | Fixing, deflator m0=1, rata=odsetki+kapitał |
| 5 | Zbieżność salda | Saldo → 0 po ostatniej racie, suma kapitału = kwota |
| 6 | Raty malejące | Poprawność schematu malejącego, saldo końcowe |
| 7 | Deflator skumulowany (m/m) | `D[1] = 1/(1+CPI m/m)`; `D[12] = iloczyn 12 czynników` |
| 8 | Sumy nominalne | Odsetki = suma rat − kapitał |
| 9 | Sumy realne i zysk inflacyjny | Realne < nominalne; dłuższy kredyt → większy zysk inflacyjny |
| 10 | Dekompozycja czynników | marża\_contrib + wibor\_cpi\_contrib = odsetki realne |
| 11 | Interwały fixingu WIBOR | 1M co 1 mies., 3M co 3 mies., 6M co 6 mies. |
| 12 | Mapowanie miesiąca startowego | calMonth/rok przy starcie w lipcu |
| 13 | Agregacja roczna | `aggregateYearly()` — suma roczna = suma miesięczna |
| 14 | Annualizacja CPI | `annualizeMonthlyCpi()` — round-trip roczne↔miesięczne |
| 15 | Fallback przyszłości | `DEFAULT_FUTURE_WIBOR/CPI_MONTHLY` |
| 16 | Ujemne odsetki realne | Scenariusz 2021 z niską marżą → odsetki realne < 0 |
| 17 | Malejące: przeliczenie przy fixingu | Część kapitałowa = saldo/remaining |
| 18 | Spot-check danych | Annualizowana CPI 2022, WIBOR 1M/6M 2010, wynagrodzenia |
| 19 | Średnie roczne WIBOR | `WIBOR1M_ANNUAL` / `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` wyliczone |
| 20 | Cross-check annuitet | Porównanie z ręcznie obliczonymi wartościami |
| 21 | calcAvgStats | avgSpread = avgWibor − avgCpi |
| 22 | Deflacja (m/m) | CPI m/m 2015 ujemne → deflator > 1 |
| 23 | Edge cases: różne okresy | 3-letni i 35-letni kredyt |
| 24 | WIBOR 6M vs 3M/1M | Porównanie harmonogramów trybów WIBOR |
| 25 | Różne miesiące startowe | Styczeń vs październik |
| 26 | rata = odsetki + kapitał | Każdy wiersz harmonogramu (annuitet i malejące) |
| 27 | Saldo monotoniczne (annuitet) | Saldo nierosnące w każdym kroku |
| 28 | Saldo monotoniczne (malejące) | Saldo nierosnące w każdym kroku |
| 29 | Wysoka inflacja 2022 | Deflator < 0.90 po 12 mies. przy CPI 14.4% |
| 30 | Prowizja | 2% z kwoty; realna = nominalna (deflator=1 w m0) |
| 31 | Werdykt — kierunek | 30-letni realnie droższy od 10-letniego przy marży 2% |
| 32 | Granica roku — deflator (m/m) | `factor = 1/(1+CPI m/m grudzień)` na styku lat |
| 33 | WIBOR 6M w harmonogramie | Wartość z `getWibor()`, brak fixingu między interwałami |
| 34 | Wskaźnik przystępności | rata / wynagrodzenie w rozsądnym zakresie |
| 35 | getWynagr fallback | Rok przed zakresem i ekstrapolacja 7% |
| 36 | getMonthlyDeflatorFactor | `1 / (1 + CPI m/m)` — wartość w rozsądnym zakresie |
| 37 | aggregateYearly — wynagrodzenia | Pole wynagr zgodne z getWynagr() |
| 38 | Parsowanie liczb dziesiętnych | `parseLocaleFloat()` i stany przejściowe inputu (`1,`, `1.`) |

### Symulator nadpłat (100 grup, 306 asercji)

| # | Grupa | Co weryfikuje |
|---|---|---|
| 1 | Stopa miesięczna | `calcMonthlyRate()` — konwersja roczna→miesięczna |
| 2 | Wzór annuitetowy | `calcRataRowna()` — porównanie z wartościami referencyjnymi |
| 3 | Zerowa stopa | Edge case: stopa 0% → rata = kwota/n |
| 4 | Harmonogram bazowy (annuitet) | Fixing, deflator m0=1, rata=odsetki+kapitał |
| 5 | Zbieżność salda (annuitet) | Saldo → 0 po ostatniej racie, suma kapitału = kwota |
| 6 | Raty malejące | Poprawność schematu malejącego, stała część kapitałowa między fixingami |
| 7 | Interwały fixingu WIBOR | 1M co 1 mies., 3M co 3 mies., 6M co 6 mies., poprawne oznaczenie isFix |
| 8 | Deflator skumulowany (m/m) | `D[1] = 1/(1+CPI m/m)`; `D[12] = iloczyn 12 czynników` |
| 9 | Sumy nominalne — spójność | Odsetki = suma rat − kapitał |
| 10 | Mapowanie miesiąca startowego | calMonth/rok przy starcie w lipcu, przejście roku |
| 11 | Agregacja roczna | `aggregateYearly()` — suma roczna = suma miesięczna |
| 12 | Annualizacja CPI | `annualizeMonthlyCpi()` — round-trip roczne↔miesięczne |
| 13 | Fallback przyszłości | `DEFAULT_FUTURE_WIBOR/CPI_MONTHLY` dla lat poza danymi |
| 14 | rata = odsetki + kapitał | Tożsamość w każdym wierszu (annuitet i malejące) |
| 15 | Saldo monotoniczne | Saldo nierosnące (annuitet i malejące) |
| 16 | Wysoka inflacja 2022 | Deflator < 0.90 po 12 mies. |
| 17 | Spot-check danych | Annualizowana CPI 2022, WIBOR 1M/3M/6M styczeń 2010 |
| 18 | Kwota kredytu — różne wartości | 50k i 1.5M: saldo→0, większa kwota → większa rata |
| 19 | Okres kredytu — różne wartości | 36 i 420 miesięcy: saldo→0, krótszy okres → wyższa rata |
| 20 | Data startu — różne miesiące | Październik: calMonth, rok, przejście roku, nazwy |
| 21 | WIBOR 3M vs 6M | Porównanie harmonogramów, oba zbiegają do 0 |
| 22 | Marża i prowizja | Wyższa marża → wyższa rata/stopa/koszt |
| 23 | Harmonogram z wydarzeniami — brak zdarzeń | Identyczny z bazowym, prowizja=kwota*pct |
| 24 | Nadpłata jednorazowa — krótszy okres | Mniej wierszy, saldo→0, kwota/event poprawne |
| 25 | Nadpłata jednorazowa — niższa rata | Okres bez zmian (360), rata niższa po nadpłacie |
| 26 | Pełna wcześniejsza spłata | Kredyt zamknięty w miesiącu splaty, saldo=0 |
| 27 | Refinansowanie | Nowa marża, prowizja ref, wiersz z eventem |
| 28 | Refinansowanie ze zmianą WIBOR | Zmiana z 3M na 6M, natychmiastowy fixing |
| 29 | Nadpłata cykliczna — doKońca=true | `expandEvents()` rozwija do końca kredytu |
| 30 | Nadpłata cykliczna — doKońca=false | `expandEvents()` rozwija do wskazanej daty (24 zdarzenia) |
| 31 | Nadpłata cykliczna — harmonogram | Skrócenie kredytu, wiele wierszy z nadpłatami |
| 32 | Nadpłata cykliczna — niższa rata | Mała kwota: okres 360; duża kwota: saldo→0 wcześniej |
| 33 | Nadpłata zamykająca kredyt | Nadpłata > saldo: kredyt zamknięty natychmiast |
| 34 | expandEvents — jednorazowe | Nadpłata/spłata/refinansowanie: 3 elementy bez rozwijania |
| 35 | expandEvents — graniczne daty | Zdarzenia sprzed startu kredytu odfiltrowane |
| 36 | Kolejność przetwarzania zdarzeń | Refinansowanie → nadpłata → spłata w tym samym miesiącu |
| 37 | Malejące + nadpłata — krótszy okres | Mniej wierszy, saldo→0 |
| 38 | Malejące + nadpłata — niższa rata | Okres bez zmian (360) |
| 39 | Malejące + pełna spłata | Kredyt zamknięty, saldo=0 |
| 40 | Malejące + refinansowanie | Wiersz refinansowania z fixing=true |
| 41 | Prowizje — początkowa i refinansowania | Łączne prowizje, realne < nominalne |
| 42 | Wiele zdarzeń w różnych miesiącach | Łączna nadpłata, prowizje ≥ początkowej |
| 43 | Spójność: raty + nadpłaty = kapitał + odsetki | Tożsamość bilansowa |
| 44 | Nadpłata oszczędza odsetki | Odsetki z nadpłatą < odsetki bazowe |
| 45 | Deflator w harmonogramie z wydarzeniami | Deflator m0=1, m12<1 |
| 46 | Metodyka krok 1: oprocentowanie | WIBOR startu, stopa=WIBOR+marża |
| 47 | Metodyka krok 2: rata miesięczna | Annuitet i malejące: wzory poprawne |
| 48 | Metodyka krok 3: rata realna | Deflator m1 (m/m), rata realna < nominalna |
| 49 | Metodyka krok 4: efekt nadpłaty | Krótszy okres vs niższa rata |
| 50 | Metodyka krok 5: refinansowanie | Nowa marża, natychmiastowy fixing, stopa po ref |
| 51 | Metodyka krok 6: prowizje | Prowizja nie zwiększa salda |
| 52 | Walidacja kolumn tabeli | Wszystkie pola wiersza harmonogramu obecne |
| 53 | Tabela z wydarzeniami — pola | Nadpłata/spłata: poprawne pola event/nadplata/saldo |
| 54 | Formatowanie (fmtOkres) | 360m=30lat, 120m=10lat, 5m, 25m=2lat 1mies |
| 55 | Porównanie bazowy vs zmodyfikowany | Suma rat zmodyfikowanego < bazowego |
| 56 | getWynagr i calcAvgStats | Wynagrodzenia, ekstrapolacja, avgSpread |
| 57 | Salary source — różne źródła | Minimalne < przeciętne |
| 58 | Nadpłata w miesiącu 0 | Nadpłata na starcie kredytu |
| 59 | Wielokrotna nadpłata w tym samym miesiącu | Łączna kwota dwóch nadpłat |
| 60 | Refinansowanie + nadpłata w tym samym miesiącu | Kolejność: ref→nadpłata, prowizje |
| 61 | fixCounterSinceReset po refinansowaniu | Nowy cykl fixingu po refinansowaniu |
| 62 | Prowizja zerowa | 0% → totalProwizje = 0 |
| 63 | Nadpłata nie przekracza salda | Obcięcie kwoty do salda |
| 64 | Data label format | Poprawny format „sty 2010", „gru 2010" |
| 65–70 | Dane inwestycyjne — spot-check | WIG30, WIG, SPX, USDPLN, WIBOR1M, NBP_RATE: istnienie kluczy, wartości > 0, fill-forward bez luk |
| 71–75 | getMonthlyInvestmentReturn | WIG30, S&P 500 w PLN, fallback dla przyszłości, lokata historyczna i fallback |
| 76–81 | calcInvestmentPortfolio | Brak nadpłat → null; WIG30, lokata, gotówka, S&P 500, cykliczne nadpłaty |
| 82–83 | Podatek Belki | 19% od zysku na koniec; brak podatku przy stracie |
| 84 | Bilans: nadpłata vs inwestycja | Bilans nominalny = oszczędność odsetek nom. − zysk netto nom. |
| 85–86 | Portfel realny | Wartość realna z deflatorem CPI, spójność wpłat |
| 87 | investment_type = none | Brak instrumentu → null |
| 88–89 | WIBOR 1M | fixInterval=1 (każdy miesiąc to fixing), roczne średnie |
| 90–93 | Projekcje przyszłe | Fallback WIBOR/CPI m/m/wynagrodzenia, stopa gotówki = 0 |
| 94 | Deflator inwestycji (CPI m/m) | Iloczyn miesięcznych deflatorów CPI i zgodność portfela real netto |
| 95 | Zysk realny netto inwestycji | Realne wpłaty `Σ(wpłata×deflator)` i bilans realny bez mieszania z nominalem |
| 96 | Parsowanie liczb dziesiętnych | `parseLocaleFloat()` i stany przejściowe inputu (`1,`, `1.`) |
| 99 | Wydłużenie okresu — annuitet | `effectiveEndMonth += N`, rata spada, saldo i kapitał spójne, wydłużenie nie wymusza fixingu WIBOR |
| 100 | Wydłużenie okresu — malejące | `czescKapitalowa = saldo / (remaining+N)`, długość harmonogramu = `nMonths + N` |
| 101 | Kolejność refi + wydłużenie + nadpłata | Wyniki niezależne od kolejności dodania zdarzeń; prowizja refi liczona na saldzie przed nadpłatą i wydłużeniem |
| 102 | Wydłużenie: ochrona wartości | `miesiace = 0` / `NaN` → minimum 1 (regresja wzorca `\|\| default`) |

## Ograniczenia

Oba narzędzia mają charakter poglądowy. Nie uwzględniają: ubezpieczeń, wakacji kredytowych, spreadu walutowego. Kalkulator i symulator uwzględniają prowizje (kalkulator: początkową; symulator: początkową i przy refinansowaniu), ale traktują je jako koszt pozabilansowy (niepowiększający salda). Analiza inwestycyjna pomija koszty transakcyjne, prowizje maklerskie, spread walutowy i dywidendy. Podatek Belki (19%) jest naliczany od zysku na koniec okresu.
