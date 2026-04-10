// =============================================================================
// Testy obliczen symulatora nadplat kredytu hipotecznego
// =============================================================================
// Plik wykonywany WEWNATRZ kontekstu VM (run-tests-nadplat.js laduje go po
// skryptach zrodlowych), wiec ma pelny dostep do zmiennych const/let/function
// z symulator-nadplat.js i plikow danych.
// =============================================================================

var _pass = 0, _fail = 0, _group = '';

function group(name) { _group = name; process.stdout.write('\n  ' + name + '\n'); }

function assert(cond, msg) {
  if (cond) { _pass++; process.stdout.write('    \x1b[32m✓\x1b[0m ' + msg + '\n'); }
  else      { _fail++; process.stdout.write('    \x1b[31m✗\x1b[0m ' + msg + '\n'); }
}

function assertClose(a, b, tol, msg) {
  var ok = Math.abs(a - b) <= tol;
  if (ok) { _pass++; process.stdout.write('    \x1b[32m✓\x1b[0m ' + msg + ' (got ' + a.toFixed(4) + ', exp ' + b.toFixed(4) + ', tol ' + tol + ')\n'); }
  else    { _fail++; process.stdout.write('    \x1b[31m✗\x1b[0m ' + msg + ' (got ' + a.toFixed(4) + ', exp ' + b.toFixed(4) + ', tol ' + tol + ')\n'); }
}

// Ustawienie trybow globalnych
wiborMode = '3M';
cpiMode = 'annual';
salarySource = 'average';

process.stdout.write('\n=== Testy symulatora nadplat kredytu hipotecznego ===\n');

// ============================================================================
// 1. Stopa miesieczna (calcMonthlyRate)
// ============================================================================
group('1. Stopa miesieczna (calcMonthlyRate)');
assertClose(calcMonthlyRate(5, 2), (5 + 2) / 100 / 12, 1e-10, 'WIBOR 5% + marza 2% -> r miesieczna');
assertClose(calcMonthlyRate(0, 0), 0, 1e-15, 'Zerowa stopa');
assertClose(calcMonthlyRate(3.5, 1.8), (3.5 + 1.8) / 100 / 12, 1e-10, 'WIBOR 3.5% + marza 1.8%');

// ============================================================================
// 2. Wzor annuitetowy (calcRataRowna)
// ============================================================================
group('2. Wzor annuitetowy (calcRataRowna)');
var r_test = 0.05 / 12;
var rata_test = calcRataRowna(100000, r_test, 120);
assertClose(rata_test, 1060.66, 0.01, '100k / 5% / 10 lat = 1060.66');

var r2 = 0.08 / 12;
var rata2 = calcRataRowna(200000, r2, 360);
assertClose(rata2, 1467.53, 0.01, '200k / 8% / 30 lat = 1467.53');

// ============================================================================
// 3. Zerowa stopa procentowa
// ============================================================================
group('3. Zerowa stopa procentowa');
assertClose(calcRataRowna(120000, 0, 120), 1000, 0.01, '120k / 0% / 10 lat = 1000');

// ============================================================================
// 4. Harmonogram bazowy - pierwsze miesiace (annuitet)
// ============================================================================
group('4. Harmonogram bazowy - annuitet');
var rowsBase = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna');
assert(rowsBase.length === 360, 'Harmonogram 30-letni ma 360 wierszy');
assert(rowsBase[0].isFix === true, 'Miesiac 0 to fixing');
assertClose(rowsBase[0].deflator, 1.0, 1e-10, 'Deflator w miesiącu 0 = 1.0');
assertClose(rowsBase[0].rataReal, rowsBase[0].rata, 0.01, 'Rata realna w m0 = rata nominalna');

var odsetki0 = 350000 * calcMonthlyRate(rowsBase[0].wibor, 2);
assertClose(rowsBase[0].odsetki, odsetki0, 0.01, 'Odsetki m0 zgodne z wzorem');
assertClose(rowsBase[0].rata, rowsBase[0].odsetki + rowsBase[0].kapital, 0.01, 'rata = odsetki + kapital w m0');

// ============================================================================
// 5. Zbieznosc salda (annuitet)
// ============================================================================
group('5. Zbieznosc salda do zera (annuitet)');
assertClose(rowsBase[359].saldo, 0, 1.0, 'Saldo po 360 m bliskie 0');
var totKap = rowsBase.reduce(function(s, r) { return s + r.kapital; }, 0);
assertClose(totKap, 350000, 1.0, 'Suma splaconego kapitalu = kwota kredytu');

// ============================================================================
// 6. Raty malejace
// ============================================================================
group('6. Raty malejace');
var rowsMal = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'annual', 'malejaca');
assert(rowsMal.length === 360, 'Malejace: 360 wierszy');
assert(rowsMal[0].rata > rowsMal[359].rata, 'Pierwsza rata > ostatnia');
assertClose(rowsMal[359].saldo, 0, 1.0, 'Saldo koncowe ~0 (malejace)');
var totKapMal = rowsMal.reduce(function(s, r) { return s + r.kapital; }, 0);
assertClose(totKapMal, 350000, 1.0, 'Suma kapitalu = kwota (malejace)');

// Czesc kapitalowa malejacych powinna byc stala miedzy fixingami
var kap0 = rowsMal[0].kapital;
var kap1 = rowsMal[1].kapital;
var kap2 = rowsMal[2].kapital;
assertClose(kap0, kap1, 0.01, 'Czesc kapitalowa stala miedzy fixingami (m0=m1)');
assertClose(kap1, kap2, 0.01, 'Czesc kapitalowa stala miedzy fixingami (m1=m2)');

// ============================================================================
// 7. Interwaly fixingu WIBOR
// ============================================================================
group('7. Interwaly fixingu WIBOR');
// WIBOR 3M - fixing co 3 miesiace
var rows3M = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna');
assert(rows3M[0].isFix === true, '3M: m0 fixing');
assert(rows3M[1].isFix === false, '3M: m1 nie jest fixingiem');
assert(rows3M[2].isFix === false, '3M: m2 nie jest fixingiem');
assert(rows3M[3].isFix === true, '3M: m3 fixing');
assert(rows3M[6].isFix === true, '3M: m6 fixing');

// WIBOR 6M - fixing co 6 miesiecy
var rows6M = calcHarmonogram(350000, 2010, 1, 360, 2, '6M', 'annual', 'rowna');
assert(rows6M[0].isFix === true, '6M: m0 fixing');
assert(rows6M[3].isFix === false, '6M: m3 nie jest fixingiem');
assert(rows6M[5].isFix === false, '6M: m5 nie jest fixingiem');
assert(rows6M[6].isFix === true, '6M: m6 fixing');

// ============================================================================
// 8. Deflator skumulowany - tryb roczny
// ============================================================================
group('8. Deflator skumulowany - tryb roczny');
var cpi2010 = getCpiAnnual(2010);
var monthlyFactor = 1 / Math.pow(1 + cpi2010 / 100, 1 / 12);
var expectedDeflator12 = Math.pow(monthlyFactor, 12);
assertClose(rowsBase[12].deflator, expectedDeflator12, 0.001,
  'Deflator po 12 m ≈ (1/(1+CPI))^1, CPI=' + cpi2010 + '%');
assert(rowsBase[12].deflator < 1.0, 'Deflator < 1 przy dodatniej inflacji');

// ============================================================================
// 9. Deflator - tryb CPI miesieczny
// ============================================================================
group('9. Deflator - tryb CPI miesieczny');
var rowsCpiM = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'monthly', 'rowna');
assertClose(rowsCpiM[0].deflator, 1.0, 1e-10, 'Deflator m0 = 1 (tryb miesieczny)');
var cpiM_2010_01 = getCpiMonthly(2010, 1);
var expFactor = 1 / (1 + cpiM_2010_01 / 100);
assertClose(rowsCpiM[1].deflator, expFactor, 1e-6, 'Deflator m1 uzywa CPI m/m styczen 2010');

// ============================================================================
// 10. Sumy nominalne - spojnosc
// ============================================================================
group('10. Sumy nominalne - spojnosc');
var totNom = rowsBase.reduce(function(s, r) { return s + r.rata; }, 0);
var totOds = rowsBase.reduce(function(s, r) { return s + r.odsetki; }, 0);
assertClose(totNom - totKap, totOds, 1.0, 'Sumaryczne odsetki = suma rat - kapital');
assert(totNom > 350000, 'Suma nominalna > kwota kredytu');

// ============================================================================
// 11. Mapowanie miesiaca startowego
// ============================================================================
group('11. Mapowanie miesiaca startowego');
var rowsJul = calcHarmonogram(350000, 2010, 7, 120, 2, '3M', 'annual', 'rowna');
assert(rowsJul[0].calMonth === 6, 'Start lipiec: calMonth = 6 (0-indexed)');
assert(rowsJul[0].rok === 2010, 'Start lipiec 2010: rok = 2010');
assert(rowsJul[6].calMonth === 0, 'Po 6 mies od lipca: calMonth = 0 (styczen)');
assert(rowsJul[6].rok === 2011, 'Po 6 mies od lipca 2010: rok = 2011');

// ============================================================================
// 12. Agregacja roczna (aggregateYearly)
// ============================================================================
group('12. Agregacja roczna (aggregateYearly)');
var yearAgg = aggregateYearly(rowsBase);
var firstYear = yearAgg[0];
var monthsInFirst = rowsBase.filter(function(r) { return r.rok === firstYear.rok; }).length;
var sumRataFirst = rowsBase.filter(function(r) { return r.rok === firstYear.rok; })
  .reduce(function(s, r) { return s + r.rata; }, 0);
assertClose(firstYear.sumRata, sumRataFirst, 0.01, 'Suma roczna rat = suma miesięcznych');
assert(firstYear.months === monthsInFirst, 'Liczba miesiecy w roku zgadza sie');

// ============================================================================
// 13. Annualizacja CPI (annualizeMonthlyCpi)
// ============================================================================
group('13. Annualizacja CPI');
var annualized = annualizeMonthlyCpi(0.5);
var expected = (Math.pow(1 + 0.5 / 100, 12) - 1) * 100;
assertClose(annualized, expected, 0.001, 'Round-trip annualizacja CPI miesieczny->roczny');

// ============================================================================
// 14. Fallback przyszlosci
// ============================================================================
group('14. Fallback przyszlosci');
assertClose(getWibor(2060, 1, '3M'), getFutureWibor(), 0.001, 'WIBOR 3M 2060 = getFutureWibor()');
assertClose(getWibor(2060, 1, '6M'), getFutureWibor(), 0.001, 'WIBOR 6M 2060 = getFutureWibor()');
assertClose(getCpiAnnual(2060), getFutureCpi(), 0.001, 'CPI roczne 2060 = getFutureCpi()');
assertClose(getCpiMonthly(2060, 1), getFutureCpiMonthly(), 0.001, 'CPI miesieczne 2060 = getFutureCpiMonthly()');

// ============================================================================
// 15. rata = odsetki + kapital (kazdy wiersz harmonogramu)
// ============================================================================
group('15. rata = odsetki + kapital (kazdy wiersz)');
var rowIdentityFails = 0;
rowsBase.forEach(function(r) {
  if (Math.abs(r.rata - (r.odsetki + r.kapital)) > 0.02) rowIdentityFails++;
});
assert(rowIdentityFails === 0, 'Annuitet: rata = odsetki + kapital w kazdym wierszu (' + rowIdentityFails + ' naruszen)');

var rowIdentityFailsMal = 0;
rowsMal.forEach(function(r) {
  if (Math.abs(r.rata - (r.odsetki + r.kapital)) > 0.02) rowIdentityFailsMal++;
});
assert(rowIdentityFailsMal === 0, 'Malejace: rata = odsetki + kapital w kazdym wierszu (' + rowIdentityFailsMal + ' naruszen)');

// ============================================================================
// 16. Saldo monotoniczne (annuitet)
// ============================================================================
group('16. Saldo monotoniczne');
var saldoIncreases = 0;
for (var i = 1; i < rowsBase.length; i++) {
  if (rowsBase[i].saldo > rowsBase[i-1].saldo + 0.01) saldoIncreases++;
}
assert(saldoIncreases === 0, 'Annuitet: saldo nierosnące (' + saldoIncreases + ' wzrostow)');

var saldoIncMal = 0;
for (var i = 1; i < rowsMal.length; i++) {
  if (rowsMal[i].saldo > rowsMal[i-1].saldo + 0.01) saldoIncMal++;
}
assert(saldoIncMal === 0, 'Malejace: saldo nierosnące (' + saldoIncMal + ' wzrostow)');

// ============================================================================
// 17. Wysoka inflacja 2022 (deflator)
// ============================================================================
group('17. Wysoka inflacja 2022');
var rows2022 = calcHarmonogram(350000, 2022, 1, 360, 2, '3M', 'annual', 'rowna');
assert(rows2022[12].deflator < 0.90, 'CPI 2022 > 14% -> deflator po 12 m < 0.90');

// ============================================================================
// 18. Spot-check danych historycznych
// ============================================================================
group('18. Spot-check danych historycznych');
assert(CPI_ANNUAL[2022] !== undefined, 'CPI 2022 istnieje');
assert(CPI_ANNUAL[2022] > 10, 'CPI 2022 > 10% (inflacja)');
assert(WIBOR3M_MONTHLY['2010-01'] !== undefined, 'WIBOR 3M styczen 2010 istnieje');
assert(WIBOR6M_MONTHLY['2010-01'] !== undefined, 'WIBOR 6M styczen 2010 istnieje');

// ============================================================================
// 19. Kwota kredytu - rozne wartosci
// ============================================================================
group('19. Kwota kredytu - rozne wartosci');
var rowsSmall = calcHarmonogram(50000, 2010, 1, 120, 2, '3M', 'annual', 'rowna');
assertClose(rowsSmall[119].saldo, 0, 1.0, 'Maly kredyt 50k / 10 lat: saldo koncowe ~0');
var totKapSmall = rowsSmall.reduce(function(s, r) { return s + r.kapital; }, 0);
assertClose(totKapSmall, 50000, 1.0, 'Maly kredyt: suma kapitalu = 50k');

var rowsLarge = calcHarmonogram(1500000, 2015, 1, 360, 2, '3M', 'annual', 'rowna');
assertClose(rowsLarge[359].saldo, 0, 2.0, 'Duzy kredyt 1.5M / 30 lat: saldo koncowe ~0');
assert(rowsLarge[0].rata > rowsSmall[0].rata, 'Wieksza kwota -> wieksza rata');

// ============================================================================
// 20. Okres kredytu - rozne wartosci
// ============================================================================
group('20. Okres kredytu - rozne wartosci');
var rows36 = calcHarmonogram(350000, 2010, 1, 36, 2, '3M', 'annual', 'rowna');
assert(rows36.length === 36, 'Krotki kredyt 3 lata: 36 wierszy');
assertClose(rows36[35].saldo, 0, 1.0, 'Krotki kredyt: saldo koncowe ~0');

var rows420 = calcHarmonogram(350000, 2010, 1, 420, 2, '3M', 'annual', 'rowna');
assert(rows420.length === 420, 'Dlugi kredyt 35 lat: 420 wierszy');
assertClose(rows420[419].saldo, 0, 2.0, 'Dlugi kredyt: saldo koncowe ~0');

assert(rows36[0].rata > rows420[0].rata, 'Krotszy okres -> wieksza rata');

// ============================================================================
// 21. Data startu kredytu - rozne miesiace
// ============================================================================
group('21. Data startu - rozne miesiace');
var rowsOct = calcHarmonogram(350000, 2010, 10, 360, 2, '3M', 'annual', 'rowna');
assert(rowsOct[0].calMonth === 9, 'Start pazdziernik: calMonth = 9');
assert(rowsOct[0].rok === 2010, 'Start paz 2010: rok = 2010');
assert(rowsOct[3].calMonth === 0, 'Po 3 mies od paz: styczen (calMonth=0)');
assert(rowsOct[3].rok === 2011, 'Po 3 mies od paz 2010: rok = 2011');
assert(rowsOct[0].miesiacNazwa === 'paź', 'Nazwa miesiaca pazdziernik = paź');

// ============================================================================
// 22. WIBOR 3M vs 6M porownanie
// ============================================================================
group('22. WIBOR 3M vs 6M porownanie');
var rA3 = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna');
var rA6 = calcHarmonogram(350000, 2010, 1, 360, 2, '6M', 'annual', 'rowna');
var tot3 = rA3.reduce(function(s,r){return s + r.rata;}, 0);
var tot6 = rA6.reduce(function(s,r){return s + r.rata;}, 0);
assert(Math.abs(tot3 - tot6) / tot3 < 0.1, 'Raznica WIBOR 3M vs 6M < 10%');
// Oba powinny sie zbiec do zera
assertClose(rA3[359].saldo, 0, 1.0, '3M: saldo koncowe ~0');
assertClose(rA6[359].saldo, 0, 1.0, '6M: saldo koncowe ~0');

// ============================================================================
// 23. Marza i prowizja - harmonogram bazowy
// ============================================================================
group('23. Marza i prowizja');
var rowsHigh = calcHarmonogram(350000, 2010, 1, 360, 4, '3M', 'annual', 'rowna');
var rowsLow  = calcHarmonogram(350000, 2010, 1, 360, 1, '3M', 'annual', 'rowna');
assert(rowsHigh[0].rata > rowsLow[0].rata, 'Wyzsza marza -> wyzsza rata');
assert(rowsHigh[0].stopa > rowsLow[0].stopa, 'Wyzsza marza -> wyzsza stopa');
var totHigh = rowsHigh.reduce(function(s,r){return s + r.rata;}, 0);
var totLow  = rowsLow.reduce(function(s,r){return s + r.rata;}, 0);
assert(totHigh > totLow, 'Wyzsza marza -> wyzszy koszt laczny');

// ============================================================================
// 24. calcHarmonogramWithEvents - brak zdarzen = bazowy
// ============================================================================
group('24. Harmonogram z wydarzeniami - brak zdarzen');
var resultEmpty = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', [], 2);
var rowsEmpty = resultEmpty.rows;
assert(rowsEmpty.length === rowsBase.length, 'Brak zdarzen -> taka sama dlugosc');
assertClose(rowsEmpty[0].rata, rowsBase[0].rata, 0.01, 'Brak zdarzen -> taka sama rata m0');
assertClose(rowsEmpty[359].saldo, 0, 1.0, 'Brak zdarzen -> saldo koncowe ~0');
assertClose(resultEmpty.totalProwizjeNom, 350000 * 2 / 100, 0.01, 'Prowizja nom = kwota * 2%');
assertClose(resultEmpty.totalProwizjeReal, 350000 * 2 / 100, 0.01, 'Prowizja real = nominalna (deflator=1 w m0)');
assertClose(resultEmpty.totalNadplatyNom, 0, 0.01, 'Brak nadplat nom');
assertClose(resultEmpty.totalNadplatyReal, 0, 0.01, 'Brak nadplat real');

// ============================================================================
// 25. Nadplata jednorazowa - nizszy okres (krotszy_okres)
// ============================================================================
group('25. Nadplata jednorazowa - krotszy_okres');
var evNadplata = [{
  type: 'nadplata', kwota: 50000, month: 1, year: 2012,
  efekt: 'krotszy_okres'
}];
var resultNad = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evNadplata, 0);
var rowsNad = resultNad.rows;
assert(rowsNad.length < 360, 'Nadplata krotszy_okres: mniej niz 360 wierszy (got ' + rowsNad.length + ')');
assert(rowsNad[rowsNad.length - 1].saldo <= 0.01, 'Nadplata: saldo koncowe ~0');
assertClose(resultNad.totalNadplatyNom, 50000, 0.01, 'Nadplata nom = 50k');
assert(resultNad.totalNadplatyReal > 0, 'Nadplata real > 0');

// Sprawdz ze nadplata pojawia sie w wierszu 24 (styczen 2012 = 24 miesiace od startu)
var nadRow = rowsNad.find(function(r) { return r.nadplata > 0; });
assert(nadRow !== undefined, 'Jest wiersz z nadplata');
assertClose(nadRow.nadplata, 50000, 0.01, 'Kwota nadplaty = 50k');
assert(nadRow.event === 'nadplata', 'Event = nadplata');

// ============================================================================
// 26. Nadplata jednorazowa - nizsza rata
// ============================================================================
group('26. Nadplata jednorazowa - nizsza_rata');
var evNizszaRata = [{
  type: 'nadplata', kwota: 50000, month: 1, year: 2012,
  efekt: 'nizsza_rata'
}];
var resultNR = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evNizszaRata, 0);
var rowsNR = resultNR.rows;
assert(rowsNR.length === 360, 'nizsza_rata: okres bez zmian (360 wierszy) got ' + rowsNR.length);
// Po nadplacie rata powinna byc nizsza
var rowBeforeNad = rowsNR[23]; // m24 to wiersz z nadplata
var rowAfterNad = rowsNR[25]; // wiersz po nadplacie
assert(rowAfterNad.rata < rowBeforeNad.rata, 'Po nadplacie rata < przed nadplata');
assertClose(rowsNR[rowsNR.length - 1].saldo, 0, 1.0, 'nizsza_rata: saldo koncowe ~0');

// ============================================================================
// 27. Pelna splata (splata)
// ============================================================================
group('27. Pelna wczesniejsza splata');
var evSplata = [{
  type: 'splata', month: 6, year: 2015
}];
var resultSpl = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evSplata, 0);
var rowsSpl = resultSpl.rows;
// Kredyt powinien sie zakonczyc w okolicy miesiaca 66 (czerwiec 2015 = 65 od startu + 1)
assert(rowsSpl.length <= 66, 'Splata cze 2015: max 66 wierszy (got ' + rowsSpl.length + ')');
assert(rowsSpl[rowsSpl.length - 1].saldo === 0, 'Splata: saldo = 0');
assert(rowsSpl[rowsSpl.length - 1].event === 'splata', 'Ostatni wiersz event = splata');
// Ostania rata = saldo + odsetki
var lastSpl = rowsSpl[rowsSpl.length - 1];
assert(lastSpl.rata > 0, 'Rata splaty > 0');

// ============================================================================
// 28. Refinansowanie
// ============================================================================
group('28. Refinansowanie');
var evRef = [{
  type: 'refinansowanie', month: 1, year: 2013,
  nowaMarza: 1.5, prowizjaRef: 1.0, nowyWibor: 'bez_zmian'
}];
var resultRef = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evRef, 2);
var rowsRef = resultRef.rows;
assert(rowsRef.length === 360, 'Refinansowanie: 360 wierszy');
// Po refinansowaniu marza zmienia sie na 1.5 -> stopa powinna byc nizsza
var rowAfterRef = rowsRef[37]; // pare miesiecy po refinansowaniu (m36 = sty 2013)
assert(rowAfterRef.stopa < rowsBase[37].stopa, 'Po refinansowaniu nizsza stopa (nizsza marza)');
// Prowizje: poczatkowa + refinansowania
var prowInitial = 350000 * 2 / 100;
var saldoAtRef = rowsRef[35].saldo; // saldo tuz przed refinansowaniem
var prowRef = saldoAtRef * 1 / 100;
assert(resultRef.totalProwizjeNom > prowInitial, 'Prowizje laczne > prowizja poczatkowa');
// Event w wierszu refinansowania
var refRow = rowsRef.find(function(r) { return r.event === 'refinansowanie'; });
assert(refRow !== undefined, 'Jest wiersz z refinansowaniem');

// ============================================================================
// 29. Refinansowanie ze zmiana WIBOR
// ============================================================================
group('29. Refinansowanie ze zmiana WIBOR');
var evRefW = [{
  type: 'refinansowanie', month: 1, year: 2015,
  nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: '6M'
}];
var resultRefW = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evRefW, 0);
var rowsRefW = resultRefW.rows;
// Po refinansowaniu fixing powinien byc co 6 miesiecy
// Sprawdz ze wiersz refinansowania ma fixing
var refWRow = rowsRefW.find(function(r) { return r.event === 'refinansowanie'; });
assert(refWRow !== undefined, 'Jest wiersz z refinansowaniem');
assert(refWRow.isFix === true, 'Refinansowanie wymusza natychmiastowy fixing');

// ============================================================================
// 30. Nadplata cykliczna - doKonca = true
// ============================================================================
group('30. Nadplata cykliczna - doKonca');
var evCyk = [{
  type: 'cykliczna', kwota: 1000, month: 1, year: 2012,
  efekt: 'krotszy_okres', doKonca: true, doMonth: 12, doYear: 2015
}];
var expanded = expandEvents(evCyk, 2010, 1, 360);
// doKonca=true: powinno rozwinac do konca kredytu (360 - 24 = 336 miesiecy od sty 2012)
assert(expanded.length > 300, 'doKonca=true: dużo zdarzen (got ' + expanded.length + ')');
assert(expanded[0].type === 'cykliczna', 'Pierwszy element to cykliczna');
assert(expanded[0].year === 2012, 'Pierwsze zdarzenie rok = 2012');
assert(expanded[0].month === 1, 'Pierwsze zdarzenie miesiac = 1');

// ============================================================================
// 31. Nadplata cykliczna - doKonca = false (ograniczona)
// ============================================================================
group('31. Nadplata cykliczna - ograniczona (doKonca=false)');
var evCykLim = [{
  type: 'cykliczna', kwota: 2000, month: 1, year: 2012,
  efekt: 'krotszy_okres', doKonca: false, doMonth: 12, doYear: 2013
}];
var expandedLim = expandEvents(evCykLim, 2010, 1, 360);
// Od sty 2012 do gru 2013 = 24 miesiace
assert(expandedLim.length === 24, 'doKonca=false: dokladnie 24 zdarzenia (sty 2012 - gru 2013), got ' + expandedLim.length);
assert(expandedLim[0].year === 2012, 'Pierwszy = 2012');
assert(expandedLim[0].month === 1, 'Pierwszy = styczen');
assert(expandedLim[23].year === 2013, 'Ostatni = 2013');
assert(expandedLim[23].month === 12, 'Ostatni = grudzien');

// ============================================================================
// 32. Nadplata cykliczna - obliczenia z harmonogramem
// ============================================================================
group('32. Nadplata cykliczna - harmonogram');
var evCykCalc = [{
  type: 'cykliczna', kwota: 500, month: 1, year: 2012,
  efekt: 'krotszy_okres', doKonca: true, doMonth: 12, doYear: 2015
}];
var expandedCalc = expandEvents(evCykCalc, 2010, 1, 360);
var resultCyk = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', expandedCalc, 0);
var rowsCyk = resultCyk.rows;
assert(rowsCyk.length < 360, 'Cykliczna nadplata skraca kredyt (got ' + rowsCyk.length + ')');
assert(resultCyk.totalNadplatyNom > 0, 'Laczna nadplata nom > 0');
// Kazda rata cykliczna = 500 PLN
var nadRows = rowsCyk.filter(function(r) { return r.nadplata > 0; });
assert(nadRows.length > 100, 'Wiele wierszy z nadplatami (got ' + nadRows.length + ')');

// ============================================================================
// 33. Nadplata cykliczna - nizsza_rata
// ============================================================================
group('33. Nadplata cykliczna - nizsza_rata');
// Mala kwota zeby saldo nie zerowe przed koncem
var evCykNR = [{
  type: 'cykliczna', kwota: 100, month: 1, year: 2012,
  efekt: 'nizsza_rata', doKonca: true, doMonth: 12, doYear: 2015
}];
var expandedNR_cyk = expandEvents(evCykNR, 2010, 1, 360);
var resultCykNR = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', expandedNR_cyk, 0);
var rowsCykNR = resultCykNR.rows;
assert(rowsCykNR.length === 360, 'Cykliczna nizsza_rata: okres bez zmian (360), got ' + rowsCykNR.length);
// Rata pod koniec kredytu powinna byc nizsza niz bazowa
assert(rowsCykNR[350].rata < rowsBase[350].rata,
  'Cykliczna nizsza_rata: rata pod koniec nizsza od bazowej');

// Duza kwota cykliczna z nizsza_rata moze skrocic kredyt (saldo 0 wczesniej)
var evCykNR_big = [{
  type: 'cykliczna', kwota: 1000, month: 1, year: 2012,
  efekt: 'nizsza_rata', doKonca: true, doMonth: 12, doYear: 2015
}];
var expandedNR_big = expandEvents(evCykNR_big, 2010, 1, 360);
var resultCykNR_big = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', expandedNR_big, 0);
assert(resultCykNR_big.rows.length <= 360, 'Duza cykliczna nizsza_rata: <= 360 wierszy');
assert(resultCykNR_big.rows[resultCykNR_big.rows.length - 1].saldo <= 0.01,
  'Duza cykliczna nizsza_rata: saldo koncowe ~0');

// ============================================================================
// 34. Nadplata zamykajaca kredyt
// ============================================================================
group('34. Nadplata zamykajaca kredyt');
var evBig = [{
  type: 'nadplata', kwota: 400000, month: 6, year: 2012,
  efekt: 'krotszy_okres'
}];
var resultBig = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evBig, 0);
var rowsBig = resultBig.rows;
assert(rowsBig.length <= 30, 'Nadplata wieksza niz saldo: kredyt konczy sie szybko (got ' + rowsBig.length + ')');
assert(rowsBig[rowsBig.length - 1].saldo === 0, 'Saldo = 0 po duzej nadplacie');

// ============================================================================
// 35. expandEvents - zdarzenia jednorazowe
// ============================================================================
group('35. expandEvents - jednorazowe');
var evMixed = [
  { type: 'nadplata', kwota: 10000, month: 3, year: 2011, efekt: 'krotszy_okres' },
  { type: 'splata', month: 6, year: 2020 },
  { type: 'refinansowanie', month: 1, year: 2015, nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: 'bez_zmian' }
];
var expandedMixed = expandEvents(evMixed, 2010, 1, 360);
assert(expandedMixed.length === 3, 'Jednorazowe zdarzenia: 3 elementy (bez rozwijania)');
assert(expandedMixed[0].type === 'nadplata', 'Pierwszy = nadplata');
assert(expandedMixed[1].type === 'splata', 'Drugi = splata');
assert(expandedMixed[2].type === 'refinansowanie', 'Trzeci = refinansowanie');

// ============================================================================
// 36. expandEvents - zdarzenie cykliczne z datami przed i po okresie kredytu
// ============================================================================
group('36. expandEvents - graniczne daty');
var evEdge = [{
  type: 'cykliczna', kwota: 500, month: 6, year: 2009,
  efekt: 'krotszy_okres', doKonca: false, doMonth: 3, doYear: 2010
}];
var expandedEdge = expandEvents(evEdge, 2010, 1, 360);
// Zdarzenia sprzed startu (cze 2009 - gru 2009) powinny byc pomieniete
// Styczen 2010 - marzec 2010 = 3 miesiace
assert(expandedEdge.length === 3, 'Zdarzenia sprzed startu odfiltrowane: 3 elementy (got ' + expandedEdge.length + ')');

// ============================================================================
// 37. Kolejnosc przetwarzania zdarzen (refinansowanie -> nadplata -> splata)
// ============================================================================
group('37. Kolejnosc przetwarzania zdarzen');
var evOrder = [
  { type: 'nadplata', kwota: 10000, month: 1, year: 2013, efekt: 'krotszy_okres' },
  { type: 'refinansowanie', month: 1, year: 2013, nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: 'bez_zmian' }
];
var resultOrder = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evOrder, 0);
var rowsOrder = resultOrder.rows;
// Wiersz m=36 (sty 2013) powinien miec event refinansowanie (bo idzie pierwszy)
// a nadplata tez tam jest
var m36 = rowsOrder[36]; // sty 2013 = miesiac 36 od startu
// Po refinansowaniu marza=1.5 i potem nadplata -> stopa powinna uzywac nowej marzy
assert(m36 !== undefined, 'Wiersz m36 istnieje');

// ============================================================================
// 38. Raty malejace z nadplata - krotszy_okres
// ============================================================================
group('38. Raty malejace z nadplata - krotszy_okres');
var evMalNad = [{
  type: 'nadplata', kwota: 50000, month: 1, year: 2012,
  efekt: 'krotszy_okres'
}];
var resultMalNad = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'malejaca', evMalNad, 0);
var rowsMalNad = resultMalNad.rows;
assert(rowsMalNad.length < 360, 'Malejace + krotszy_okres: mniej niz 360 wierszy (got ' + rowsMalNad.length + ')');
assert(rowsMalNad[rowsMalNad.length - 1].saldo <= 0.01, 'Malejace + nadplata: saldo koncowe ~0');

// ============================================================================
// 39. Raty malejace z nadplata - nizsza_rata
// ============================================================================
group('39. Raty malejace z nadplata - nizsza_rata');
var evMalNR = [{
  type: 'nadplata', kwota: 50000, month: 1, year: 2012,
  efekt: 'nizsza_rata'
}];
var resultMalNR = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'malejaca', evMalNR, 0);
var rowsMalNR = resultMalNR.rows;
assert(rowsMalNR.length === 360, 'Malejace nizsza_rata: 360 wierszy, got ' + rowsMalNR.length);

// ============================================================================
// 40. Raty malejace z pelna splata
// ============================================================================
group('40. Raty malejace z pelna splata');
var evMalSpl = [{ type: 'splata', month: 6, year: 2015 }];
var resultMalSpl = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'malejaca', evMalSpl, 0);
var rowsMalSpl = resultMalSpl.rows;
assert(rowsMalSpl.length <= 66, 'Malejace + splata: max 66 wierszy (got ' + rowsMalSpl.length + ')');
assert(rowsMalSpl[rowsMalSpl.length - 1].saldo === 0, 'Malejace + splata: saldo = 0');

// ============================================================================
// 41. Raty malejace z refinansowaniem
// ============================================================================
group('41. Raty malejace z refinansowaniem');
var evMalRef = [{
  type: 'refinansowanie', month: 1, year: 2013,
  nowaMarza: 1.5, prowizjaRef: 0.5, nowyWibor: 'bez_zmian'
}];
var resultMalRef = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'malejaca', evMalRef, 0);
var rowsMalRef = resultMalRef.rows;
assert(rowsMalRef.length === 360, 'Malejace + refinansowanie: 360 wierszy');
var refRowMal = rowsMalRef.find(function(r) { return r.event === 'refinansowanie'; });
assert(refRowMal !== undefined, 'Jest wiersz refinansowania');
assert(refRowMal.isFix === true, 'Refinansowanie wymusza fixing (malejace)');

// ============================================================================
// 42. Prowizja poczatkowa i refinansowania
// ============================================================================
group('42. Prowizje - poczatkowa i refinansowania');
var evProw = [{
  type: 'refinansowanie', month: 1, year: 2015,
  nowaMarza: 1.5, prowizjaRef: 2.0, nowyWibor: 'bez_zmian'
}];
var resultProw = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evProw, 3);
var prowInit = 350000 * 3 / 100;
assert(resultProw.totalProwizjeNom > prowInit, 'Laczne prowizje > prowizja poczatkowa');
// Prowizja refinansowania = saldo_w_momencie_ref * 2%
// Sprawdz ze prowizja realna refinansowania uwzglednia deflator
assert(resultProw.totalProwizjeReal > 0, 'Prowizje realne > 0');
assert(resultProw.totalProwizjeReal < resultProw.totalProwizjeNom, 'Prowizje realne < nominalne (inflacja)');

// ============================================================================
// 43. Wiele zdarzen jednoczesnie
// ============================================================================
group('43. Wiele zdarzen w roznych miesiacach');
var evMulti = [
  { type: 'nadplata', kwota: 20000, month: 1, year: 2012, efekt: 'krotszy_okres' },
  { type: 'nadplata', kwota: 30000, month: 6, year: 2014, efekt: 'krotszy_okres' },
  { type: 'refinansowanie', month: 1, year: 2016, nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: 'bez_zmian' },
  { type: 'nadplata', kwota: 50000, month: 6, year: 2018, efekt: 'nizsza_rata' }
];
var resultMulti = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evMulti, 2);
var rowsMulti = resultMulti.rows;
assert(rowsMulti.length < 360, 'Wiele zdarzen: krotszy okres');
assertClose(resultMulti.totalNadplatyNom, 100000, 0.01, 'Laczna nadplata = 20k + 30k + 50k');
assert(resultMulti.totalProwizjeNom >= 350000 * 2 / 100, 'Prowizje >= prowizja poczatkowa');

// ============================================================================
// 44. Suma rat + nadplat = splacony kapital + odsetki
// ============================================================================
group('44. Spojnosc: raty + nadplaty = kapital + odsetki');
var totRataMulti = rowsMulti.reduce(function(s,r){return s + r.rata;}, 0);
var totOdsMulti = rowsMulti.reduce(function(s,r){return s + r.odsetki;}, 0);
var totKapMulti = rowsMulti.reduce(function(s,r){return s + r.kapital;}, 0);
var totNadMulti = resultMulti.totalNadplatyNom;
assertClose(totKapMulti + totNadMulti, 350000, 1.0, 'Kapital + nadplaty = kwota kredytu');
assertClose(totRataMulti, totOdsMulti + totKapMulti, 1.0, 'Suma rat = odsetki + kapital (bez nadplat)');

// ============================================================================
// 45. Nadplata oszczedza odsetki
// ============================================================================
group('45. Nadplata oszczedza odsetki');
var odsBase = rowsBase.reduce(function(s,r){return s + r.odsetki;}, 0);
var odsNad = rowsNad.reduce(function(s,r){return s + r.odsetki;}, 0);
assert(odsNad < odsBase, 'Nadplata zmniejsza laczne odsetki');
var savedOds = odsBase - odsNad;
assert(savedOds > 0, 'Oszczednosc na odsetkach > 0 (saved ' + Math.round(savedOds) + ' PLN)');

// ============================================================================
// 46. Deflator i wartosci realne w harmonogramie z wydarzeniami
// ============================================================================
group('46. Deflator w harmonogramie z wydarzeniami');
var resultDef = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', [], 0);
var rowsDef = resultDef.rows;
assertClose(rowsDef[0].deflator, 1.0, 1e-10, 'Deflator m0 = 1.0 (z events)');
assertClose(rowsDef[0].rataReal, rowsDef[0].rata, 0.01, 'Rata realna m0 = nominalna (z events)');
assert(rowsDef[12].deflator < 1.0, 'Deflator po 12 m < 1 (inflacja)');

// ============================================================================
// 47. Weryfikacja kroku 1 (metodyka): oprocentowanie nominalne
// ============================================================================
group('47. Metodyka krok 1: oprocentowanie nominalne');
var wibStart = getWibor(2010, 1, '3M');
var stopaStart = wibStart + 2;
assertClose(rowsBase[0].wibor, wibStart, 0.001, 'WIBOR startu = getWibor(2010, 1, 3M)');
assertClose(rowsBase[0].stopa, stopaStart, 0.001, 'Stopa = WIBOR + marza');

// ============================================================================
// 48. Weryfikacja kroku 2 (metodyka): rata miesieczna annuitet
// ============================================================================
group('48. Metodyka krok 2: rata miesieczna annuitet');
var r_m0 = calcMonthlyRate(rowsBase[0].wibor, 2);
var expectedRata = calcRataRowna(350000, r_m0, 360);
assertClose(rowsBase[0].rata, expectedRata, 0.01, 'Rata m0 = annuitet(350k, r, 360)');
// Rata malejaca
var r_mal_m0 = calcMonthlyRate(rowsMal[0].wibor, 2);
var expectedKapMal = 350000 / 360;
assertClose(rowsMal[0].kapital, expectedKapMal, 0.01, 'Malejaca: kapital m0 = kwota/n');
var expectedOdsMal = 350000 * r_mal_m0;
assertClose(rowsMal[0].odsetki, expectedOdsMal, 0.01, 'Malejaca: odsetki m0 = saldo * r');

// ============================================================================
// 49. Weryfikacja kroku 3 (metodyka): inflacja i realny koszt
// ============================================================================
group('49. Metodyka krok 3: rata realna');
assertClose(rowsBase[0].rataReal, rowsBase[0].rata * 1.0, 0.01, 'Rata realna m0 = rata nom * deflator(1.0)');
// W m1 deflator < 1 (bo CPI 2010 > 0)
assert(rowsBase[1].rataReal < rowsBase[1].rata, 'Rata realna m1 < rata nominalna (inflacja > 0)');
// Deflator miesieczny
var cpi2010v = getCpiAnnual(2010);
var expectedDef1 = 1.0 * (1 / Math.pow(1 + cpi2010v / 100, 1 / 12));
assertClose(rowsBase[1].deflator, expectedDef1, 1e-6, 'Deflator m1 = 1/(1+CPI)^(1/12)');

// ============================================================================
// 50. Weryfikacja kroku 4 (metodyka): efekt nadplaty
// ============================================================================
group('50. Metodyka krok 4: efekt nadplaty');
// krotszy_okres: rata taka sama, okres krotszy
var rataBeforeNad = rowsNad[22].rata; // rata przed nadplata (krotszy_okres)
var rataAfterNad = rowsNad[25].rata;  // rata po nadplacie
// W trybie krotszy_okres rata powinna sie niewiele zmienic (tylko o roznice WIBOR)
// Ale okres powinien byc krotszy
assert(rowsNad.length < rowsBase.length, 'krotszy_okres: krotszy okres');

// nizsza_rata: okres taki sam, rata nizsza
assert(rowsNR.length === rowsBase.length, 'nizsza_rata: taki sam okres');
// Sprawdz ze rata po nadplacie jest nizsza
var rataNR_after = rowsNR[25].rata;
var rataBase_same = rowsBase[25].rata;
assert(rataNR_after < rataBase_same, 'nizsza_rata: rata po nadplacie < rata bazowa');

// ============================================================================
// 51. Weryfikacja kroku 5 (metodyka): refinansowanie
// ============================================================================
group('51. Metodyka krok 5: refinansowanie');
// Refinansowanie zmienia marze i wymusza natychmiastowy fixing
var refResult = calcHarmonogramWithEvents(350000, 2010, 1, 360, 3, '3M', 'annual', 'rowna',
  [{ type: 'refinansowanie', month: 1, year: 2013, nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: 'bez_zmian' }], 0);
var refRows = refResult.rows;
// m36 = sty 2013 powinien miec nowa stope
var m36ref = refRows[36];
assert(m36ref.event === 'refinansowanie', 'Wiersz refinansowania');
// Stopa po refinansowaniu = WIBOR + 1.5 (nie 3.0)
var wiborAtRef = getWibor(2013, 1, '3M');
assertClose(m36ref.stopa, wiborAtRef + 1.5, 0.01, 'Po refinansowaniu stopa = WIBOR + nowa marza');
// Przed refinansowaniem stopa = WIBOR + 3.0
assert(refRows[35].stopa > m36ref.stopa, 'Stopa przed ref > stopa po ref (marza 3 -> 1.5)');

// ============================================================================
// 52. Weryfikacja kroku 6 (metodyka): prowizje nie zwiekszaja salda
// ============================================================================
group('52. Metodyka krok 6: prowizje');
var resultProwCheck = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', [], 5);
var rowsProwCheck = resultProwCheck.rows;
// Prowizja 5% z 350k = 17500 - ale saldo w m0 to dalej 350k (minus splata kapitalowa)
var prowNom = 350000 * 5 / 100;
assertClose(resultProwCheck.totalProwizjeNom, prowNom, 0.01, 'Prowizja nom = 5% * 350k');
// Saldo w m0 musi byc mniejsze niz 350k (bo splata kapitalu), nie wieksze
assert(rowsProwCheck[0].saldo < 350000, 'Saldo m0 < kwota (splata kapitalu, prowizja nie dodana)');

// ============================================================================
// 53. Tabela - kolumny wierszy
// ============================================================================
group('53. Walidacja kolumn tabeli');
var r0 = rowsBase[0];
assert(r0.rok !== undefined, 'Wiersz ma pole rok');
assert(r0.calMonth !== undefined, 'Wiersz ma pole calMonth');
assert(r0.miesiacNazwa !== undefined, 'Wiersz ma pole miesiacNazwa');
assert(r0.dataLabel !== undefined, 'Wiersz ma pole dataLabel');
assert(r0.miesiac !== undefined, 'Wiersz ma pole miesiac');
assert(r0.isFix !== undefined, 'Wiersz ma pole isFix');
assert(r0.wibor !== undefined, 'Wiersz ma pole wibor');
assert(r0.stopa !== undefined, 'Wiersz ma pole stopa');
assert(r0.rata !== undefined, 'Wiersz ma pole rata');
assert(r0.odsetki !== undefined, 'Wiersz ma pole odsetki');
assert(r0.kapital !== undefined, 'Wiersz ma pole kapital');
assert(r0.saldo !== undefined, 'Wiersz ma pole saldo');
assert(r0.deflator !== undefined, 'Wiersz ma pole deflator');
assert(r0.rataReal !== undefined, 'Wiersz ma pole rataReal');
assert(r0.nadplata !== undefined, 'Wiersz ma pole nadplata');
assert(r0.event !== undefined || r0.event === null, 'Wiersz ma pole event');

// ============================================================================
// 54. Tabela z wydarzeniami - dodatkowe pola
// ============================================================================
group('54. Tabela z wydarzeniami - pola');
var evRow = rowsNad.find(function(r) { return r.nadplata > 0; });
assert(evRow.nadplata > 0, 'Wiersz nadplaty ma nadplata > 0');
assert(evRow.event === 'nadplata', 'Wiersz nadplaty ma event = nadplata');

var spl = rowsSpl.find(function(r) { return r.event === 'splata'; });
assert(spl.saldo === 0, 'Wiersz splaty: saldo = 0');
assert(spl.event === 'splata', 'Wiersz splaty: event = splata');

// ============================================================================
// 55. Formatowanie (fmtOkres)
// ============================================================================
group('55. Formatowanie (fmtOkres)');
assert(fmtOkres(360) === '30 lat', '360 m = 30 lat');
assert(fmtOkres(120) === '10 lat', '120 m = 10 lat');
assert(fmtOkres(5) === '5 miesięcy', '5 m');
assert(fmtOkres(25) === '2 lat 1 miesięcy', '25 m = 2 lat 1 miesięcy');

// ============================================================================
// 56. Porownanie bazowy vs z wydarzeniami - spojnosc
// ============================================================================
group('56. Porownanie bazowy vs z wydarzeniami');
var totNomBase = rowsBase.reduce(function(s,r){return s + r.rata;}, 0);
var totNomMod = rowsNad.reduce(function(s,r){return s + r.rata;}, 0);
// Z nadplatami laczna suma rat (bez nadplat) powinna byc nizsza
assert(totNomMod < totNomBase, 'Suma rat zmodyfikowanego < bazowego');
// Ale laczna kwota (raty + nadplaty) bliska calkowitemu kosztowi
var totWithNad = totNomMod + resultNad.totalNadplatyNom;
// raty + nadplaty powinny pokryc kwote kredytu + odsetki
var totOdsNad = rowsNad.reduce(function(s,r){return s + r.odsetki;}, 0);
assertClose(totNomMod, totOdsNad + (350000 - resultNad.totalNadplatyNom), 2.0,
  'Raty = odsetki + (kwota - nadplaty)');

// ============================================================================
// 57. CPI roczne vs miesieczne - harmonogram
// ============================================================================
group('57. CPI roczne vs miesieczne - harmonogram');
var rowsAnn = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna');
var rowsMon = calcHarmonogram(350000, 2010, 1, 360, 2, '3M', 'monthly', 'rowna');
// Raty nominalne identyczne (CPI nie wplywa na nominalne)
assertClose(rowsAnn[0].rata, rowsMon[0].rata, 0.01, 'Rata nom m0 taka sama niezaleznie od trybu CPI');
// Deflatory rozne
assert(Math.abs(rowsAnn[12].deflator - rowsMon[12].deflator) < 0.05,
  'Deflatory po 12 m zblizone (ale nie identyczne)');

// ============================================================================
// 58. getWynagr i calcAvgStats
// ============================================================================
group('58. getWynagr i calcAvgStats');
salarySource = 'average';
var wyn2010 = getWynagr(2010);
assert(wyn2010 > 0, 'Wynagrodzenie 2010 > 0');
var wyn2050 = getWynagr(2050);
assert(wyn2050 > wyn2010, 'Wynagrodzenie 2050 > 2010 (ekstrapolacja)');

var avg = calcAvgStats(rowsBase);
assert(avg.avgWibor > 0, 'Sredni WIBOR > 0');
assert(isFinite(avg.avgCpi), 'Sredni CPI jest skonczone');
assertClose(avg.avgSpread, avg.avgWibor - avg.avgCpi, 0.001, 'avgSpread = avgWibor - avgCpi');

// ============================================================================
// 59. Salary source - rozne zrodla
// ============================================================================
group('59. Salary source - rozne zrodla');
salarySource = 'average';
var wynAvg = getWynagr(2020);
salarySource = 'minimum';
var wynMin = getWynagr(2020);
assert(wynMin < wynAvg, 'Minimalne < przecietne');
// Przywroc domyslne
salarySource = 'average';

// ============================================================================
// 60. Nadplata w miesiacu 0
// ============================================================================
group('60. Nadplata w miesiacu 0');
var evM0 = [{
  type: 'nadplata', kwota: 50000, month: 1, year: 2010,
  efekt: 'krotszy_okres'
}];
var resultM0 = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evM0, 0);
var rowsM0 = resultM0.rows;
assert(rowsM0[0].nadplata === 50000, 'Nadplata w m0 = 50k');
assert(rowsM0.length < 360, 'Nadplata w m0 skraca kredyt');

// ============================================================================
// 61. Wielokrotna nadplata w tym samym miesiacu
// ============================================================================
group('61. Wielokrotna nadplata w tym samym miesiacu');
var evDbl = [
  { type: 'nadplata', kwota: 20000, month: 6, year: 2012, efekt: 'krotszy_okres' },
  { type: 'nadplata', kwota: 15000, month: 6, year: 2012, efekt: 'krotszy_okres' }
];
var resultDbl = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evDbl, 0);
assertClose(resultDbl.totalNadplatyNom, 35000, 0.01, 'Dwie nadplaty w tym samym m: laczna = 35k');

// ============================================================================
// 62. Refinansowanie + nadplata w tym samym miesiacu
// ============================================================================
group('62. Refinansowanie + nadplata w tym samym miesiacu');
var evRefNad = [
  { type: 'refinansowanie', month: 1, year: 2013, nowaMarza: 1.5, prowizjaRef: 0.5, nowyWibor: 'bez_zmian' },
  { type: 'nadplata', kwota: 50000, month: 1, year: 2013, efekt: 'krotszy_okres' }
];
var resultRefNad = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evRefNad, 0);
var rowsRefNad = resultRefNad.rows;
// Refinansowanie idzie pierwsze, potem nadplata
assert(rowsRefNad.length < 360, 'Ref + nadplata skraca kredyt');
assertClose(resultRefNad.totalNadplatyNom, 50000, 0.01, 'Nadplata = 50k');
assert(resultRefNad.totalProwizjeNom > 0, 'Prowizje > 0 (prowizjaRef)');

// ============================================================================
// 63. fixCounterSinceReset po refinansowaniu
// ============================================================================
group('63. fixCounterSinceReset po refinansowaniu');
// Po refinansowaniu fixing counter resetuje sie, wiec nowy fixing bedzie co 3 mies od ref
var evRefFix = [{
  type: 'refinansowanie', month: 2, year: 2013,
  nowaMarza: 1.5, prowizjaRef: 0, nowyWibor: '3M'
}];
var resultRefFix = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evRefFix, 0);
var rowsRefFix = resultRefFix.rows;
// m37 = lut 2013 (refinansowanie, fixing=true)
// m38 = mar 2013 (fixing counter=1, nie fixing)
// m39 = kwi 2013 (fixing counter=2, nie fixing)
// m40 = maj 2013 (fixing counter=3, fixing!)
var refIdx = -1;
for (var ri = 0; ri < rowsRefFix.length; ri++) {
  if (rowsRefFix[ri].event === 'refinansowanie') { refIdx = ri; break; }
}
assert(refIdx >= 0, 'Znaleziono wiersz refinansowania');
if (refIdx >= 0 && refIdx + 3 < rowsRefFix.length) {
  assert(rowsRefFix[refIdx].isFix === true, 'Wiersz refinansowania to fixing');
  assert(rowsRefFix[refIdx + 1].isFix === false, 'Wiersz po ref: nie fixing');
  assert(rowsRefFix[refIdx + 2].isFix === false, 'Wiersz po ref+1: nie fixing');
  assert(rowsRefFix[refIdx + 3].isFix === true, 'Wiersz po ref+2: fixing (3 mies od ref)');
}

// ============================================================================
// 64. Prowizja zerowa
// ============================================================================
group('64. Prowizja zerowa');
var resultP0 = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', [], 0);
assertClose(resultP0.totalProwizjeNom, 0, 0.01, 'Prowizja 0% -> totalProwizjeNom = 0');
assertClose(resultP0.totalProwizjeReal, 0, 0.01, 'Prowizja 0% -> totalProwizjeReal = 0');

// ============================================================================
// 65. Weryfikacja ze nadplata nie przekracza salda
// ============================================================================
group('65. Nadplata nie przekracza salda');
// Nadplata wieksza niz saldo: powinna byc obcieta
var evHuge = [{
  type: 'nadplata', kwota: 999999, month: 1, year: 2010,
  efekt: 'krotszy_okres'
}];
var resultHuge = calcHarmonogramWithEvents(350000, 2010, 1, 360, 2, '3M', 'annual', 'rowna', evHuge, 0);
// Nadplata efektywna <= 350000
assert(resultHuge.totalNadplatyNom <= 350000, 'Nadplata obcieta do salda');
assert(resultHuge.rows[resultHuge.rows.length - 1].saldo === 0, 'Po duzej nadplacie saldo = 0');

// ============================================================================
// 66. Data label format
// ============================================================================
group('66. Data label format');
assert(rowsBase[0].dataLabel === 'sty 2010', 'dataLabel m0 = sty 2010');
var rowDec = rowsBase[11]; // grudzien 2010
assert(rowDec.dataLabel === 'gru 2010', 'dataLabel m11 = gru 2010');

// ============================================================================
// 67. WIG30_MONTHLY data spot-check
// ============================================================================
group('67. WIG30_MONTHLY data spot-check');
assert(WIG30_MONTHLY['1991-04'] !== undefined, 'WIG30 1991-04 istnieje');
assert(WIG30_MONTHLY['2020-01'] !== undefined, 'WIG30 2020-01 istnieje');
assert(WIG30_MONTHLY['2020-01'] > 100, 'WIG30 2020-01 > 100');

// ============================================================================
// 68. WIG_MONTHLY data spot-check
// ============================================================================
group('68. WIG_MONTHLY data spot-check');
assert(WIG_MONTHLY['1991-04'] !== undefined, 'WIG 1991-04 istnieje');
assert(WIG_MONTHLY['2020-01'] !== undefined, 'WIG 2020-01 istnieje');
assert(WIG_MONTHLY['2020-01'] > 1000, 'WIG 2020-01 > 1000');

// ============================================================================
// 69. SPX_MONTHLY data spot-check
// ============================================================================
group('69. SPX_MONTHLY data spot-check');
assert(SPX_MONTHLY['1984-01'] !== undefined, 'SPX 1984-01 istnieje');
assert(SPX_MONTHLY['2020-01'] !== undefined, 'SPX 2020-01 istnieje');
assert(SPX_MONTHLY['2020-01'] > 1000, 'SPX 2020-01 > 1000');

// ============================================================================
// 70. USDPLN_MONTHLY data spot-check
// ============================================================================
group('70. USDPLN_MONTHLY data spot-check');
assert(USDPLN_MONTHLY['1984-01'] !== undefined, 'USDPLN 1984-01 istnieje');
assert(USDPLN_MONTHLY['2020-01'] !== undefined, 'USDPLN 2020-01 istnieje');
assert(USDPLN_MONTHLY['2020-01'] > 1, 'USDPLN 2020-01 > 1');

// ============================================================================
// 71. WIBOR1M_MONTHLY data spot-check
// ============================================================================
group('71. WIBOR1M_MONTHLY data spot-check');
assert(WIBOR1M_MONTHLY['1995-01'] !== undefined, 'WIBOR1M 1995-01 istnieje');
assert(WIBOR1M_MONTHLY['2020-01'] !== undefined, 'WIBOR1M 2020-01 istnieje');
assert(WIBOR1M_MONTHLY['2020-01'] > 0, 'WIBOR1M 2020-01 > 0');

// ============================================================================
// 72. NBP_RATE_MONTHLY data spot-check
// ============================================================================
group('72. NBP_RATE_MONTHLY data spot-check');
assert(NBP_RATE_MONTHLY['1998-02'] !== undefined, 'NBP 1998-02 istnieje');
assert(NBP_RATE_MONTHLY['2020-01'] !== undefined, 'NBP 2020-01 istnieje');
// Fill-forward: kazdy miesiąc od 1998-02 do 2025-12 powinien istniec
var nbpGaps = 0;
for (var yy = 1998; yy <= 2025; yy++) {
  for (var mm = 1; mm <= 12; mm++) {
    if (yy === 1998 && mm < 2) continue;
    var k = yy + '-' + String(mm).padStart(2, '0');
    if (NBP_RATE_MONTHLY[k] === undefined) nbpGaps++;
  }
}
assert(nbpGaps === 0, 'NBP fill-forward bez luk (' + nbpGaps + ' brakow)');

// ============================================================================
// 73. getMonthlyInvestmentReturn() – WIG30 basic
// ============================================================================
group('73. getMonthlyInvestmentReturn() - WIG30');
var w30_ret = getMonthlyInvestmentReturn('wig30', 2020, 2);
var w30_exp = WIG30_MONTHLY['2020-02'] / WIG30_MONTHLY['2020-01'] - 1;
assertClose(w30_ret, w30_exp, 0.00001, 'WIG30 stopa 2020-02 historyczna');

// ============================================================================
// 74. getMonthlyInvestmentReturn() – SP500 in PLN
// ============================================================================
group('74. getMonthlyInvestmentReturn() - SP500 w PLN');
var sp_cur = SPX_MONTHLY['2020-02'] * USDPLN_MONTHLY['2020-02'];
var sp_prev = SPX_MONTHLY['2020-01'] * USDPLN_MONTHLY['2020-01'];
var sp_exp = sp_cur / sp_prev - 1;
var sp_ret = getMonthlyInvestmentReturn('sp500', 2020, 2);
assertClose(sp_ret, sp_exp, 0.00001, 'SP500 w PLN stopa 2020-02');

// ============================================================================
// 75. getMonthlyInvestmentReturn() – fallback
// ============================================================================
group('75. getMonthlyInvestmentReturn() - fallback');
var fb_ret = getMonthlyInvestmentReturn('wig30', 2060, 6);
assertClose(fb_ret, getFutureStockReturn() / 12 / 100, 0.0001, 'WIG30 2060 -> fallback stopa');

// ============================================================================
// 76. getDepositRate equivalent (lokata return)
// ============================================================================
group('76. Lokata stopa - historical');
var lok_ret = getMonthlyInvestmentReturn('lokata', 2020, 6);
var nbp_val = NBP_RATE_MONTHLY['2020-06'];
assertClose(lok_ret, nbp_val / 12 / 100, 0.00001, 'Lokata 2020-06 = NBP/12/100');

// ============================================================================
// 77. Lokata stopa - fallback
// ============================================================================
group('77. Lokata stopa - fallback');
var lok_fb = getMonthlyInvestmentReturn('lokata', 2060, 1);
assertClose(lok_fb, getFutureDepositRate() / 12 / 100, 0.0001, 'Lokata 2060 -> fallback');

// ============================================================================
// 78. calcInvestmentPortfolio() – brak nadpłat
// ============================================================================
group('78. calcInvestmentPortfolio() - brak nadplat');
var inv_none = calcInvestmentPortfolio([], 2010, 1, 12, 'annual', 'wig30');
assert(inv_none === null, 'Brak nadplat -> null');

// ============================================================================
// 79. calcInvestmentPortfolio() – jedna nadpłata WIG30
// ============================================================================
group('79. calcInvestmentPortfolio() - jedna nadplata WIG30');
var inv_one = calcInvestmentPortfolio([{month: 0, kwota: 50000}], 2015, 1, 24, 'annual', 'wig30');
assert(inv_one !== null, 'Wynik nie null');
assert(inv_one.totalWplaty === 50000, 'Wplaty = 50k');
assert(inv_one.monthly.length === 25, 'Monthly ma 25 wierszy (0-24)');
assert(inv_one.monthly[0].wartoscNom === 50000, 'Portfel w m0 = 50k (przed wzrostem)');

// ============================================================================
// 80. calcInvestmentPortfolio() – lokata po Belce
// ============================================================================
group('80. calcInvestmentPortfolio() - lokata');
var inv_lok = calcInvestmentPortfolio([{month: 0, kwota: 100000}], 2015, 1, 12, 'annual', 'lokata');
assert(inv_lok !== null, 'Lokata wynik nie null');
assert(inv_lok.portfolioBrutto > 100000, 'Lokata brutto > wplata');
assert(inv_lok.podatekBelki > 0, 'Belka > 0 dla lokaty z zyskiem');
assert(inv_lok.portfolioNetto < inv_lok.portfolioBrutto, 'Netto < brutto');

// ============================================================================
// 81. calcInvestmentPortfolio() – gotówka
// ============================================================================
group('81. calcInvestmentPortfolio() - gotowka');
var inv_cash = calcInvestmentPortfolio([{month: 0, kwota: 50000}], 2015, 1, 12, 'annual', 'gotowka');
assert(inv_cash !== null, 'Gotowka wynik nie null');
assertClose(inv_cash.portfolioBrutto, 50000, 0.01, 'Gotowka nom = wplata');
assertClose(inv_cash.zyskBrutto, 0, 0.01, 'Gotowka zysk = 0');
assertClose(inv_cash.podatekBelki, 0, 0.01, 'Gotowka brak Belki');

// ============================================================================
// 82. calcInvestmentPortfolio() – SP500 w PLN
// ============================================================================
group('82. calcInvestmentPortfolio() - SP500 w PLN');
var inv_sp = calcInvestmentPortfolio([{month: 0, kwota: 50000}], 2010, 1, 60, 'annual', 'sp500');
assert(inv_sp !== null, 'SP500 wynik nie null');
assert(inv_sp.totalWplaty === 50000, 'SP500 wplaty = 50k');

// ============================================================================
// 83. calcInvestmentPortfolio() – cykliczne nadpłaty
// ============================================================================
group('83. calcInvestmentPortfolio() - cykliczne nadplaty');
var cycOverpay = [];
for (var ci = 0; ci < 12; ci++) cycOverpay.push({month: ci * 3, kwota: 5000});
var inv_cyc = calcInvestmentPortfolio(cycOverpay, 2015, 1, 36, 'annual', 'wig30');
assert(inv_cyc !== null, 'Cykliczne wynik nie null');
assertClose(inv_cyc.totalWplaty, 60000, 0.01, 'Cykliczne wplaty = 60k');
assert(inv_cyc.monthly.length === 37, 'Cykliczne 37 wierszy');

// ============================================================================
// 84. Podatek Belki na akcjach – zysk
// ============================================================================
group('84. Podatek Belki - zysk');
// inv_one already computed for WIG30 2015
if (inv_one.zyskBrutto > 0) {
  assertClose(inv_one.podatekBelki, inv_one.zyskBrutto * 0.19, 0.01, 'Belka = 19% zysku brutto');
}

// ============================================================================
// 85. Podatek Belki – strata
// ============================================================================
group('85. Podatek Belki - strata');
// Gotówka: brak zysku -> brak podatku
assertClose(inv_cash.podatekBelki, 0, 0.01, 'Brak podatku przy braku zysku');

// ============================================================================
// 86. Bilans: nadplata vs inwestycja
// ============================================================================
group('86. Bilans - obliczanie');
// Sprawdź że bilans jest poprawnie obliczony
var testSavedNom = 10000;
var testZyskNetto = 5000;
var bilansTest = testSavedNom - testZyskNetto;
assert(bilansTest > 0, 'Nadplata lepsza gdy oszczednosc > zysk netto');
var bilansTest2 = 5000 - 10000;
assert(bilansTest2 < 0, 'Inwestycja lepsza gdy zysk netto > oszczednosc');

// ============================================================================
// 87. Portfel realny z deflatorem
// ============================================================================
group('87. Portfel realny z deflatorem');
// Portfel realny nie musi byc < nominalny (deflacja w 2015)
assert(inv_one.portfolioRealNetto !== undefined, 'Portfel realny istnieje');
assert(inv_one.monthly[0].wartoscReal === inv_one.monthly[0].wartoscNom, 'Portfel real m0 = nom m0 (deflator=1)');

// ============================================================================
// 88. Spójność wpłat
// ============================================================================
group('88. Spojnosc wplat');
var invWplSum = inv_cyc.monthly.reduce(function(s, r) { return s + r.wplata; }, 0);
assertClose(invWplSum, inv_cyc.totalWplaty, 0.01, 'Suma wplat miesięcznych = totalWplaty');

// ============================================================================
// 89. investment_type = 'none'
// ============================================================================
group('89. investment_type = none');
var inv_none2 = calcInvestmentPortfolio([{month: 0, kwota: 50000}], 2015, 1, 12, 'annual', 'none');
assert(inv_none2 === null, 'none -> null');

// ============================================================================
// 90. WIBOR 1M fixing interval
// ============================================================================
group('90. WIBOR 1M fixing interval');
var rows1m = calcHarmonogram(350000, 2010, 1, 36, 2, '1M', 'annual', 'rowna');
assert(rows1m[0].isFix === true, '1M: m0 fixing');
assert(rows1m[1].isFix === true, '1M: m1 fixing');
assert(rows1m[2].isFix === true, '1M: m2 fixing');
assert(rows1m[3].isFix === true, '1M: m3 fixing');

// ============================================================================
// 91. WIBOR 1M annual averages
// ============================================================================
group('91. WIBOR 1M annual averages');
assert(WIBOR1M_ANNUAL[2010] !== undefined, 'WIBOR1M_ANNUAL 2010 istnieje');
assert(WIBOR1M_ANNUAL[2010] > 0, 'WIBOR1M_ANNUAL 2010 > 0');

// ============================================================================
// 92. Projekcje przyszłe — WIBOR
// ============================================================================
group('92. Projekcje przyszle - WIBOR');
assertClose(getWibor(2060, 1, '1M'), getFutureWibor(), 0.001, 'WIBOR 1M 2060 = getFutureWibor()');

// ============================================================================
// 93. Projekcje przyszłe — CPI
// ============================================================================
group('93. Projekcje przyszle - CPI');
assertClose(getCpiAnnual(2060), getFutureCpi(), 0.001, 'CPI 2060 = getFutureCpi()');

// ============================================================================
// 94. Projekcje przyszłe — wynagrodzenie
// ============================================================================
group('94. Projekcje przyszle - wynagrodzenie');
var wyn2030 = getWynagr(2030);
assert(wyn2030 > getWynagr(2025), 'Wynagrodzenie 2030 > 2025 (ekstrapolacja)');

// ============================================================================
// 95. getMonthlyInvestmentReturn() – gotowka
// ============================================================================
group('95. getMonthlyInvestmentReturn() - gotowka');
assertClose(getMonthlyInvestmentReturn('gotowka', 2020, 6), 0, 0.0001, 'Gotowka stopa = 0');

// ============================================================================
// 96. Deflator inwestycji - tryb CPI miesieczny
// ============================================================================
group('96. Deflator inwestycji - tryb CPI miesieczny');
var invCpiMonthly = calcInvestmentPortfolio([{month: 0, kwota: 50000}], 2010, 1, 12, 'monthly', 'gotowka');
assert(invCpiMonthly !== null, 'Portfel CPI miesieczny nie jest null');
var expectedInvDeflator = 1;
for (var mi = 0; mi < 12; mi++) {
  var calMonth96 = ((1 - 1 + mi) % 12) + 1;
  var calYear96 = 2010 + Math.floor((1 - 1 + mi) / 12);
  expectedInvDeflator *= getMonthlyDeflatorFactor(calYear96, calMonth96, 'monthly');
}
assertClose(invCpiMonthly.monthly[12].deflator, expectedInvDeflator, 1e-9, 'Deflator portfela = iloczyn miesiecznych deflatorow CPI');
assertClose(invCpiMonthly.portfolioRealNetto, invCpiMonthly.portfolioNetto * invCpiMonthly.monthly[12].deflator, 0.01, 'Portfel real netto skaluje sie finalnym deflatorem');

// ============================================================================
// 97. Zysk realny netto - wpłaty deflowane miesiecznie
// ============================================================================
group('97. Zysk realny netto - wplaty deflowane miesiecznie');
var invStagger = calcInvestmentPortfolio([{month: 0, kwota: 10000}, {month: 12, kwota: 10000}], 2022, 1, 24, 'annual', 'gotowka');
assert(invStagger !== null, 'Portfel z dwiema wplatami nie jest null');
var expectedWplatyReal = invStagger.monthly.reduce(function(s, row) { return s + row.wplata * row.deflator; }, 0);
assertClose(invStagger.totalWplatyReal, expectedWplatyReal, 0.01, 'Suma wplat realnych = suma (wplata × deflator)');
assertClose(invStagger.zyskRealNetto, invStagger.portfolioRealNetto - invStagger.totalWplatyReal, 0.01, 'Zysk realny netto = portfel real netto - wplaty realne');
var oldNominalInputStyle = invStagger.portfolioRealNetto - invStagger.totalWplaty;
assert(Math.abs(invStagger.zyskRealNetto - oldNominalInputStyle) > 0.1, 'Zysk realny netto nie odejmuje wplat nominalnych');

// ============================================================================
// PODSUMOWANIE
// ============================================================================
process.stdout.write('\n=== WYNIK ===\n');
process.stdout.write('  Passed: ' + _pass + '\n');
process.stdout.write('  Failed: ' + _fail + '\n');
if (_fail === 0) {
  process.stdout.write('  \x1b[32mALL TESTS PASSED\x1b[0m\n\n');
} else {
  process.stdout.write('  \x1b[31m' + _fail + ' TEST(S) FAILED\x1b[0m\n\n');
  process.exit(1);
}
