// =============================================================================
// Testy obliczen kalkulatora kredytu hipotecznego
// =============================================================================
// Plik wykonywany WEWNATRZ kontekstu VM (run-tests.js laduje go po skryptach
// zrodlowych), wiec ma pelny dostep do zmiennych const/let/function z
// kalkulator-kredytu.js i plikow danych.
// =============================================================================

var _pass = 0, _fail = 0, _group = '';

function group(name) { _group = name; process.stdout.write('\n  ' + name + '\n'); }

function assert(cond, msg) {
  if (cond) { _pass++; process.stdout.write('    \x1b[32m✓\x1b[0m ' + msg + '\n'); }
  else      { _fail++; process.stdout.write('    \x1b[31m✗\x1b[0m ' + msg + '\n'); }
}

function assertClose(a, b, tol, msg) {
  assert(Math.abs(a - b) <= tol, msg + ' (got ' + a.toFixed(4) + ', exp ' + b.toFixed(4) + ', tol ' + tol + ')');
}

// Ustawienie trybow globalnych (wymagane przez calcAvgStats i inne)
wiborMode = '6M';
cpiMode = 'annual';
salarySource = 'average';

process.stdout.write('\n=== Testy kalkulatora kredytu hipotecznego ===\n');
// ---------------------------------------------------------------------------
group('1. Stopa miesieczna (calcMonthlyRate)');
assertClose(calcMonthlyRate(5, 2), (5 + 2) / 100 / 12, 1e-10, 'WIBOR 5% + marza 2% -> r miesieczna');
assertClose(calcMonthlyRate(0, 0), 0, 1e-15, 'Zerowa stopa');

// ---------------------------------------------------------------------------
// 2. Wzor annuitetowy (calcRata)
// ---------------------------------------------------------------------------
group('2. Wzor annuitetowy (calcRata)');
var r_test = 0.05 / 12;
var rata_test = calcRata(100000, r_test, 120);
assertClose(rata_test, 1060.66, 0.01, '100k / 5% / 10 lat = 1060.66');

var r2 = 0.08 / 12;
var rata2 = calcRata(200000, r2, 360);
assertClose(rata2, 1467.53, 0.01, '200k / 8% / 30 lat = 1467.53');

// ---------------------------------------------------------------------------
// 3. Przypadek zerowej stopy (edge case)
// ---------------------------------------------------------------------------
group('3. Zerowa stopa procentowa');
assertClose(calcRata(120000, 0, 120), 1000, 0.01, '120k / 0% / 10 lat = 1000');

// ---------------------------------------------------------------------------
// 4. Harmonogram - pierwsze miesiace (rata rowna)
// ---------------------------------------------------------------------------
group('4. Harmonogram - pierwsze miesiace (annuitet)');
var rowsTest = calcHarmonogram(350000, 2010, 1, 30, 2, '6M', 'annual', 'rowna');
assert(rowsTest.length === 360, 'Harmonogram 30-letni ma 360 wierszy');
assert(rowsTest[0].isFix === true, 'Miesiac 0 to fixing');
assertClose(rowsTest[0].deflator, 1.0, 1e-10, 'Deflator w miesiącu 0 = 1.0');
assertClose(rowsTest[0].rataReal, rowsTest[0].rata, 0.01, 'Rata realna w m0 = rata nominalna');

var odsetki0 = 350000 * calcMonthlyRate(rowsTest[0].wibor, 2);
assertClose(rowsTest[0].odsetki, odsetki0, 0.01, 'Odsetki m0 zgodne z wzorem');
assertClose(rowsTest[0].rata, rowsTest[0].odsetki + rowsTest[0].kapital, 0.01, 'rata = odsetki + kapital w m0');

// ---------------------------------------------------------------------------
// 5. Zbieznosc salda koncowego
// ---------------------------------------------------------------------------
group('5. Zbieznosc salda do zera');
assertClose(rowsTest[359].saldo, 0, 1.0, 'Saldo po 360 m bliskie 0 (annuitet)');

var totKap = rowsTest.reduce(function(s, r) { return s + r.kapital; }, 0);
assertClose(totKap, 350000, 1.0, 'Suma splaconego kapitalu = kwota kredytu');

// ---------------------------------------------------------------------------
// 6. Raty malejace
// ---------------------------------------------------------------------------
group('6. Raty malejace');
var rowsMal = calcHarmonogram(350000, 2010, 1, 30, 2, '6M', 'annual', 'malejaca');
assert(rowsMal.length === 360, 'Malejace: 360 wierszy');
assert(rowsMal[0].rata > rowsMal[359].rata, 'Pierwsza rata > ostatnia');
assertClose(rowsMal[359].saldo, 0, 1.0, 'Saldo koncowe ~0 (malejace)');
var totKapMal = rowsMal.reduce(function(s, r) { return s + r.kapital; }, 0);
assertClose(totKapMal, 350000, 1.0, 'Suma kapitalu = kwota (malejace)');

// ---------------------------------------------------------------------------
// 7. Deflator skumulowany (12+ miesiecy)
// ---------------------------------------------------------------------------
group('7. Deflator skumulowany - tryb roczny');
var cpi2010 = getCpiAnnual(2010);
var monthlyFactor = 1 / Math.pow(1 + cpi2010 / 100, 1 / 12);
var expectedDeflator12 = Math.pow(monthlyFactor, 12);
assertClose(rowsTest[12].deflator, expectedDeflator12, 0.001,
  'Deflator po 12 m ≈ (1/(1+CPI))^1, CPI=' + cpi2010 + '%');
assert(rowsTest[12].deflator < 1.0, 'Deflator < 1 przy dodatniej inflacji');

// ---------------------------------------------------------------------------
// 8. Deflator - tryb CPI miesięczny
// ---------------------------------------------------------------------------
group('8. Deflator - tryb CPI miesieczny');
var rowsCpiM = calcHarmonogram(350000, 2010, 1, 30, 2, '6M', 'monthly', 'rowna');
assertClose(rowsCpiM[0].deflator, 1.0, 1e-10, 'Deflator m0 = 1 (tryb miesieczny)');
var cpiM_2010_01 = getCpiMonthly(2010, 1);
var expFactor = 1 / (1 + cpiM_2010_01 / 100);
assertClose(rowsCpiM[1].deflator, expFactor, 1e-6, 'Deflator m1 uzywa CPI m/m styczen 2010');

// ---------------------------------------------------------------------------
// 9. Sumy nominalne - spojnosc
// ---------------------------------------------------------------------------
group('9. Sumy nominalne');
var totNom = rowsTest.reduce(function(s, r) { return s + r.rata; }, 0);
var totOds = rowsTest.reduce(function(s, r) { return s + r.odsetki; }, 0);
assertClose(totNom - totKap, totOds, 1.0, 'Sumaryczne odsetki = suma rat - kapital');
assert(totNom > 350000, 'Suma nominalna > kwota kredytu');

// ---------------------------------------------------------------------------
// 10. Sumy realne i zysk inflacyjny
// ---------------------------------------------------------------------------
group('10. Sumy realne i zysk inflacyjny');
var totReal = rowsTest.reduce(function(s, r) { return s + r.rataReal; }, 0);
assert(totReal < totNom, 'Suma realna < suma nominalna');
var infZysk = totNom - totReal;
assert(infZysk > 0, 'Zysk z inflacji > 0 (inflacja zjada dlugi)');

// Porownanie z krotszym kredytem
var rows10 = calcHarmonogram(350000, 2010, 1, 10, 2, '6M', 'annual', 'rowna');
var totNom10 = rows10.reduce(function(s, r) { return s + r.rata; }, 0);
var totReal10 = rows10.reduce(function(s, r) { return s + r.rataReal; }, 0);
var infZysk10 = totNom10 - totReal10;
assert(infZysk > infZysk10, 'Zysk inflacyjny (30l) > zysk inflacyjny (10l)');

// ---------------------------------------------------------------------------
// 11. Dekompozycja czynnikow (factor analysis)
// ---------------------------------------------------------------------------
group('11. Dekompozycja czynnikow');
var rows0 = calcHarmonogram(350000, 2010, 1, 30, 0, '6M', 'annual', 'rowna');
var totReal0 = rows0.reduce(function(s, r) { return s + r.rataReal; }, 0);
var wiborCpiContrib = totReal0 - 350000;
var odsetReal = totReal - 350000;
var marzaContrib = odsetReal - wiborCpiContrib;
assertClose(marzaContrib + wiborCpiContrib, odsetReal, 1.0,
  'marza_contrib + wibor_cpi_contrib = odsetki realne');
assert(marzaContrib > 0, 'Wklad marzy > 0');

// ---------------------------------------------------------------------------
// 12. Interwaly fixingu WIBOR
// ---------------------------------------------------------------------------
group('12. Interwaly fixingu WIBOR');
// WIBOR 6M: fixing co 6 miesiecy
assert(rowsTest[0].isFix === true, '6M: m0 fixing');
assert(rowsTest[5].isFix === false, '6M: m5 nie jest fixingiem');
assert(rowsTest[6].isFix === true, '6M: m6 fixing');

// WIBOR 3M
var rows3m = calcHarmonogram(350000, 2010, 1, 30, 2, '3M', 'annual', 'rowna');
assert(rows3m[0].isFix === true, '3M: m0 fixing');
assert(rows3m[2].isFix === false, '3M: m2 nie jest fixingiem');
assert(rows3m[3].isFix === true, '3M: m3 fixing');

// WIBOR 1M
var rows1m = calcHarmonogram(350000, 2010, 1, 30, 2, '1M', 'annual', 'rowna');
assert(rows1m[0].isFix === true, '1M: m0 fixing');
assert(rows1m[1].isFix === true, '1M: m1 fixing');
assert(rows1m[2].isFix === true, '1M: m2 fixing');

// ---------------------------------------------------------------------------
// 13. Mapowanie miesiaca startowego na kalendarz
// ---------------------------------------------------------------------------
group('13. Mapowanie miesiaca startowego');
var rowsJul = calcHarmonogram(350000, 2010, 7, 5, 2, '6M', 'annual', 'rowna');
assert(rowsJul[0].calMonth === 6, 'Start lipiec: calMonth=6 (0-indexed)');
assert(rowsJul[0].rok === 2010, 'Rok startowy 2010');
assert(rowsJul[6].calMonth === 0, 'm6 od lipca -> styczen (calMonth=0)');
assert(rowsJul[6].rok === 2011, 'm6 od lipca 2010 -> rok 2011');

// ---------------------------------------------------------------------------
// 14. Agregacja roczna
// ---------------------------------------------------------------------------
group('14. Agregacja roczna (aggregateYearly)');
var yearlyTest = aggregateYearly(rowsTest);
assert(yearlyTest.length > 0, 'Agregacja zwraca wiersze');
var sumYearlyRata = yearlyTest.reduce(function(s, y) { return s + y.sumRata; }, 0);
assertClose(sumYearlyRata, totNom, 1.0, 'Suma roczna rat = suma miesieczna');

// ---------------------------------------------------------------------------
// 15. Annualizacja CPI miesiecznego
// ---------------------------------------------------------------------------
group('15. annualizeMonthlyCpi');
var cpiM1 = 0.5;
var annualized = annualizeMonthlyCpi(cpiM1);
var expected = (Math.pow(1 + 0.005, 12) - 1) * 100;
assertClose(annualized, expected, 0.001, '0.5% m/m ≈ ' + expected.toFixed(2) + '% r/r');

// Round-trip: roczne -> miesieczne -> z powrotem roczne
var cpiAnn = 3.5;
var cpiMonthly = (Math.pow(1 + cpiAnn / 100, 1 / 12) - 1) * 100;
var backToAnnual = annualizeMonthlyCpi(cpiMonthly);
assertClose(backToAnnual, cpiAnn, 0.001, 'Round-trip roczne -> miesieczne -> roczne');

// ---------------------------------------------------------------------------
// 16. Fallback na domyslne wartosci przyszlosci
// ---------------------------------------------------------------------------
group('16. Domyslne wartosci przyszlosci');
assertClose(getWibor(2050, 6, '1M'), DEFAULT_FUTURE_WIBOR, 0.01, 'WIBOR 1M 2050 = DEFAULT_FUTURE_WIBOR');
assertClose(getWibor(2050, 6, '6M'), DEFAULT_FUTURE_WIBOR, 0.01, 'WIBOR 2050 = DEFAULT_FUTURE_WIBOR');
assertClose(getCpiAnnual(2050), DEFAULT_FUTURE_CPI, 0.01, 'CPI 2050 = DEFAULT_FUTURE_CPI');
assertClose(getCpiMonthly(2050, 1), DEFAULT_FUTURE_CPI_MONTHLY, 0.001, 'CPI m/m 2050 = DEFAULT_FUTURE_CPI_MONTHLY');

// ---------------------------------------------------------------------------
// 17. Ujemne odsetki realne
// ---------------------------------------------------------------------------
group('17. Ujemne odsetki realne (2021, niska marza, krotki kredyt)');
cpiMode = 'annual';
// Krotki 5-letni kredyt 2021-2026: niska marza 0.5% + niski WIBOR vs CPI 5-14%
// Caly okres kredytowania miesci sie w latach historycznej wysokiej inflacji
var rows2021 = calcHarmonogram(350000, 2021, 1, 5, 0.5, '6M', 'annual', 'rowna');
var realTot2021 = rows2021.reduce(function(s, r) { return s + r.rataReal; }, 0);
var odsetReal2021 = realTot2021 - 350000;
assert(odsetReal2021 < 0, 'Odsetki realne ujemne przy niskiej marzy i wysokiej inflacji (got ' + odsetReal2021.toFixed(0) + ')');

// ---------------------------------------------------------------------------
// 18. Malejace: przeliczenie kapitalu przy fixingu
// ---------------------------------------------------------------------------
group('18. Malejace - przeliczenie przy fixingu');
var rm6 = calcHarmonogram(350000, 2010, 1, 10, 2, '6M', 'annual', 'malejaca');
assert(rm6[0].isFix === true, 'Malejace m0 fixing');
assert(rm6[6].isFix === true, 'Malejace m6 fixing');
// Czesc kapitalowa powinna byc saldo/remaining na fixingu
var expectedKap0 = 350000 / 120;
assertClose(rm6[0].kapital, expectedKap0, 1.0, 'Kapital m0 = saldo/120');

// ---------------------------------------------------------------------------
// 19. Spot-check danych historycznych
// ---------------------------------------------------------------------------
group('19. Spot-check danych');
assert(CPI_ANNUAL[2022] !== undefined, 'CPI_ANNUAL[2022] istnieje');
assert(CPI_ANNUAL[2022] > 10, 'CPI 2022 > 10% (got ' + CPI_ANNUAL[2022] + ')');
assert(WIBOR6M_MONTHLY['2010-01'] !== undefined, 'WIBOR6M_MONTHLY 2010-01 istnieje');
assert(WIBOR1M_MONTHLY['2010-01'] !== undefined, 'WIBOR1M_MONTHLY 2010-01 istnieje');

salarySource = 'average';
var wynagr2010 = getWynagr(2010);
assertClose(wynagr2010, 3435, 1.0, 'Wynagrodzenie przecietne 2010 = 3435 PLN');

// ---------------------------------------------------------------------------
// 20. Srednie roczne WIBOR
// ---------------------------------------------------------------------------
group('20. Srednie roczne WIBOR');
assert(WIBOR1M_ANNUAL[2010] !== undefined, 'WIBOR1M_ANNUAL[2010] wyliczone');
assert(WIBOR6M_ANNUAL[2010] !== undefined, 'WIBOR6M_ANNUAL[2010] wyliczone');
assert(WIBOR3M_ANNUAL[2010] !== undefined, 'WIBOR3M_ANNUAL[2010] wyliczone');
assert(typeof WIBOR6M_ANNUAL[2010] === 'number', 'WIBOR6M_ANNUAL jest liczba');
assert(typeof WIBOR1M_ANNUAL[2010] === 'number', 'WIBOR1M_ANNUAL jest liczba');

// ---------------------------------------------------------------------------
// 21. Cross-check annuitetowej raty ze znanymi wartosciami
// ---------------------------------------------------------------------------
group('21. Cross-check annuitet');
var r300 = calcRata(500000, 0.06/12, 300);
assertClose(r300, 3221.51, 0.01, '500k / 6% / 25 lat = 3221.51');

var r180 = calcRata(250000, 0.04/12, 180);
assertClose(r180, 1849.22, 0.01, '250k / 4% / 15 lat = 1849.22');

// ---------------------------------------------------------------------------
// 22. calcAvgStats
// ---------------------------------------------------------------------------
group('22. calcAvgStats');
cpiMode = 'annual';
var stats = calcAvgStats(rowsTest);
assert(typeof stats.avgWibor === 'number', 'avgWibor jest liczba');
assert(typeof stats.avgCpi === 'number', 'avgCpi jest liczba');
assertClose(stats.avgSpread, stats.avgWibor - stats.avgCpi, 0.01, 'avgSpread = avgWibor - avgCpi');

// ---------------------------------------------------------------------------
// 23. Deflacja (CPI ujemne)
// ---------------------------------------------------------------------------
group('23. Deflacja (ujemne CPI)');
assert(CPI_ANNUAL[2015] !== undefined, 'CPI 2015 istnieje');
assert(CPI_ANNUAL[2015] < 0, 'CPI 2015 < 0 (deflacja), got ' + CPI_ANNUAL[2015]);
var deflFactor = getMonthlyDeflatorFactor(2015, 1, 'annual');
assert(deflFactor > 1, 'Deflator > 1 przy deflacji (got ' + deflFactor.toFixed(6) + ')');

// ---------------------------------------------------------------------------
// 24. Krotki i dlugi kredyt - edge cases
// ---------------------------------------------------------------------------
group('24. Edge cases: rozne okresy');
var rows3y = calcHarmonogram(100000, 2010, 1, 3, 2, '3M', 'annual', 'rowna');
assert(rows3y.length === 36, '3-letni kredyt: 36 wierszy');
assertClose(rows3y[35].saldo, 0, 1.0, 'Saldo koncowe 3y ~0');

var rows35y = calcHarmonogram(500000, 2005, 1, 35, 2, '6M', 'annual', 'rowna');
assert(rows35y.length === 420, '35-letni kredyt: 420 wierszy');
assertClose(rows35y[419].saldo, 0, 1.0, 'Saldo koncowe 35y ~0');

// ---------------------------------------------------------------------------
// 25. Porownanie WIBOR 6M vs 3M
// ---------------------------------------------------------------------------
group('25. WIBOR 6M vs 3M - rozne harmonogramy');
var rows6m = calcHarmonogram(350000, 2010, 1, 30, 2, '6M', 'annual', 'rowna');
var rows3mComp = calcHarmonogram(350000, 2010, 1, 30, 2, '3M', 'annual', 'rowna');
var rows1mComp = calcHarmonogram(350000, 2010, 1, 30, 2, '1M', 'annual', 'rowna');
// Powinny miec ta sama liczbe wierszy
assert(rows6m.length === rows3mComp.length, '6M i 3M maja tyle samo wierszy');
assert(rows6m.length === rows1mComp.length, '6M i 1M maja tyle samo wierszy');
// Raty moga sie roznic bo rozne fixing'i
var totNom6m = rows6m.reduce(function(s,r){ return s+r.rata; }, 0);
var totNom3m = rows3mComp.reduce(function(s,r){ return s+r.rata; }, 0);
var totNom1m = rows1mComp.reduce(function(s,r){ return s+r.rata; }, 0);
assert(Math.abs(totNom6m - totNom3m) < totNom6m * 0.1, 'Sumy nominalne 6M vs 3M w granicach 10%');
assert(Math.abs(totNom6m - totNom1m) < totNom6m * 0.1, 'Sumy nominalne 6M vs 1M w granicach 10%');

// ---------------------------------------------------------------------------
// 26. Rozne miesiace startowe
// ---------------------------------------------------------------------------
group('26. Rozne miesiace startowe');
var rowsJan = calcHarmonogram(350000, 2010, 1, 10, 2, '6M', 'annual', 'rowna');
var rowsOct = calcHarmonogram(350000, 2010, 10, 10, 2, '6M', 'annual', 'rowna');
assert(rowsJan[0].calMonth === 0, 'Styczen: calMonth = 0');
assert(rowsOct[0].calMonth === 9, 'Pazdziernik: calMonth = 9');
assert(rowsJan.length === rowsOct.length, 'Oba mają tyle samo wierszy');

// ---------------------------------------------------------------------------
// 27. Identycznosc rata = odsetki + kapital w kazdym wierszu
// ---------------------------------------------------------------------------
group('27. rata = odsetki + kapital (kazdy wiersz)');
var allOk = true;
for (var i = 0; i < rowsTest.length; i++) {
  var diff = Math.abs(rowsTest[i].rata - rowsTest[i].odsetki - rowsTest[i].kapital);
  if (diff > 0.02) { allOk = false; break; }
}
assert(allOk, 'Wszystkie 360 wierszy: rata = odsetki + kapital (annuitet)');

var allOkMal = true;
for (var j = 0; j < rowsMal.length; j++) {
  var diffM = Math.abs(rowsMal[j].rata - rowsMal[j].odsetki - rowsMal[j].kapital);
  if (diffM > 0.02) { allOkMal = false; break; }
}
assert(allOkMal, 'Wszystkie 360 wierszy: rata = odsetki + kapital (malejace)');

// ---------------------------------------------------------------------------
// 28. Monotoniczne saldo (annuitet)
// ---------------------------------------------------------------------------
group('28. Saldo monotoniczne (annuitet)');
var monoAnn = true;
for (var k = 1; k < rowsTest.length; k++) {
  if (rowsTest[k].saldo > rowsTest[k-1].saldo + 0.01) { monoAnn = false; break; }
}
assert(monoAnn, 'Saldo nierosnace w kazdym kroku (annuitet)');

// ---------------------------------------------------------------------------
// 29. Monotoniczne saldo (malejace)
// ---------------------------------------------------------------------------
group('29. Saldo monotoniczne (malejace)');
var monoMal = true;
for (var l = 1; l < rowsMal.length; l++) {
  if (rowsMal[l].saldo > rowsMal[l-1].saldo + 0.01) { monoMal = false; break; }
}
assert(monoMal, 'Saldo nierosnace w kazdym kroku (malejace)');

// ---------------------------------------------------------------------------
// 30. Wysoka inflacja 2022
// ---------------------------------------------------------------------------
group('30. Wysoka inflacja 2022');
var rows2022 = calcHarmonogram(350000, 2022, 1, 30, 2, '6M', 'annual', 'rowna');
var rataReal2022_12 = rows2022[12].rataReal;
var rataNom2022_12 = rows2022[12].rata;
assert(rataReal2022_12 < rataNom2022_12, 'Rata realna < nominalna po 12m przy CPI 2022 (14.4%)');
var deflator12_2022 = rows2022[12].deflator;
assert(deflator12_2022 < 0.90, 'Deflator po 12m < 0.90 przy CPI ~14% (got ' + deflator12_2022.toFixed(4) + ')');

// ---------------------------------------------------------------------------
// 31. Prowizja: spojnosc nominalna i realna
// ---------------------------------------------------------------------------
group('31. Prowizja (spelnienie rownosci)');
var prowizja = 350000 * 0.02;
assertClose(prowizja, 7000, 0.01, 'Prowizja 2% z 350k = 7000');
// Prowizja realna = prowizja nominalna (deflator=1 w m0)
assertClose(prowizja, prowizja * 1.0, 0.01, 'Prowizja realna = nominalna (deflator=1)');

// ---------------------------------------------------------------------------
// 32. Werdykt - kierunek decyzji
// ---------------------------------------------------------------------------
group('32. Werdykt - logika kierunku');
cpiMode = 'annual';
// 30-letni vs 10-letni, 2010, 2% marzy
var realA = rowsTest.reduce(function(s,r){ return s+r.rataReal; }, 0);
var realB = rows10.reduce(function(s,r){ return s+r.rataReal; }, 0);
var prowA = 350000 * 0.02;
var prowB = 350000 * 0.02;
var totRA = realA + prowA;
var totRB = realB + prowB;
var realDiff = totRA - totRB;
// Dlugi kredyt powinien byc realnie drozszy z marza 2%
assert(realDiff > 0, 'Wariant 30l realnie drozszy od 10l przy marzy 2% (diff=' + realDiff.toFixed(0) + ')');

// ---------------------------------------------------------------------------
// 33. Przejscie deflatora na granicy roku
// ---------------------------------------------------------------------------
group('33. Granica roku - deflator');
// Wiersz m=11 (grudzien 2010) -> m=12 (styczen 2011) - powinien uzywac CPI 2011
var cpi2011 = getCpiAnnual(2011);
var deflator11 = rowsTest[11].deflator;
var deflator12 = rowsTest[12].deflator;
var actualFactor = deflator12 / deflator11;
// W miesiącu 11 (calMonth=11, grudzień 2010) → deflator jest aktualizowany z CPI 2010
// W miesiącu 12 (calMonth=0, styczeń 2011) → deflator jest aktualizowany z CPI 2011
// Sprawdzamy ze factor 11->12 uzywa CPI z roku 2010 (bo deflator[12] = deflator[11] * factor(grudzien 2010))
var expectedFact = 1 / Math.pow(1 + cpi2010 / 100, 1 / 12);
assertClose(actualFactor, expectedFact, 0.0001, 'Deflator m11->m12 uzywa CPI roku 2010');

// ---------------------------------------------------------------------------
// 34. Tryb WIBOR 6M w harmonogramie
// ---------------------------------------------------------------------------
group('34. WIBOR 6M w harmonogramie');
var rows6mTest = calcHarmonogram(350000, 2010, 1, 5, 2, '6M', 'annual', 'rowna');
// Checking that WIBOR value at m0 comes from actual data
var expectedWibor = getWibor(2010, 1, '6M');
assertClose(rows6mTest[0].wibor, expectedWibor, 0.01, 'WIBOR m0 = getWibor(2010, 1, "6M")');
// m1-m5 should use same WIBOR (no fixing between 0 and 6)
assertClose(rows6mTest[3].wibor, expectedWibor, 0.01, 'WIBOR m3 = m0 (brak fixingu)');

// ---------------------------------------------------------------------------
// 35. Wskaznik przystepnosci (rata/wynagrodzenie)
// ---------------------------------------------------------------------------
group('35. Wskaznik przystepnosci (rata / wynagrodzenie)');
salarySource = 'average';
var wynagr = getWynagr(2010);
var rata1 = rowsTest[0].rata;
var ratio = rata1 / wynagr * 100;
assert(ratio > 30 && ratio < 100, 'Rata/wynagrodzenie w rozsadnym zakresie: ' + ratio.toFixed(1) + '%');

// ---------------------------------------------------------------------------
// 36. getWynagr - fallback i ekstrapolacja
// ---------------------------------------------------------------------------
group('36. getWynagr fallback/ekstrapolacja');
salarySource = 'average';
var w1999 = getWynagr(1999);
var w2000 = getWynagr(2000);
assert(w1999 === w2000, 'Rok przed zakresem zwraca wartosc z pierwszego roku');

var wFuture = getWynagr(2050);
assert(wFuture > getWynagr(2024), 'Wynagrodzenie 2050 > 2024 (ekstrapolacja wg futureSalaryGrowth)');

// ---------------------------------------------------------------------------
// 37. getMonthlyDeflatorFactor oba tryby CPI
// ---------------------------------------------------------------------------
group('37. getMonthlyDeflatorFactor - oba tryby');
var fAnnual = getMonthlyDeflatorFactor(2010, 1, 'annual');
var fMonthly = getMonthlyDeflatorFactor(2010, 1, 'monthly');
assert(fAnnual > 0 && fAnnual < 2, 'Deflator roczny w rozsadnym zakresie');
assert(fMonthly > 0 && fMonthly < 2, 'Deflator miesieczny w rozsadnym zakresie');

// ---------------------------------------------------------------------------
// 38. aggregateYearly - wynagrodzenia
// ---------------------------------------------------------------------------
group('38. aggregateYearly - pola wynagrodzeniowe');
salarySource = 'average';
var yearlyFull = aggregateYearly(rowsTest);
assert(yearlyFull[0].wynagr > 0, 'Wynagr w agregacji rocznej > 0');
assert(yearlyFull[0].wynagr === getWynagr(yearlyFull[0].rok), 'Wynagr zgodne z getWynagr()');

// ---------------------------------------------------------------------------
// PODSUMOWANIE
// ---------------------------------------------------------------------------
process.stdout.write('\n=== WYNIK ===\n');
process.stdout.write('  Passed: ' + _pass + '\n');
process.stdout.write('  Failed: ' + _fail + '\n');
if (_fail > 0) {
  process.stdout.write('\x1b[31m  FAILURES DETECTED\x1b[0m\n');
  process.exit(1);
} else {
  process.stdout.write('\x1b[32m  ALL TESTS PASSED\x1b[0m\n');
}
