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
- Prowizja banku (%) — koszt jednorazowy (domyślnie 2,0%)
- Typ raty: **rata równa** (annuitet) lub **rata malejąca**
- Wybór wskaźnika: WIBOR 3M lub WIBOR 6M
- Wybór danych CPI: roczne (GUS) lub miesięczne m/m (GUS, „poprzedni miesiąc = 100”)
- Wybór źródła danych wynagrodzeń: sektor prywatny / przeciętne wynagrodzenie / wynagrodzenie minimalne
- Dwa okresy kredytowania do porównania: **Wariant A** (długi) vs **Wariant B** (krótki)

### Obliczenia
- **Harmonogram ratalny** z refixingiem WIBOR co 3 lub 6 miesięcy od daty startu, dla rat równych i malejących
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
- Wybór wskaźnika: WIBOR 3M lub WIBOR 6M (domyślnie WIBOR 3M)
- Wybór danych CPI i źródła wynagrodzeń (jak w kalkulatorze)
- Domyślne wartości startowe: rok **2010**, miesiąc **styczeń**, okres **360 miesięcy**, marża **2,0%**, prowizja **2,0%**

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

## Testy

Zestawy testów weryfikują poprawność obliczeń w `kalkulator-kredytu.js` i `symulator-nadplat.js`. Testy nie wymagają żadnych zależności poza Node.js.

### Uruchomienie

```bash
node tests/run-tests.js          # Kalkulator kredytu
node tests/run-tests-nadplat.js  # Symulator nadpłat
```

### Jak działają

Każdy test runner (`tests/run-tests.js`, `tests/run-tests-nadplat.js`) ładuje pliki danych i odpowiedni skrypt JS do piaskownicy `vm.createContext()` z zaślepkami DOM/Chart.js, a następnie wykonuje plik testowy wewnątrz tego kontekstu. Dzięki temu testy mają bezpośredni dostęp do wszystkich `const`/`let`/`function` z kodu źródłowego.

### Kalkulator kredytu (38 grup, 92 asercje)

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
| 12 | Interwały fixingu WIBOR | 3M co 3 mies., 6M co 6 mies. |
| 13 | Mapowanie miesiąca startowego | calMonth/rok przy starcie w lipcu |
| 14 | Agregacja roczna | `aggregateYearly()` — suma roczna = suma miesięczna |
| 15 | Annualizacja CPI | `annualizeMonthlyCpi()` — round-trip roczne↔miesięczne |
| 16 | Fallback przyszłości | `DEFAULT_FUTURE_WIBOR/CPI/CPI_MONTHLY` |
| 17 | Ujemne odsetki realne | Scenariusz 2021 z niską marżą → odsetki realne < 0 |
| 18 | Malejące: przeliczenie przy fixingu | Część kapitałowa = saldo/remaining |
| 19 | Spot-check danych | CPI 2022, WIBOR 2010, wynagrodzenia |
| 20 | Średnie roczne WIBOR | `WIBOR6M_ANNUAL` / `WIBOR3M_ANNUAL` wyliczone |
| 21 | Cross-check annuitet | Porównanie z ręcznie obliczonymi wartościami |
| 22 | calcAvgStats | avgSpread = avgWibor − avgCpi |
| 23 | Deflacja | CPI 2015 < 0 → deflator > 1 |
| 24 | Edge cases: różne okresy | 3-letni i 35-letni kredyt |
| 25 | WIBOR 6M vs 3M | Porównanie harmonogramów obu trybów |
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

### Symulator nadpłat (66 grup, 215 asercji)

| # | Grupa | Co weryfikuje |
|---|---|---|
| 1 | Stopa miesięczna | `calcMonthlyRate()` — konwersja roczna→miesięczna |
| 2 | Wzór annuitetowy | `calcRataRowna()` — porównanie z wartościami referencyjnymi |
| 3 | Zerowa stopa | Edge case: stopa 0% → rata = kwota/n |
| 4 | Harmonogram bazowy (annuitet) | Fixing, deflator m0=1, rata=odsetki+kapitał |
| 5 | Zbieżność salda (annuitet) | Saldo → 0 po ostatniej racie, suma kapitału = kwota |
| 6 | Raty malejące | Poprawność schematu malejącego, stała część kapitałowa między fixingami |
| 7 | Interwały fixingu WIBOR | 3M co 3 mies., 6M co 6 mies., poprawne oznaczenie isFix |
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
| 18 | Spot-check danych | CPI 2022, WIBOR 3M/6M styczeń 2010 |
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
| 59 | Salary source — różne źródła | Minimalne < przeciętne < prywatne |
| 60 | Nadpłata w miesiącu 0 | Nadpłata na starcie kredytu |
| 61 | Wielokrotna nadpłata w tym samym miesiącu | Łączna kwota dwóch nadpłat |
| 62 | Refinansowanie + nadpłata w tym samym miesiącu | Kolejność: ref→nadpłata, prowizje |
| 63 | fixCounterSinceReset po refinansowaniu | Nowy cykl fixingu po refinansowaniu |
| 64 | Prowizja zerowa | 0% → totalProwizje = 0 |
| 65 | Nadpłata nie przekracza salda | Obcięcie kwoty do salda |
| 66 | Data label format | Poprawny format „sty 2010", „gru 2010" |

## Ograniczenia

Oba narzędzia mają charakter poglądowy. Nie uwzględniają: ubezpieczeń, wakacji kredytowych, spreadu walutowego, ani podatku od odsetek. Kalkulator i symulator uwzględniają prowizje (kalkulator: początkową; symulator: początkową i przy refinansowaniu), ale traktują je jako koszt pozabilansowy (niepowiększający salda).
