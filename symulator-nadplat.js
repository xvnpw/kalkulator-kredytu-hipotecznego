// ==========================================
// STALE I DANE POMOCNICZE
// ==========================================

// Projekcje przyszłe — odczytywane z pól UI (fallback gdy brak DOM lub nieprawidłowa wartość).
// Używamy Number.isFinite, żeby legalne "0" nie wpadało w fallback (jak robił wcześniejszy wzorzec `|| default`).
function _futureFromInput(id, fallback) {
  var el = document.getElementById(id);
  if (!el) return fallback;
  var v = parseLocaleFloat(el.value);
  return Number.isFinite(v) ? v : fallback;
}
function getFutureWibor() { return _futureFromInput('future_wibor', 4.0); }
function getFutureCpi() { return _futureFromInput('future_cpi', 3.0); }
function getFutureCpiMonthly() { return (Math.pow(1 + getFutureCpi() / 100, 1 / 12) - 1) * 100; }
function getFutureSalaryGrowth() { return _futureFromInput('future_salary', 3.5); }
function getFutureStockReturn() { return _futureFromInput('future_stock_return', 5.0); }
function getFutureDepositRate() { return _futureFromInput('future_deposit_rate', 3.0); }
function getFutureUsdPln() { return _futureFromInput('future_usdpln', 3.5); }

const EPSILON = 1e-12;

const SALARY_SOURCE_CONFIG = {
  average: {
    chartLabel: 'przeciętne',
    tableHeader: 'Wyn. przeciętne',
    tableTitle: 'Przeciętne miesięczne wynagrodzenie brutto - ogółem (GUS)',
    ratioHeader: 'Rata / wyn. przeciętne',
    ratioTitle: 'Rata jako % przeciętnego wynagrodzenia',
    data: WYNAGRODZENIA_PRZECIETNE
  },
  minimum: {
    chartLabel: 'minimalne',
    tableHeader: 'Wynagrodzenie minimalne',
    tableTitle: 'Minimalne wynagrodzenie za pracę',
    ratioHeader: 'Rata / wynagrodzenie',
    ratioTitle: 'Rata jako % wynagrodzenia minimalnego',
    data: WYNAGRODZENIA_MINIMALNE
  }
};
Object.values(SALARY_SOURCE_CONFIG).forEach(function(cfg) {
  cfg.years = Object.keys(cfg.data).map(Number).sort(function(a, b) { return a - b; });
});

function getSalaryMeta() {
  return SALARY_SOURCE_CONFIG[salarySource] || SALARY_SOURCE_CONFIG.average;
}
function getWynagr(year) {
  var meta = getSalaryMeta();
  var data = meta.data;
  if (data[year] !== undefined) return data[year];
  var firstYear = meta.years[0];
  var lastYear = meta.years[meta.years.length - 1];
  if (year < firstYear) return data[firstYear];
  return Math.round(data[lastYear] * Math.pow(1 + getFutureSalaryGrowth() / 100, year - lastYear));
}

// ==========================================
// ROCZNE SREDNIE WIBOR (do wykresu)
// ==========================================
var WIBOR6M_ANNUAL = {};
var WIBOR3M_ANNUAL = {};
var WIBOR1M_ANNUAL = {};
for (var y = 1995; y <= 2026; y++) {
  var v6 = [], v3 = [], v1 = [];
  for (var m = 1; m <= 12; m++) {
    var k = y + '-' + String(m).padStart(2, '0');
    if (WIBOR6M_MONTHLY[k] !== undefined) v6.push(WIBOR6M_MONTHLY[k]);
    if (WIBOR3M_MONTHLY[k] !== undefined) v3.push(WIBOR3M_MONTHLY[k]);
    if (WIBOR1M_MONTHLY[k] !== undefined) v1.push(WIBOR1M_MONTHLY[k]);
  }
  if (v6.length) WIBOR6M_ANNUAL[y] = +(v6.reduce(function(a,b){return a+b;}) / v6.length).toFixed(2);
  if (v3.length) WIBOR3M_ANNUAL[y] = +(v3.reduce(function(a,b){return a+b;}) / v3.length).toFixed(2);
  if (v1.length) WIBOR1M_ANNUAL[y] = +(v1.reduce(function(a,b){return a+b;}) / v1.length).toFixed(2);
}

var HIST_MIN_YEAR = 2000;
var LAST_HIST_WIBOR_YEAR = 2026;
var LAST_HIST_CPI = Math.max.apply(null, Object.keys(CPI_MONTHLY).map(function(k){ return parseInt(k.slice(0,4), 10); }));

// ==========================================
// FUNKCJE DANYCH
// ==========================================
function getWibor(year, month, mode) {
  var key = year + '-' + String(month).padStart(2, '0');
  var val;
  if (mode === '1M') val = WIBOR1M_MONTHLY[key];
  else if (mode === '3M') val = WIBOR3M_MONTHLY[key];
  else val = WIBOR6M_MONTHLY[key];
  return val !== undefined ? val : getFutureWibor();
}
function getCpiMonthly(year, month) {
  var key = year + '-' + String(month).padStart(2, '0');
  return CPI_MONTHLY[key] !== undefined ? CPI_MONTHLY[key] : getFutureCpiMonthly();
}
function annualizeMonthlyCpi(cpiMonthlyPct) {
  return (Math.pow(1 + cpiMonthlyPct / 100, 12) - 1) * 100;
}
function annualizeMonthlyCpiForYear(year) {
  var factor = 1;
  for (var m = 1; m <= 12; m++) {
    var key = year + '-' + String(m).padStart(2, '0');
    if (CPI_MONTHLY[key] === undefined) return null;
    factor *= (1 + CPI_MONTHLY[key] / 100);
  }
  return +((factor - 1) * 100).toFixed(2);
}
function getMonthlyDeflatorFactor(year, month) {
  return 1 / (1 + getCpiMonthly(year, month) / 100);
}

// ==========================================
// OBLICZENIA KREDYTU
// ==========================================
function calcMonthlyRate(wibor_pct, marza_pct) {
  return (wibor_pct + marza_pct) / 100 / 12;
}
function calcRataRowna(kwota, rMonthly, nMonths) {
  if (Math.abs(rMonthly) < EPSILON) return kwota / nMonths;
  return kwota * rMonthly * Math.pow(1 + rMonthly, nMonths) / (Math.pow(1 + rMonthly, nMonths) - 1);
}

var MIESIAC_NAZWY = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];

// Harmonogram bazowy (bez zdarzen)
function calcHarmonogram(kwota, rokStart, startMonth, nMonths, marza, wiborMode, rateType) {
  var fixInterval = wiborMode === '1M' ? 1 : (wiborMode === '3M' ? 3 : 6);
  var saldo = kwota;
  var rows = [];
  var cumulativeDeflator = 1.0;
  var currentRata = 0, currentWibor = 0, currentStopa = 0;
  var czescKapitalowa = 0;

  for (var m = 0; m < nMonths; m++) {
    var calMonthAbs = (startMonth - 1) + m;
    var calYear  = rokStart + Math.floor(calMonthAbs / 12);
    var calMonth = calMonthAbs % 12;
    var remaining = nMonths - m;

    var isFix = (m % fixInterval === 0);
    if (isFix) {
      currentWibor = getWibor(calYear, calMonth + 1, wiborMode);
      currentStopa = currentWibor + marza;
      var r = calcMonthlyRate(currentWibor, marza);
      if (rateType === 'malejaca') {
        czescKapitalowa = saldo / remaining;
      } else {
        currentRata = calcRataRowna(saldo, r, remaining);
      }
    }

    var r = calcMonthlyRate(currentWibor, marza);
    var odsetki = saldo * r;
    var kapital, rata;
    if (rateType === 'malejaca') {
      kapital = Math.min(czescKapitalowa, saldo);
      rata = kapital + odsetki;
    } else {
      rata = currentRata;
      kapital = Math.min(rata - odsetki, saldo);
    }
    saldo = Math.max(0, saldo - kapital);
    var rataReal = rata * cumulativeDeflator;

    rows.push({
      rok: calYear, calMonth: calMonth,
      miesiacNazwa: MIESIAC_NAZWY[calMonth],
      dataLabel: MIESIAC_NAZWY[calMonth] + ' ' + calYear,
      miesiac: m + 1, isFix: isFix,
      wibor: currentWibor, stopa: currentStopa,
      rata: rata, odsetki: odsetki, kapital: kapital, saldo: saldo,
      deflator: cumulativeDeflator, rataReal: rataReal,
      nadplata: 0, event: null
    });

    var monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth + 1);
    cumulativeDeflator *= monthlyDeflatorFactor;
  }
  return rows;
}

// Harmonogram z wydarzeniami
function calcHarmonogramWithEvents(kwota, rokStart, startMonth, nMonths, marza, wiborMode, rateType, events, prowizjaPct) {
  var fixInterval = wiborMode === '1M' ? 1 : (wiborMode === '3M' ? 3 : 6);
  var saldo = kwota;
  var rows = [];
  var cumulativeDeflator = 1.0;
  var currentRata = 0, currentWibor = 0, currentStopa = 0;
  var currentMarza = marza;
  var currentWiborMode = wiborMode;
  var czescKapitalowa = 0;
  var totalProwizjeNom = kwota * prowizjaPct / 100;
  var totalProwizjeReal = totalProwizjeNom; // miesiąc 0 deflator=1
  var totalNadplatyNom = 0, totalNadplatyReal = 0;
  var fixCounterSinceReset = 0;
  var effectiveEndMonth = nMonths; // śledzi skrócenie przy "krotszy_okres"

  // Indeksuj zdarzenia wg miesiąca od startu
  var eventsByMonth = {};
  events.forEach(function(ev) {
    var evMonthAbs = (ev.year - rokStart) * 12 + (ev.month - startMonth);
    if (evMonthAbs < 0) return;
    if (!eventsByMonth[evMonthAbs]) eventsByMonth[evMonthAbs] = [];
    eventsByMonth[evMonthAbs].push(ev);
  });

  for (var m = 0; m < effectiveEndMonth; m++) {
    if (saldo <= 0) break;
    var calMonthAbs = (startMonth - 1) + m;
    var calYear  = rokStart + Math.floor(calMonthAbs / 12);
    var calMonth = calMonthAbs % 12;
    var remaining = effectiveEndMonth - m;
    var eventLabel = null;
    var nadplataThisMonth = 0;
    var monthClosedByEvent = false;

    // Standardowy fixing na początek miesiąca
    var isFix = (fixCounterSinceReset % fixInterval === 0);
    if (m === 0) isFix = true;
    var monthHadFix = false;
    if (isFix) {
      currentWibor = getWibor(calYear, calMonth + 1, currentWiborMode);
      currentStopa = currentWibor + currentMarza;
      var rFix = calcMonthlyRate(currentWibor, currentMarza);
      if (rateType === 'malejaca') {
        czescKapitalowa = saldo / remaining;
      } else {
        currentRata = calcRataRowna(saldo, rFix, remaining);
      }
      monthHadFix = true;
    }

    // Zdarzenia w tym miesiącu (posortowane: refinansowanie → nadpłata → pełna spłata)
    var monthEvents = eventsByMonth[m] || [];
    monthEvents.sort(function(a, b) {
      var order = { refinansowanie: 0, wydluzenie: 1, nadplata: 2, cykliczna: 2, splata: 3 };
      // `??` (nie `||`), bo `refinansowanie` ma klucz 0 — `||` traktowałby go jak fallback.
      var ao = order[a.type] ?? 2;
      var bo = order[b.type] ?? 2;
      return ao - bo;
    });

    for (var ei = 0; ei < monthEvents.length; ei++) {
      var ev = monthEvents[ei];
      if (saldo <= 0) break;

      if (ev.type === 'refinansowanie') {
        currentMarza = ev.nowaMarza;
        if (ev.nowyWibor !== 'bez_zmian') {
          currentWiborMode = ev.nowyWibor;
          fixInterval = currentWiborMode === '1M' ? 1 : (currentWiborMode === '3M' ? 3 : 6);
        }
        // Prowizja refinansowania
        var prowRefNom = saldo * (ev.prowizjaRef || 0) / 100;
        totalProwizjeNom += prowRefNom;
        totalProwizjeReal += prowRefNom * cumulativeDeflator;
        // Natychmiastowy fixing
        currentWibor = getWibor(calYear, calMonth + 1, currentWiborMode);
        currentStopa = currentWibor + currentMarza;
        var rRef = calcMonthlyRate(currentWibor, currentMarza);
        if (rateType === 'malejaca') {
          czescKapitalowa = saldo / remaining;
        } else {
          currentRata = calcRataRowna(saldo, rRef, remaining);
        }
        fixCounterSinceReset = 0;
        monthHadFix = true;
        eventLabel = 'refinansowanie';
      }

      if (ev.type === 'wydluzenie') {
        // Wydłużenie okresu kredytu o N miesięcy. Saldo i WIBOR bez zmian,
        // tylko remaining rośnie → rata się obniża po przeliczeniu.
        var dodatkowe = Math.max(1, Math.floor(Number.isFinite(ev.miesiace) ? ev.miesiace : 0));
        effectiveEndMonth += dodatkowe;
        remaining = effectiveEndMonth - m;
        var rExt = calcMonthlyRate(currentWibor, currentMarza);
        if (rateType === 'malejaca') {
          czescKapitalowa = saldo / remaining;
        } else {
          currentRata = calcRataRowna(saldo, rExt, remaining);
        }
        if (!eventLabel) eventLabel = 'wydluzenie';
      }

      if (ev.type === 'nadplata' || ev.type === 'cykliczna') {
        var saldoPrzedNadplata = saldo;
        var amt = Math.min(ev.kwota, saldo);
        saldo = Math.max(0, saldo - amt);
        nadplataThisMonth += amt;
        totalNadplatyNom += amt;
        totalNadplatyReal += amt * cumulativeDeflator;

        if (!eventLabel) eventLabel = 'nadplata';

        // Nadpłata zamyka kredyt: dolicz odsetki za ostatni miesiąc, kapitał jest w kolumnie nadpłaty.
        if (saldo <= 0) {
          var rClose = calcMonthlyRate(currentWibor, currentMarza);
          var odsetkiZamkniecia = saldoPrzedNadplata * rClose;
          var rataZamkniecia = odsetkiZamkniecia;
          var rataRealZamkniecia = rataZamkniecia * cumulativeDeflator;
          rows.push({
            rok: calYear, calMonth: calMonth,
            miesiacNazwa: MIESIAC_NAZWY[calMonth],
            dataLabel: MIESIAC_NAZWY[calMonth] + ' ' + calYear,
            miesiac: m + 1, isFix: monthHadFix,
            wibor: currentWibor, stopa: currentStopa,
            rata: rataZamkniecia, odsetki: odsetkiZamkniecia, kapital: 0, saldo: 0,
            deflator: cumulativeDeflator, rataReal: rataRealZamkniecia,
            nadplata: nadplataThisMonth, event: eventLabel
          });
          monthClosedByEvent = true;
          break;
        }

        var r = calcMonthlyRate(currentWibor, currentMarza);
        if (ev.efekt === 'nizsza_rata') {
          remaining = effectiveEndMonth - m;
          if (rateType === 'malejaca') {
            czescKapitalowa = saldo / remaining;
          } else {
            currentRata = calcRataRowna(saldo, r, remaining);
          }
        } else {
          // efekt 'krotszy_okres': rata bez zmian, oblicz nowy efektywny koniec
          if (rateType === 'malejaca') {
            if (czescKapitalowa <= EPSILON) {
              czescKapitalowa = saldo / Math.max(1, remaining);
            }
            if (czescKapitalowa > EPSILON) {
              var newRemainingM = Math.max(1, Math.ceil(saldo / czescKapitalowa));
              effectiveEndMonth = m + newRemainingM;
              remaining = newRemainingM;
            }
          } else if (currentRata > EPSILON) {
            var newRemainingR = null;
            if (Math.abs(r) <= EPSILON) {
              newRemainingR = Math.ceil(saldo / currentRata);
            } else {
              var denom = currentRata - saldo * r;
              if (denom > EPSILON) {
                var q = currentRata / denom;
                if (q > 1 + EPSILON) {
                  newRemainingR = Math.ceil(Math.log(q) / Math.log(1 + r));
                } else if (q > EPSILON) {
                  newRemainingR = 1;
                }
              }
            }
            if (newRemainingR && isFinite(newRemainingR) && newRemainingR > 0) {
              effectiveEndMonth = m + newRemainingR;
              remaining = newRemainingR;
            }
          }
        }
      }

      if (ev.type === 'splata') {
        // Pełna spłata — odsetki + saldo
        var r = calcMonthlyRate(currentWibor, currentMarza);
        var odsOst = saldo * r;
        var rataOst = saldo + odsOst;
        var rataRealOst = rataOst * cumulativeDeflator;
        rows.push({
          rok: calYear, calMonth: calMonth,
          miesiacNazwa: MIESIAC_NAZWY[calMonth],
          dataLabel: MIESIAC_NAZWY[calMonth] + ' ' + calYear,
          miesiac: m + 1, isFix: monthHadFix,
          wibor: currentWibor, stopa: currentStopa,
          rata: rataOst, odsetki: odsOst, kapital: saldo, saldo: 0,
          deflator: cumulativeDeflator, rataReal: rataRealOst,
          nadplata: nadplataThisMonth, event: 'splata'
        });
        saldo = 0;
        monthClosedByEvent = true;
        break;
      }
    }

    if (monthClosedByEvent) break;

    var r = calcMonthlyRate(currentWibor, currentMarza);
    var odsetki = saldo * r;
    var kapital, rata;
    if (rateType === 'malejaca') {
      kapital = Math.min(czescKapitalowa, saldo);
      rata = kapital + odsetki;
    } else {
      rata = currentRata;
      kapital = Math.min(rata - odsetki, saldo);
    }
    saldo = Math.max(0, saldo - kapital);
    var rataReal = rata * cumulativeDeflator;

    rows.push({
      rok: calYear, calMonth: calMonth,
      miesiacNazwa: MIESIAC_NAZWY[calMonth],
      dataLabel: MIESIAC_NAZWY[calMonth] + ' ' + calYear,
      miesiac: m + 1, isFix: monthHadFix,
      wibor: currentWibor, stopa: currentStopa,
      rata: rata, odsetki: odsetki, kapital: kapital, saldo: saldo,
      deflator: cumulativeDeflator, rataReal: rataReal,
      nadplata: nadplataThisMonth, event: eventLabel
    });

    var monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth + 1);
    cumulativeDeflator *= monthlyDeflatorFactor;
    fixCounterSinceReset++;

    if (saldo <= 0) break;
  }

  return {
    rows: rows,
    totalProwizjeNom: totalProwizjeNom,
    totalProwizjeReal: totalProwizjeReal,
    totalNadplatyNom: totalNadplatyNom,
    totalNadplatyReal: totalNadplatyReal
  };
}

function aggregateYearly(rows) {
  var byYear = {};
  rows.forEach(function(r) {
    if (!byYear[r.rok]) byYear[r.rok] = {
      rok: r.rok, sumRata: 0, sumOdsetki: 0, sumKapital: 0,
      sumRataReal: 0, saldo: 0, months: 0, sumWibor: 0, sumStopa: 0,
      sumNadplata: 0, wynagr: getWynagr(r.rok)
    };
    var y = byYear[r.rok];
    y.sumRata += r.rata; y.sumOdsetki += r.odsetki; y.sumKapital += r.kapital;
    y.sumRataReal += r.rataReal; y.saldo = r.saldo; y.months++;
    y.sumWibor += r.wibor; y.sumStopa += r.stopa;
    y.sumNadplata += (r.nadplata || 0);
  });
  Object.values(byYear).forEach(function(y) {
    y.wibor = +(y.sumWibor / y.months).toFixed(2);
    y.stopa = +(y.sumStopa / y.months).toFixed(2);
  });
  return Object.values(byYear);
}

function calcAvgStats(rows) {
  var sumWibor = 0, sumCpi = 0;
  rows.forEach(function(r) {
    sumWibor += r.wibor;
    sumCpi += annualizeMonthlyCpi(getCpiMonthly(r.rok, r.calMonth + 1));
  });
  var n = rows.length;
  return { avgWibor: sumWibor / n, avgCpi: sumCpi / n, avgSpread: (sumWibor - sumCpi) / n };
}

// ==========================================
// STAN APLIKACJI
// ==========================================
var myChart = null;
var currentTab = 'nominal';
var currentData = {};
var wiborMode = '3M';
var salarySource = 'average';
var rateType = 'rowna';
var methodologyOpen = false;
var futureProjectionsOpen = false;
var themeMode = 'dark';
var events = []; // lista zdarzeń
var eventIdCounter = 0;

// ==========================================
// FORMAT
// ==========================================
function fmt(n, dec) {
  if (dec === undefined) dec = 0;
  return n.toLocaleString('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPLN(n) { return fmt(Math.round(n)) + ' PLN'; }
function fmtPct(n) { return fmt(n, 2) + '%'; }
function normalizeNumericString(v) {
  return String(v === undefined || v === null ? '' : v).replace(/,/g, '.');
}
function parseLocaleFloat(v) {
  return parseFloat(normalizeNumericString(v));
}
function isTransientNumericInput(v) {
  var raw = normalizeNumericString(v).trim();
  return raw === '' || raw === '-' || raw === '+' || raw.endsWith('.');
}
function fmtOkres(n) {
  var lat = Math.floor(n / 12);
  var mies = n % 12;
  if (lat === 0) return n + ' miesięcy';
  if (mies === 0) return lat + ' lat';
  return lat + ' lat ' + mies + ' miesięcy';
}

// ==========================================
// MOTYW I PRZELACZNIKI
// ==========================================
function getCssVar(name, fallback) {
  var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
function applyTheme(mode) {
  themeMode = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', themeMode);
  var btn = document.getElementById('theme_toggle_btn');
  if (btn) {
    var isLight = themeMode === 'light';
    btn.textContent = isLight ? 'Motyw: jasny' : 'Motyw: ciemny';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    btn.setAttribute('aria-label', isLight ? 'Przełącz na ciemny motyw' : 'Przełącz na jasny motyw');
  }
  localStorage.setItem('theme_mode', themeMode);
}
function initTheme() {
  var savedTheme = localStorage.getItem('theme_mode');
  if (savedTheme === 'light' || savedTheme === 'dark') { applyTheme(savedTheme); return; }
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}
function toggleTheme() {
  applyTheme(themeMode === 'dark' ? 'light' : 'dark');
  renderChart();
}
function setWiborMode(mode) {
  wiborMode = mode;
  document.getElementById('btn_wibor6m').classList.toggle('active', mode === '6M');
  document.getElementById('btn_wibor3m').classList.toggle('active', mode === '3M');
  var btn1m = document.getElementById('btn_wibor1m');
  if (btn1m) btn1m.classList.toggle('active', mode === '1M');
  calculate();
}
function setRateType(type) {
  rateType = type;
  document.getElementById('btn_rowna').classList.toggle('active', type === 'rowna');
  document.getElementById('btn_malejaca').classList.toggle('active', type === 'malejaca');
  calculate();
}
function switchTab(tab) {
  currentTab = tab;
  var tabs = ['nominal', 'real', 'saldo', 'wibor', 'affordability', 'investment'];
  document.querySelectorAll('#chart-tab-row .tab-btn').forEach(function(b, i) {
    b.classList.toggle('active', tabs[i] === tab);
  });
  renderChart();
}
function switchTableTab(id) {
  ['tA','tB'].forEach(function(t) {
    document.getElementById(t).classList.toggle('active', t === id);
  });
  ['tbtn_A','tbtn_B'].forEach(function(b) {
    document.getElementById(b).classList.toggle('active', b === (id === 'tA' ? 'tbtn_A' : 'tbtn_B'));
  });
}
function toggleMethodology() {
  methodologyOpen = !methodologyOpen;
  var body = document.getElementById('metodyka_body');
  var btn = document.getElementById('metodyka_toggle_btn');
  if (!body || !btn) return;
  body.hidden = !methodologyOpen;
  btn.setAttribute('aria-expanded', methodologyOpen ? 'true' : 'false');
  btn.textContent = methodologyOpen ? 'Ukryj metodykę i wzory' : 'Pokaż metodykę i wzory';
}
function toggleFutureProjections() {
  futureProjectionsOpen = !futureProjectionsOpen;
  syncFutureProjectionsToggleUI();
}
function syncFutureProjectionsToggleUI() {
  var body = document.getElementById('future_projections_body');
  var btn = document.getElementById('future_toggle_btn');
  if (!body || !btn) return;
  body.hidden = !futureProjectionsOpen;
  btn.setAttribute('aria-expanded', futureProjectionsOpen ? 'true' : 'false');
  btn.textContent = futureProjectionsOpen ? 'Ukryj projekcje przyszłe' : 'Pokaż projekcje przyszłe';
}
function syncHistoricalRanges() {
  var rokInput = document.getElementById('rok_start');
  var rokRange = document.getElementById('rok_r');
  rokInput.min = HIST_MIN_YEAR; rokInput.max = LAST_HIST_WIBOR_YEAR;
  rokRange.min = HIST_MIN_YEAR; rokRange.max = LAST_HIST_WIBOR_YEAR;
  if (parseInt(rokInput.value) > LAST_HIST_WIBOR_YEAR) {
    rokInput.value = rokRange.value = LAST_HIST_WIBOR_YEAR;
    document.getElementById('rok_rv').innerHTML = String(LAST_HIST_WIBOR_YEAR);
  }
}

// ==========================================
// ZDARZENIA (UI)
// ==========================================
function addEvent(type) {
  if (events.length >= 20) return;
  var id = ++eventIdCounter;
  var rokStart = parseInt(document.getElementById('rok_start').value) || 2005;
  var ev = {
    id: id,
    type: type || 'nadplata',
    kwota: 50000,
    month: 1,
    year: rokStart + 1,
    efekt: 'krotszy_okres',
    // Cykliczna
    doMonth: 12,
    doYear: rokStart + 5,
    doKonca: true,
    // Refinansowanie
    nowaMarza: 1.5,
    prowizjaRef: 0,
    nowyWibor: 'bez_zmian',
    // Wydłużenie okresu
    miesiace: 60
  };
  events.push(ev);
  renderEvents();
  calculate();
}

function removeEvent(id) {
  events = events.filter(function(e) { return e.id !== id; });
  renderEvents();
  calculate();
}

function updateEvent(id, field, value) {
  var ev = events.find(function(e) { return e.id === id; });
  if (!ev) return;
  if (field === 'type' || field === 'doKonca') {
    ev[field] = value;
    renderEvents();
  } else {
    ev[field] = value;
  }
  calculate();
}

function renderEvents() {
  var container = document.getElementById('events_container');
  container.innerHTML = '';
  events.forEach(function(ev) {
    var card = document.createElement('div');
    card.className = 'event-card';
    card.setAttribute('data-event-id', ev.id);

    var badgeClass = 'event-badge-overpay';
    var badgeText = 'nadpłata';
    if (ev.type === 'cykliczna') { badgeClass = 'event-badge-recurring'; badgeText = 'cykliczna'; }
    if (ev.type === 'refinansowanie') { badgeClass = 'event-badge-refinance'; badgeText = 'refinansowanie'; }
    if (ev.type === 'splata') { badgeClass = 'event-badge-payoff'; badgeText = 'pełna spłata'; }
    if (ev.type === 'wydluzenie') { badgeClass = 'event-badge-extend'; badgeText = 'wydłużenie'; }

    var html = '<div class="event-card-header">' +
      '<span class="event-card-title">#' + ev.id + ' <span class="event-badge ' + badgeClass + '">' + badgeText + '</span></span>' +
      '<button type="button" class="event-card-remove" onclick="removeEvent(' + ev.id + ')">✕</button>' +
      '</div>';

    // Typ zdarzenia
    html += '<div class="field"><label>Typ zdarzenia</label>' +
      '<select onchange="updateEvent(' + ev.id + ',\'type\',this.value)">' +
      '<option value="nadplata"' + (ev.type === 'nadplata' ? ' selected' : '') + '>Nadpłata jednorazowa</option>' +
      '<option value="cykliczna"' + (ev.type === 'cykliczna' ? ' selected' : '') + '>Nadpłata cykliczna</option>' +
      '<option value="splata"' + (ev.type === 'splata' ? ' selected' : '') + '>Pełna wcześniejsza spłata</option>' +
      '<option value="refinansowanie"' + (ev.type === 'refinansowanie' ? ' selected' : '') + '>Przeniesienie do innego banku</option>' +
      '<option value="wydluzenie"' + (ev.type === 'wydluzenie' ? ' selected' : '') + '>Wydłużenie okresu kredytu</option>' +
      '</select></div>';

    // Kwota (nadpłaty)
    if (ev.type === 'nadplata' || ev.type === 'cykliczna') {
      html += '<div class="field"><label>Kwota nadpłaty (PLN' + (ev.type === 'cykliczna' ? '/miesiąc' : '') + ')</label>' +
        '<input type="number" value="' + ev.kwota + '" min="100" step="1000" ' +
        'onchange="updateEvent(' + ev.id + ',\'kwota\',parseFloat(this.value)||0)"></div>';
    }

    // Data (wspólna: miesiąc + rok)
    var monthSelect = '<select onchange="updateEvent(' + ev.id + ',\'month\',parseInt(this.value))">';
    var mNazwy = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
    for (var mi = 0; mi < 12; mi++) {
      monthSelect += '<option value="' + (mi+1) + '"' + (ev.month === mi+1 ? ' selected' : '') + '>' + mNazwy[mi] + '</option>';
    }
    monthSelect += '</select>';

    if (ev.type === 'cykliczna') {
      html += '<div class="field"><label>Od</label><div class="field-pair">' + monthSelect +
        '<input type="number" value="' + ev.year + '" min="2000" max="2060" ' +
        'onchange="updateEvent(' + ev.id + ',\'year\',parseInt(this.value)||parseInt(document.getElementById(\'rok_start\').value)||2005)"></div></div>';

      // Do kiedy
      var doCheckbox = '<div class="checkbox-row"><input type="checkbox" id="doKonca_' + ev.id + '" ' +
        (ev.doKonca ? 'checked' : '') + ' onchange="updateEvent(' + ev.id + ',\'doKonca\',this.checked)">' +
        '<label for="doKonca_' + ev.id + '">Do końca kredytu</label></div>';

      if (!ev.doKonca) {
        var doMonthSelect = '<select onchange="updateEvent(' + ev.id + ',\'doMonth\',parseInt(this.value))">';
        for (var mi = 0; mi < 12; mi++) {
          doMonthSelect += '<option value="' + (mi+1) + '"' + (ev.doMonth === mi+1 ? ' selected' : '') + '>' + mNazwy[mi] + '</option>';
        }
        doMonthSelect += '</select>';
        html += '<div class="field"><label>Do</label><div class="field-pair">' + doMonthSelect +
          '<input type="number" value="' + ev.doYear + '" min="2000" max="2060" ' +
          'onchange="updateEvent(' + ev.id + ',\'doYear\',parseInt(this.value)||2025)"></div>' + doCheckbox + '</div>';
      } else {
        html += '<div class="field">' + doCheckbox + '</div>';
      }
    } else {
      html += '<div class="field"><label>Data</label><div class="field-pair">' + monthSelect +
        '<input type="number" value="' + ev.year + '" min="2000" max="2060" ' +
        'onchange="updateEvent(' + ev.id + ',\'year\',parseInt(this.value)||parseInt(document.getElementById(\'rok_start\').value)||2005)"></div></div>';
    }

    // Efekt nadpłaty
    if (ev.type === 'nadplata' || ev.type === 'cykliczna') {
      html += '<div class="field"><label>Efekt nadpłaty</label>' +
        '<div class="radio-row">' +
        '<label><input type="radio" name="efekt_' + ev.id + '" value="krotszy_okres" ' +
        (ev.efekt === 'krotszy_okres' ? 'checked' : '') + ' onchange="updateEvent(' + ev.id + ',\'efekt\',\'krotszy_okres\')"> Krótszy okres</label>' +
        '<label><input type="radio" name="efekt_' + ev.id + '" value="nizsza_rata" ' +
        (ev.efekt === 'nizsza_rata' ? 'checked' : '') + ' onchange="updateEvent(' + ev.id + ',\'efekt\',\'nizsza_rata\')"> Niższa rata</label>' +
        '</div></div>';
    }

    // Refinansowanie - dodatkowe pola
    if (ev.type === 'refinansowanie') {
      html += '<div class="field"><label>Nowa marża (%)</label>' +
        '<input type="number" value="' + ev.nowaMarza + '" min="0.5" max="5" step="0.05" ' +
        'onchange="updateEvent(' + ev.id + ',\'nowaMarza\',parseFloat(this.value)||1.5)"></div>';
      html += '<div class="field"><label>Prowizja refinansowania (%)</label>' +
        '<input type="number" value="' + ev.prowizjaRef + '" min="0" max="5" step="0.1" ' +
        'onchange="updateEvent(' + ev.id + ',\'prowizjaRef\',parseFloat(this.value)||0)"></div>';
      html += '<div class="field"><label>Zmiana wskaźnika WIBOR</label>' +
        '<select onchange="updateEvent(' + ev.id + ',\'nowyWibor\',this.value)">' +
        '<option value="bez_zmian"' + (ev.nowyWibor === 'bez_zmian' ? ' selected' : '') + '>Bez zmian</option>' +
        '<option value="3M"' + (ev.nowyWibor === '3M' ? ' selected' : '') + '>Zmień na WIBOR 3M</option>' +
        '<option value="6M"' + (ev.nowyWibor === '6M' ? ' selected' : '') + '>Zmień na WIBOR 6M</option>' +
        '</select></div>';
    }

    // Wydłużenie - liczba miesięcy
    if (ev.type === 'wydluzenie') {
      html += '<div class="field"><label>Liczba miesięcy do dodania</label>' +
        '<input type="number" value="' + ev.miesiace + '" min="1" max="240" step="1" ' +
        'onchange="var v=parseInt(this.value); updateEvent(' + ev.id + ',\'miesiace\',Number.isFinite(v)?v:60)"></div>';
    }

    card.innerHTML = html;
    container.appendChild(card);
  });
}

// Rozwiniecie zdarzeń cyklicznych do listy jednorazowych
function expandEvents(rawEvents, rokStart, startMonth, nMonths) {
  var expanded = [];
  rawEvents.forEach(function(ev) {
    if (ev.type === 'cykliczna') {
      var startAbs = (ev.year - rokStart) * 12 + (ev.month - startMonth);
      var endAbs;
      if (ev.doKonca) {
        endAbs = nMonths - 1;
      } else {
        endAbs = (ev.doYear - rokStart) * 12 + (ev.doMonth - startMonth);
      }
      for (var mi = startAbs; mi <= endAbs && mi < nMonths; mi++) {
        if (mi < 0) continue;
        var absM = (startMonth - 1) + mi;
        var yr = rokStart + Math.floor(absM / 12);
        var mn = (absM % 12) + 1;
        expanded.push({
          type: 'cykliczna',
          kwota: ev.kwota,
          month: mn,
          year: yr,
          efekt: ev.efekt
        });
      }
    } else {
      expanded.push(ev);
    }
  });
  return expanded;
}

// ==========================================
// SILNIK INWESTYCYJNY (opportunity cost)
// ==========================================
function getInvestmentType() {
  var el = document.getElementById('investment_type');
  return el ? el.value : 'none';
}

function getIndexValue(type, year, month) {
  var key = year + '-' + String(month).padStart(2, '0');
  if (type === 'wig30') return WIG30_MONTHLY[key];
  if (type === 'wig') return WIG_MONTHLY[key];
  if (type === 'sp500') {
    var spx = SPX_MONTHLY[key];
    if (spx === undefined) return undefined;
    var usd = USDPLN_MONTHLY[key];
    if (usd === undefined) usd = getFutureUsdPln();
    return spx * usd;
  }
  return undefined;
}

function getMonthlyInvestmentReturn(type, year, month) {
  if (type === 'gotowka') return 0;
  if (type === 'lokata') {
    var key = year + '-' + String(month).padStart(2, '0');
    var rate = NBP_RATE_MONTHLY[key];
    if (rate === undefined) rate = getFutureDepositRate();
    return rate / 12 / 100;
  }
  // Akcje: WIG30, WIG, SP500
  var prevMonth = month - 1, prevYear = year;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }
  var cur = getIndexValue(type, year, month);
  var prev = getIndexValue(type, prevYear, prevMonth);
  if (cur !== undefined && prev !== undefined && prev > 0) {
    return cur / prev - 1;
  }
  // Fallback: stopa roczna / 12
  return getFutureStockReturn() / 12 / 100;
}

function calcInvestmentPortfolio(overpayments, rokStart, startMonth, nMonths, investmentType) {
  if (investmentType === 'none' || overpayments.length === 0) {
    return null;
  }

  // Buduj mapę nadpłat: klucz = numer miesiąca (0-based) → kwota
  var overpayMap = {};
  var totalWplaty = 0;
  overpayments.forEach(function(op) {
    var m = op.month;
    overpayMap[m] = (overpayMap[m] || 0) + op.kwota;
    totalWplaty += op.kwota;
  });

  var monthly = [];
  var portfolio = 0;
  var cumulativeDeflator = 1.0;
  var totalWplatyReal = 0;

  for (var m = 0; m <= nMonths; m++) {
    var calMonth = ((startMonth - 1 + m) % 12) + 1;
    var calYear = rokStart + Math.floor((startMonth - 1 + m) / 12);

    // Wpłata na początku miesiąca
    var wplata = overpayMap[m] || 0;
    portfolio += wplata;
    totalWplatyReal += wplata * cumulativeDeflator;

    // Wzrost portfela
    var stopa = 0;
    var zyskNomMies = 0;
    if (m > 0 || wplata > 0) {
      stopa = getMonthlyInvestmentReturn(investmentType, calYear, calMonth);
      if (m > 0) {
        zyskNomMies = portfolio * stopa;
        portfolio += zyskNomMies;
      }
    }
    var zyskRealMies = zyskNomMies * cumulativeDeflator;

    monthly.push({
      wartoscNom: portfolio,
      wartoscReal: portfolio * cumulativeDeflator,
      wplata: wplata,
      stopaZwrotu: stopa * 100,
      zyskNomMies: zyskNomMies,
      zyskRealMies: zyskRealMies,
      deflator: cumulativeDeflator
    });

    // Deflator CPI aktualizowany co miesiąc (spójnie z harmonogramem kredytu)
    var monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth);
    cumulativeDeflator *= monthlyDeflatorFactor;
  }

  var zyskBrutto = portfolio - totalWplaty;
  var podatekBelki = Math.max(0, zyskBrutto) * 0.19;
  var portfolioNetto = portfolio - podatekBelki;
  var zyskNetto = portfolioNetto - totalWplaty;
  var finalDeflator = monthly.length ? monthly[monthly.length - 1].deflator : 1;
  var portfolioRealBrutto = portfolio * finalDeflator;
  var portfolioRealNetto = portfolioNetto * finalDeflator;
  var podatekBelkiReal = podatekBelki * finalDeflator;
  var zyskRealBrutto = portfolioRealBrutto - totalWplatyReal;
  var zyskRealNetto = portfolioRealNetto - totalWplatyReal;

  return {
    monthly: monthly,
    totalWplaty: totalWplaty,
    totalWplatyReal: totalWplatyReal,
    portfolioBrutto: portfolio,
    portfolioNetto: portfolioNetto,
    zyskBrutto: zyskBrutto,
    zyskNetto: zyskNetto,
    podatekBelki: podatekBelki,
    podatekBelkiReal: podatekBelkiReal,
    portfolioRealBrutto: portfolioRealBrutto,
    portfolioRealNetto: portfolioRealNetto,
    zyskRealBrutto: zyskRealBrutto,
    zyskRealNetto: zyskRealNetto,
    investmentType: investmentType
  };
}

// ==========================================
// GLOWNA KALKULACJA
// ==========================================
function calculate() {
  var kwota      = parseLocaleFloat(document.getElementById('kwota').value) || 350000;
  var rokStart   = parseInt(document.getElementById('rok_start').value) || 2005;
  var startMonth = parseInt(document.getElementById('miesiac_start').value) || 1;
  salarySource   = document.getElementById('salary_source').value || 'average';
  var marzaInput = parseLocaleFloat(document.getElementById('marza').value);
  var marza      = Number.isFinite(marzaInput) ? marzaInput : 2;
  var prowizjaInput = parseLocaleFloat(document.getElementById('prowizja').value);
  var prowizjaPct = Number.isFinite(prowizjaInput) ? prowizjaInput : 0;
  var nMonths    = parseInt(document.getElementById('okres').value) || 360;
  var fixInterval = wiborMode === '1M' ? 1 : (wiborMode === '3M' ? 3 : 6);

  var wiborStart = getWibor(rokStart, startMonth, wiborMode);
  var cpiStartRaw = getCpiMonthly(rokStart, startMonth);
  var cpiStartComparable = annualizeMonthlyCpi(cpiStartRaw);
  var stopaStart = wiborStart + marza;
  var realStopa  = stopaStart - cpiStartComparable;

  // Aktualizuj etykiety
  document.getElementById('wibor_label').textContent = 'WIBOR ' + wiborMode + ' (miesiąc startu)';
  var cpiLabelEl = document.getElementById('cpi_label');
  cpiLabelEl.textContent = 'Inflacja CPI (miesiąc do miesiąca, miesiąc startu)';
  document.getElementById('wibor_display').textContent = fmtPct(wiborStart);
  document.getElementById('marza_display').textContent = fmtPct(marza);
  document.getElementById('total_rate_display').textContent = fmtPct(stopaStart);
  document.getElementById('inf_display').textContent =
    fmtPct(cpiStartRaw) + ' (≈' + fmtPct(cpiStartComparable) + ' rok do roku)';
  document.getElementById('real_rate_display').textContent = fmtPct(realStopa);

  var tagWiborEl = document.getElementById('tag_wibor');
  tagWiborEl.textContent = 'WIBOR ' + wiborMode + ' · dane historyczne (notowania miesięczne)';
  var tagCpiEl = document.getElementById('tag_cpi');
  tagCpiEl.textContent = 'Inflacja CPI · GUS Polska (miesięczna, miesiąc do miesiąca)';

  // Harmonogram bazowy (A)
  var rowsA = calcHarmonogram(kwota, rokStart, startMonth, nMonths, marza, wiborMode, rateType);
  var prowizjaA = kwota * prowizjaPct / 100;

  // Harmonogram z wydarzeniami (B)
  var expandedEvents = expandEvents(events, rokStart, startMonth, nMonths);
  var resultB = calcHarmonogramWithEvents(kwota, rokStart, startMonth, nMonths, marza, wiborMode, rateType, expandedEvents, prowizjaPct);
  var rowsB = resultB.rows;

  var yearA = aggregateYearly(rowsA);
  var yearB = aggregateYearly(rowsB);

  // Karty podsumowania
  var rataA1 = rowsA[0] ? rowsA[0].rata : 0;
  var lastModRow = rowsB.length > 0 ? rowsB[rowsB.length - 1] : null;
  var rataB_current = lastModRow && lastModRow.saldo > 0 ? lastModRow.rata : (rowsB.length > 0 ? rowsB[rowsB.length - 1].rata : 0);
  // Dla rat malejących, pokaż pierwszą ratę
  if (rateType === 'malejaca') {
    document.getElementById('rata_base').textContent = fmt(Math.round(rataA1));
    document.getElementById('rata_mod').textContent = rowsB.length > 0 ? fmt(Math.round(rowsB[rowsB.length - 1].rata)) : '—';
  } else {
    document.getElementById('rata_base').textContent = fmt(Math.round(rataA1));
    // Pokaż ostatnią ratę wariantu B
    var lastBRata = rowsB.length > 0 ? rowsB[rowsB.length - 1].rata : 0;
    document.getElementById('rata_mod').textContent = fmt(Math.round(lastBRata));
  }

  if (rowsB.length > 0 && rowsB[rowsB.length - 1].saldo <= 0 && rowsB.length < rowsA.length) {
    document.getElementById('rata_mod_sub').textContent = 'Spłacony w ' + fmtOkres(rowsB.length);
  } else {
    document.getElementById('rata_mod_sub').textContent = 'PLN / miesiąc (ostatnia rata)';
  }

  // Sumy
  var totNomA = rowsA.reduce(function(s,r){ return s + r.rata; }, 0);
  var totNomB = rowsB.reduce(function(s,r){ return s + r.rata; }, 0) + resultB.totalNadplatyNom;
  var totRealA = rowsA.reduce(function(s,r){ return s + r.rataReal; }, 0);
  var totRealB = rowsB.reduce(function(s,r){ return s + r.rataReal; }, 0) + resultB.totalNadplatyReal;
  var totRealAWithProwizje = totRealA + prowizjaA;
  var totRealBWithProwizje = totRealB + resultB.totalProwizjeReal;

  var odsetNomA = rowsA.reduce(function(s,r){ return s + r.odsetki; }, 0);
  var odsetNomB = rowsB.reduce(function(s,r){ return s + r.odsetki; }, 0);
  var odsetRealA = totRealA - kwota;
  var odsetRealB = totRealB - kwota;
  var infZyskA = (totNomA + prowizjaA) - totRealAWithProwizje;
  var infZyskB = (totNomB + resultB.totalProwizjeNom) - totRealBWithProwizje;

  var savedNom = odsetNomA - odsetNomB;
  document.getElementById('saved_interest').textContent = savedNom > 0 ? fmt(Math.round(savedNom)) : '0';

  // Porownanie
  var MIESIAC_NAZWY_PL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
  var dataWyceny = MIESIAC_NAZWY_PL[startMonth - 1] + ' ' + rokStart;

  document.getElementById('cA_okres').textContent = fmtOkres(rowsA.length);
  document.getElementById('cB_okres').textContent = fmtOkres(rowsB.length);
  document.getElementById('cA_nom').textContent = fmtPLN(totNomA + prowizjaA);
  document.getElementById('cA_odsetki').textContent = fmtPLN(odsetNomA);
  document.getElementById('cA_prowizje').textContent = fmtPLN(prowizjaA);
  document.getElementById('cA_real').textContent = fmtPLN(totRealAWithProwizje);
  document.getElementById('cA_real_odsetki').textContent = fmtPLN(odsetRealA);
  document.getElementById('cA_inflacja_zysk').textContent = fmtPLN(infZyskA);

  document.getElementById('cB_nom').textContent = fmtPLN(totNomB + resultB.totalProwizjeNom);
  document.getElementById('cB_odsetki').textContent = fmtPLN(odsetNomB);
  document.getElementById('cB_prowizje').textContent = fmtPLN(resultB.totalProwizjeNom) + ' + ' + fmtPLN(resultB.totalNadplatyNom) + ' nadpł.';
  document.getElementById('cB_real').textContent = fmtPLN(totRealBWithProwizje);
  document.getElementById('cB_real_odsetki').textContent = fmtPLN(odsetRealB);
  document.getElementById('cB_inflacja_zysk').textContent = fmtPLN(infZyskB);

  document.querySelectorAll('.real-date-label').forEach(function(el) {
    el.textContent = 'Całkowita kwota realna (PLN z ' + dataWyceny + ')';
  });
  document.querySelectorAll('.real-odsetki-label').forEach(function(el) {
    el.textContent = 'Realne odsetki (PLN z ' + dataWyceny + ')';
  });

  // Werdykt
  var verdictEl = document.getElementById('verdict_text');
  if (events.length === 0) {
    verdictEl.innerHTML = 'Dodaj zdarzenia aby zobaczyć porównanie nowego wariantu z bazowym.';
  } else {
    var savedMonths = rowsA.length - rowsB.length;
    var savedNomTotal = (totNomA + prowizjaA) - (totNomB + resultB.totalProwizjeNom);
    var savedRealTotal = totRealAWithProwizje - totRealBWithProwizje;
    var txt = '';
    if (savedMonths > 0) {
      txt += 'Nadpłaty skracają kredyt o <strong>' + fmtOkres(savedMonths) + '</strong>. ';
    }
    if (savedNom > 0) {
      txt += 'Oszczędzasz <strong>' + fmtPLN(savedNom) + '</strong> na odsetkach nominalnych. ';
    }
    if (savedRealTotal > 0) {
      txt += 'Po uwzględnieniu inflacji (PLN z ' + dataWyceny + ') oszczędność wynosi <strong>' + fmtPLN(savedRealTotal) + '</strong>.';
    } else if (savedRealTotal < 0) {
      txt += 'Uwaga: po uwzględnieniu inflacji (PLN z ' + dataWyceny + ') nowy wariant kosztuje realnie <strong>' + fmtPLN(Math.abs(savedRealTotal)) + '</strong> więcej — inflacja "zjadła" oszczędności.';
    }
    if (resultB.totalProwizjeNom > prowizjaA) {
      txt += ' Łączne prowizje w nowym wariancie: <strong>' + fmtPLN(resultB.totalProwizjeNom) + '</strong>.';
    }
    // Dopisz informację o inwestycji do werdyktu
    var INVESTMENT_LABELS = {wig30:'WIG30', wig:'WIG', sp500:'S&P 500 w PLN', lokata:'Lokata bankowa', gotowka:'Gotówka'};
    if (investmentData && investmentType !== 'none') {
      var invLabel = INVESTMENT_LABELS[investmentType] || investmentType;
      var bilansNom = savedNom - investmentData.zyskNetto;
      if (bilansNom >= 0) {
        txt += ' Gdyby te same pieniądze trafiły do ' + invLabel + ', portfel byłby wart <strong>' + fmtPLN(investmentData.portfolioNetto) + '</strong> netto';
        txt += ' (zysk netto <strong>' + fmtPLN(investmentData.zyskNetto) + '</strong> po 19% podatku Belki).';
        txt += ' <strong>Bilans: nadpłata lepsza o ' + fmtPLN(bilansNom) + '</strong> nominalnie.';
      } else {
        txt += ' ⚠ Gdyby zamiast nadpłacić, zainwestować w ' + invLabel + ', zysk netto wyniósłby <strong>' + fmtPLN(investmentData.zyskNetto) + '</strong>';
        txt += ' — o <strong>' + fmtPLN(Math.abs(bilansNom)) + '</strong> więcej niż oszczędność na odsetkach.';
        txt += ' Nadpłata to realnie utracona korzyść.';
      }
    }
    verdictEl.innerHTML = txt || 'Brak istotnych różnic między wariantami.';
  }

  // Nota metodologiczna
  document.getElementById('note_extra').innerHTML =
    '<strong>Metodologia:</strong> ' +
    'Fixing WIBOR ' + wiborMode + ' co ' + fixInterval + ' miesięcy od startu. ' +
    'Rodzaj rat: ' + (rateType === 'malejaca' ? 'malejące' : 'równe (annuitet)') + '. ' +
    'Dane historyczne: WIBOR do ' + LAST_HIST_WIBOR_YEAR + ', CPI do ' + LAST_HIST_CPI +
    '. Projekcja: WIBOR ' + getFutureWibor() + '%, inflacja ' + getFutureCpi() + '%, wzrost wynagrodzeń ' + getFutureSalaryGrowth() + '%.';
  // Portfel inwestycyjny (opportunity cost)
  var investmentType = getInvestmentType();
  var investmentData = null;
  var overpayments = [];

  // Zbierz nadpłaty z harmonogramu B
  if (investmentType !== 'none') {
    rowsB.forEach(function(r) {
      if (r.nadplata > 0) {
        overpayments.push({ month: r.miesiac - 1, kwota: r.nadplata });
      }
    });
    investmentData = calcInvestmentPortfolio(overpayments, rokStart, startMonth, rowsB.length - 1, investmentType);
  }

  // Aktualizuj kartę inwestycyjną i sekcję porównania
  var INVESTMENT_LABELS = {wig30:'WIG30', wig:'WIG', sp500:'S&P 500 w PLN', lokata:'Lokata bankowa', gotowka:'Gotówka'};
  var cardInv = document.getElementById('card_investment');
  var compSection = document.getElementById('investment_comparison');
  if (cardInv) {
    if (investmentData && investmentType !== 'none') {
      var bilansNom = savedNom - investmentData.zyskNetto;
      cardInv.style.display = '';
      var balEl = document.getElementById('investment_balance');
      var balSubEl = document.getElementById('investment_balance_sub');
      balEl.textContent = (bilansNom >= 0 ? '+' : '') + fmt(Math.round(bilansNom)) + ' PLN';
      balEl.style.color = bilansNom >= 0 ? 'var(--success)' : 'var(--danger)';
      balSubEl.textContent = bilansNom >= 0 ? 'nadpłata lepsza (vs ' + (INVESTMENT_LABELS[investmentType] || investmentType) + ')' : 'inwestycja lepsza (vs ' + (INVESTMENT_LABELS[investmentType] || investmentType) + ')';
    } else {
      cardInv.style.display = 'none';
    }
  }
  if (compSection) {
    if (investmentData && investmentType !== 'none') {
      var invLabel = INVESTMENT_LABELS[investmentType] || investmentType;
      var bilansNom = savedNom - investmentData.zyskNetto;
      var savedRealOdsetki = (rowsA.reduce(function(s,r){return s+r.rataReal;},0)) - (rowsB.reduce(function(s,r){return s+r.rataReal;},0) + resultB.totalNadplatyReal);
      var invRealZysk = investmentData.zyskRealNetto;
      var bilansReal = savedRealOdsetki - invRealZysk;
      var wniosekNom = bilansNom >= 0
        ? 'Nominalnie: nadpłata opłaciła się bardziej niż ' + invLabel + '.'
        : 'Nominalnie: inwestycja w ' + invLabel + ' byłaby bardziej opłacalna niż nadpłata.';
      var wniosekReal = bilansReal >= 0
        ? 'Realnie (po CPI): nadpłata opłaciła się bardziej.'
        : 'Realnie (po CPI): inwestycja byłaby bardziej opłacalna.';
      var wniosek = wniosekNom + ' ' + wniosekReal;
      compSection.style.display = '';
      compSection.innerHTML =
        '<h3>Analiza kosztu alternatywnego (inwestycja vs nadpłata)</h3>' +
        '<table class="comparison-table">' +
        '<tr><td>Instrument inwestycyjny</td><td><strong>' + invLabel + '</strong></td></tr>' +
        '<tr><td>Łączne wpłaty (= nadpłaty)</td><td>' + fmtPLN(investmentData.totalWplaty) + '</td></tr>' +
        '<tr><td>Wartość portfela na koniec (brutto)</td><td>' + fmtPLN(investmentData.portfolioBrutto) + '</td></tr>' +
        '<tr><td>Zysk z inwestycji (nom.)</td><td>' + fmtPLN(investmentData.zyskBrutto) + '</td></tr>' +
        '<tr><td>Podatek Belki (19%)</td><td>' + fmtPLN(investmentData.podatekBelki) + '</td></tr>' +
        '<tr><td>Zysk netto (po podatku)</td><td><strong>' + fmtPLN(investmentData.zyskNetto) + '</strong></td></tr>' +
        '<tr><td>Zysk netto (real., po CPI)</td><td><strong>' + fmtPLN(investmentData.zyskRealNetto) + '</strong></td></tr>' +
        '<tr><td>Oszczędność odsetek (nom.)</td><td><strong>' + fmtPLN(savedNom) + '</strong></td></tr>' +
        '<tr><td>Oszczędność odsetek (real.)</td><td><strong>' + fmtPLN(savedRealOdsetki) + '</strong></td></tr>' +
        '<tr class="separator"><td colspan="2"></td></tr>' +
        '<tr><td>BILANS nominalny (nadpłata − inwest.)</td><td style="color:' + (bilansNom >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">' + (bilansNom >= 0 ? '+' : '') + fmtPLN(bilansNom) + '</td></tr>' +
        '<tr><td>BILANS realny (nadpłata − inwest., po CPI)</td><td style="color:' + (bilansReal >= 0 ? 'var(--success)' : 'var(--danger)') + ';font-weight:700">' + (bilansReal >= 0 ? '+' : '') + fmtPLN(bilansReal) + '</td></tr>' +
        '<tr><td colspan="2" style="padding-top:8px;font-style:italic">' + wniosek + '</td></tr>' +
        '</table>';
    } else {
      compSection.style.display = 'none';
      compSection.innerHTML = '';
    }
  }

  currentData = {
    rowsA: rowsA, rowsB: rowsB, yearA: yearA, yearB: yearB,
    kwota: kwota, rokStart: rokStart, startMonth: startMonth, nMonths: nMonths,
    marza: marza, resultB: resultB, prowizjaA: prowizjaA,
    investment: investmentData, investmentType: investmentType,
    savedNom: savedNom, odsetNomA: odsetNomA, odsetNomB: odsetNomB
  };
  renderChart();
  renderTable('tableA', rowsA, kwota, false);
  var invMonthly = (investmentData && investmentType !== 'none') ? investmentData.monthly : null;
  renderTable('tableB', rowsB, kwota, true, invMonthly);
}

// ==========================================
// RENDER WYKRESU
// ==========================================
function makeChartOpts(yTitleText, cbLabel) {
  var legendColor = getCssVar('--chart-legend', '#6b7385');
  var tooltipBg = getCssVar('--chart-tooltip-bg', '#13161d');
  var borderColor = getCssVar('--border', '#252a38');
  var tooltipTitleColor = getCssVar('--text', '#e8eaf0');
  var tooltipBodyColor = getCssVar('--chart-tooltip-body', '#9098b0');
  var tickColor = getCssVar('--chart-tick', '#4a5168');
  var gridColor = getCssVar('--chart-grid', 'rgba(37,42,56,0.5)');
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: legendColor, font: { family: 'DM Mono', size: 10 }, boxWidth: 12 } },
      tooltip: {
        backgroundColor: tooltipBg, borderColor: borderColor, borderWidth: 1,
        titleColor: tooltipTitleColor, bodyColor: tooltipBodyColor,
        titleFont: { family: 'DM Mono', size: 11 }, bodyFont: { family: 'DM Mono', size: 11 },
        callbacks: { label: cbLabel }
      }
    },
    scales: {
      x: { ticks: { color: tickColor, font: { family: 'DM Mono', size: 10 }, maxRotation: 45 },
           grid: { color: gridColor } },
      y: { ticks: { color: tickColor, font: { family: 'DM Mono', size: 10 } },
           grid: { color: gridColor },
           title: { display: true, text: yTitleText, color: tickColor,
                    font: { family: 'DM Mono', size: 10 } } }
    }
  };
}

function renderChart() {
  var d = currentData;
  if (!d.rowsA) return;
  var ctx = document.getElementById('myChart').getContext('2d');
  if (myChart) myChart.destroy();

  if (currentTab === 'wibor') {
    var years = [];
    for (var y = HIST_MIN_YEAR; y <= LAST_HIST_WIBOR_YEAR; y++) years.push(y);
    var opts = makeChartOpts('%', function(c) {
      var v = c.parsed.y;
      return v !== null ? c.dataset.label + ': ' + v.toFixed(2) + '%' : '';
    });
    opts.scales.y.ticks.callback = function(v) { return v + '%'; };
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: years.map(String),
        datasets: [
          { label: 'WIBOR 6M (%)', data: years.map(function(y){ return WIBOR6M_ANNUAL[y] !== undefined ? WIBOR6M_ANNUAL[y] : null; }),
            borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.07)',
            borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false },
          { label: 'WIBOR 3M (%)', data: years.map(function(y){ return WIBOR3M_ANNUAL[y] !== undefined ? WIBOR3M_ANNUAL[y] : null; }),
            borderColor: '#7eb8c9', backgroundColor: 'rgba(126,184,201,0.07)',
            borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false },
          { label: 'WIBOR 1M (%)', data: years.map(function(y){ return WIBOR1M_ANNUAL[y] !== undefined ? WIBOR1M_ANNUAL[y] : null; }),
            borderColor: '#c97eb8', backgroundColor: 'rgba(201,126,184,0.07)',
            borderWidth: 2, pointRadius: 2, tension: 0.3, fill: false },
          { label: 'Inflacja CPI (%)', data: years.map(function(y){ return annualizeMonthlyCpiForYear(y); }),
            borderColor: '#70c997', backgroundColor: 'rgba(112,201,151,0.07)',
            borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.3, fill: false }
        ]
      },
      options: opts
    });
    return;
  }

  if (currentTab === 'affordability') {
    var salaryMeta = getSalaryMeta();
    var allYears = Array.from(new Set(d.yearA.map(function(r){return r.rok;}).concat(d.yearB.map(function(r){return r.rok;})))).sort();
    var mapA = {}, mapB = {};
    d.yearA.forEach(function(r){ mapA[r.rok] = r; });
    d.yearB.forEach(function(r){ mapB[r.rok] = r; });
    function pct(row) { return row ? parseFloat((row.sumRata / row.months / row.wynagr * 100).toFixed(1)) : null; }
    var opts = makeChartOpts('% wynagrodzenia', function(c) {
      return c.parsed.y !== null ? c.dataset.label + ': ' + c.parsed.y.toFixed(1) + '%' : '';
    });
    opts.scales.y.ticks.callback = function(v) { return v + '%'; };
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allYears.map(String),
        datasets: [
          { label: 'Bazowy – ' + salaryMeta.chartLabel, data: allYears.map(function(y){ return pct(mapA[y]); }),
            borderColor: '#c8a96e', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false },
          { label: 'Nowy – ' + salaryMeta.chartLabel, data: allYears.map(function(y){ return pct(mapB[y]); }),
            borderColor: '#7eb8c9', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false }
        ]
      },
      options: opts
    });
    return;
  }

  if (currentTab === 'investment') {
    var inv = d.investment;
    if (!inv || d.investmentType === 'none') {
      myChart = new Chart(ctx, { type: 'line', data: { labels: [], datasets: [] }, options: makeChartOpts('PLN', function(){ return ''; }) });
      return;
    }
    // Agreguj portfel inwestycyjny rocznie
    var invYearMap = {};
    var savingsYearMap = {};
    for (var i = 0; i < d.rowsA.length; i++) {
      var rA = d.rowsA[i];
      var rB = i < d.rowsB.length ? d.rowsB[i] : null;
      var yr = rA.rok;
      if (!savingsYearMap[yr]) savingsYearMap[yr] = { nom: 0, real: 0 };
      var diffNom = rA.odsetki - (rB ? rB.odsetki : 0);
      var diffReal = rA.odsetki * rA.deflator - (rB ? rB.odsetki * rB.deflator : 0);
      savingsYearMap[yr].nom += diffNom;
      savingsYearMap[yr].real += diffReal;
    }
    // Roczne wartości portfela: bierz ostatni miesiąc każdego roku
    inv.monthly.forEach(function(row, idx) {
      var calMonth = ((d.startMonth - 1 + idx) % 12) + 1;
      var calYear = d.rokStart + Math.floor((d.startMonth - 1 + idx) / 12);
      invYearMap[calYear] = { nom: row.wartoscNom, real: row.wartoscReal };
    });
    var invYears = Object.keys(invYearMap).sort();
    var lastInvYear = invYears.length ? invYears[invYears.length - 1] : null;
    var cumSavNom = 0, cumSavReal = 0;
    var savNomArr = [], savRealArr = [];
    invYears.forEach(function(y) {
      if (savingsYearMap[y]) { cumSavNom += savingsYearMap[y].nom; cumSavReal += savingsYearMap[y].real; }
      savNomArr.push(Math.round(cumSavNom));
      savRealArr.push(Math.round(cumSavReal));
    });
    var INVESTMENT_LABELS = {wig30:'WIG30', wig:'WIG', sp500:'S&P 500 w PLN', lokata:'Lokata bankowa', gotowka:'Gotówka'};
    var invLabel = INVESTMENT_LABELS[d.investmentType] || d.investmentType;
    var opts = makeChartOpts('PLN', function(c) {
      var v = c.parsed.y;
      return v !== null ? c.dataset.label + ': ' + fmt(Math.round(v)) + ' PLN' : '';
    });
    opts.scales.y.ticks.callback = function(v) { return (v/1000) + 'k'; };
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: invYears.map(String),
        datasets: [
          { label: 'Portfel ' + invLabel + ' (nom.)', data: invYears.map(function(y){
              var val = (y === lastInvYear) ? inv.portfolioNetto : invYearMap[y].nom;
              return Math.round(val);
            }),
            borderColor: '#e07070', backgroundColor: 'rgba(224,112,112,0.08)',
            borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false },
          { label: 'Portfel ' + invLabel + ' (real.)', data: invYears.map(function(y){
              var val = (y === lastInvYear) ? inv.portfolioRealNetto : invYearMap[y].real;
              return Math.round(val);
            }),
            borderColor: '#e07070', backgroundColor: 'rgba(224,112,112,0.08)',
            borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.35, fill: false },
          { label: 'Oszczędn. odsetek (nom.)', data: savNomArr,
            borderColor: '#70c997', backgroundColor: 'rgba(112,201,151,0.08)',
            borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false },
          { label: 'Oszczędn. odsetek (real.)', data: savRealArr,
            borderColor: '#70c997', backgroundColor: 'rgba(112,201,151,0.08)',
            borderWidth: 1.5, borderDash: [4,3], pointRadius: 2, tension: 0.35, fill: false }
        ]
      },
      options: opts
    });
    return;
  }

  if (currentTab === 'saldo') {
    var allYears = Array.from(new Set(d.yearA.map(function(r){return r.rok;}).concat(d.yearB.map(function(r){return r.rok;})))).sort();
    var mapA = {}, mapB = {};
    d.yearA.forEach(function(r){ mapA[r.rok] = r; });
    d.yearB.forEach(function(r){ mapB[r.rok] = r; });
    var opts = makeChartOpts('PLN (saldo)', function(c) {
      var v = c.parsed.y;
      return v !== null ? c.dataset.label + ': ' + fmt(Math.round(v)) + ' PLN' : '';
    });
    opts.scales.y.ticks.callback = function(v) { return (v/1000) + 'k'; };
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allYears.map(String),
        datasets: [
          { label: 'Bazowy (saldo)', data: allYears.map(function(y){ return mapA[y] ? mapA[y].saldo : null; }),
            borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.08)',
            borderWidth: 2, pointRadius: 2, tension: 0.35, fill: true },
          { label: 'Nowy (saldo)', data: allYears.map(function(y){ return mapB[y] ? mapB[y].saldo : null; }),
            borderColor: '#7eb8c9', backgroundColor: 'rgba(126,184,201,0.08)',
            borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false }
        ]
      },
      options: opts
    });
    return;
  }

  // nominal / real
  var yearA = d.yearA, yearB = d.yearB;
  var allYears = Array.from(new Set(yearA.map(function(r){return r.rok;}).concat(yearB.map(function(r){return r.rok;})))).sort();
  var mapA = {}, mapB = {};
  yearA.forEach(function(r){ mapA[r.rok] = r; });
  yearB.forEach(function(r){ mapB[r.rok] = r; });
  var cumA = 0, cumB = 0;
  var cA = [], cB = [];
  allYears.forEach(function(y) {
    var rA = mapA[y], rB = mapB[y];
    if (rA) { cumA += currentTab === 'nominal' ? rA.sumRata : rA.sumRataReal; cA.push(Math.round(cumA)); } else cA.push(null);
    if (rB) { cumB += currentTab === 'nominal' ? rB.sumRata : rB.sumRataReal; cB.push(Math.round(cumB)); } else cB.push(null);
  });

  var yTitle = currentTab === 'nominal' ? 'PLN (nominalne)' : 'PLN (realne, z dnia startu)';
  var opts = makeChartOpts(yTitle, function(c) {
    var v = c.parsed.y;
    return v !== null ? c.dataset.label + ': ' + fmt(Math.round(v)) + ' PLN' : '';
  });
  opts.scales.y.ticks.callback = function(v) { return (v/1000) + 'k'; };
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allYears.map(String),
      datasets: [
        { label: 'Bazowy', data: cA,
          borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.08)',
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: true },
        { label: 'Nowy', data: cB,
          borderColor: '#7eb8c9', backgroundColor: 'rgba(126,184,201,0.08)',
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false }
      ]
    },
    options: opts
  });
}

// ==========================================
// RENDER TABELI
// ==========================================
function renderTable(tableId, rows, kwota, showEvents, investmentMonthly) {
  var t = document.getElementById(tableId);
  var salaryMeta = getSalaryMeta();
  var wynagrCache = {};
  var evCol = showEvents ? '<th>Zdarzenie</th>' : '';
  var invCols = investmentMonthly ? '<th title="Wartość portfela inwestycyjnego">Portfel inw.</th><th title="Miesięczna stopa zwrotu instrumentu">Stopa inw. %</th>' : '';
  var header = '<thead><tr>' +
    '<th>#</th><th>Data</th>' +
    '<th title="Fixing WIBOR">Fixing WIBOR</th>' +
    '<th>WIBOR</th><th>Stopa</th><th>Rata</th>' +
    '<th>Odsetki</th><th>Kapitał</th>' + evCol +
    '<th title="Rata realna (PLN z dnia startu)">Rata realna</th>' +
    '<th title="' + salaryMeta.tableTitle + '">' + salaryMeta.tableHeader + '</th>' +
    '<th title="' + salaryMeta.ratioTitle + '">' + salaryMeta.ratioHeader + '</th>' +
    '<th>Saldo</th>' + invCols +
    '</tr></thead>';

  var body = rows.map(function(r, idx) {
    if (!wynagrCache[r.rok]) wynagrCache[r.rok] = getWynagr(r.rok);
    var wynagr = wynagrCache[r.rok];
    var pctS = r.rata / wynagr * 100;
    var colS = pctS > 50 ? '#e07070' : pctS > 35 ? '#c8a96e' : '#70c997';

    var rowClass = '';
    if (r.event === 'nadplata') rowClass = 'row-overpay';
    else if (r.event === 'refinansowanie') rowClass = 'row-refinance';
    else if (r.event === 'splata') rowClass = 'row-payoff';
    else if (r.event === 'wydluzenie') rowClass = 'row-extend';
    else if (r.isFix) rowClass = '';

    var rowStyle = r.isFix && !r.event ? 'background:rgba(200,169,110,0.05);' : '';
    var fixIcon = r.isFix ? '<span title="Fixing WIBOR" style="color:var(--accent)">●</span>' : '';
    var evCell = '';
    if (showEvents) {
      if (r.nadplata > 0) evCell = '<td data-label="Zdarzenie" style="color:var(--success);font-weight:600">' + fmt(Math.round(r.nadplata)) + ' nadpł.</td>';
      else if (r.event === 'refinansowanie') evCell = '<td data-label="Zdarzenie" style="color:var(--accent2);font-size:10px">refinansowanie</td>';
      else if (r.event === 'splata') evCell = '<td data-label="Zdarzenie" style="color:var(--danger);font-size:10px">spłata</td>';
      else if (r.event === 'wydluzenie') evCell = '<td data-label="Zdarzenie" style="color:var(--accent);font-size:10px">wydłużenie</td>';
      else evCell = '<td data-label="Zdarzenie"></td>';
    }
    var invCells = '';
    if (investmentMonthly && investmentMonthly[idx]) {
      var im = investmentMonthly[idx];
      invCells = '<td data-label="Portfel inw." style="color:#e07070">' + fmt(Math.round(im.wartoscNom)) + '</td>' +
        '<td data-label="Stopa inw. %">' + im.stopaZwrotu.toFixed(2) + '%</td>';
    } else if (investmentMonthly) {
      invCells = '<td data-label="Portfel inw.">—</td><td data-label="Stopa inw. %">—</td>';
    }
    return '<tr class="' + rowClass + '" style="' + rowStyle + '">' +
      '<td data-label="#" style="color:var(--muted)">' + r.miesiac + '</td>' +
      '<td data-label="Data" style="white-space:nowrap">' + r.dataLabel + '</td>' +
      '<td data-label="Fixing WIBOR" style="text-align:center">' + fixIcon + '</td>' +
      '<td data-label="WIBOR">' + r.wibor.toFixed(2) + '%</td>' +
      '<td data-label="Stopa">' + r.stopa.toFixed(2) + '%</td>' +
      '<td data-label="Rata">' + fmt(Math.round(r.rata)) + '</td>' +
      '<td data-label="Odsetki">' + fmt(Math.round(r.odsetki)) + '</td>' +
      '<td data-label="Kapitał">' + fmt(Math.round(r.kapital)) + '</td>' + evCell +
      '<td data-label="Rata realna" style="color:var(--accent2)">' + fmt(Math.round(r.rataReal)) + '</td>' +
      '<td data-label="' + salaryMeta.tableHeader + '">' + fmt(wynagr) + '</td>' +
      '<td data-label="' + salaryMeta.ratioHeader + '" style="color:' + colS + ';font-weight:600">' + pctS.toFixed(1) + '%</td>' +
      '<td data-label="Saldo">' + fmt(Math.round(r.saldo)) + '</td>' + invCells +
      '</tr>';
  }).join('');

  t.innerHTML = header + '<tbody>' + body + '</tbody>';
}

// ==========================================
// BINDING INPUTOW
// ==========================================
function bindInputs() {
  var decimalInputs = {
    marza: true,
    prowizja: true,
    future_wibor: true,
    future_cpi: true,
    future_salary: true,
    future_stock_return: true,
    future_deposit_rate: true,
    future_usdpln: true
  };
  function bindPair(inp, ran, disp, fmtFn, allowsDecimal) {
    function syncFromInput() {
      if (allowsDecimal) {
        var normalized = normalizeNumericString(inp.value);
        if (normalized !== inp.value) {
          try {
            var cursor = inp.selectionStart;
            inp.value = normalized;
            inp.selectionStart = inp.selectionEnd = cursor;
          } catch(e) {
            inp.value = normalized;
          }
        }
      }
      if (isTransientNumericInput(inp.value)) return;
      var parsed = parseLocaleFloat(inp.value);
      if (!Number.isFinite(parsed)) return;
      ran.value = String(parsed);
      disp.innerHTML = fmtFn(ran.value);
      calculate();
    }
    function syncFromRange() {
      inp.value = ran.value;
      disp.innerHTML = fmtFn(ran.value);
      calculate();
    }
    function commitInput() {
      var committed = normalizeNumericString(inp.value).trim();
      if (committed.endsWith('.')) committed = committed.slice(0, -1);
      var parsed = parseLocaleFloat(committed);
      if (!Number.isFinite(parsed)) {
        inp.value = ran.value;
      } else {
        inp.value = String(parsed);
        ran.value = String(parsed);
      }
      disp.innerHTML = fmtFn(String(parseLocaleFloat(inp.value)));
      calculate();
    }
    inp.addEventListener('input', syncFromInput);
    inp.addEventListener('change', commitInput);
    ran.addEventListener('input', syncFromRange);
  }
  var pairs = [
    ['kwota',    'kwota_r',    'kwota_rv',    function(v){ return fmt(parseLocaleFloat(v)) + ' PLN'; }],
    ['rok_start','rok_r',      'rok_rv',      function(v){ return v; }],
    ['marza',    'marza_r',    'marza_rv',    function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['prowizja', 'prowizja_r', 'prowizja_rv', function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['okres',    'okres_r',    'okres_rv',    function(v){ var n = parseInt(v); return n + ' miesięcy = ' + fmtOkres(n); }]
  ];
  pairs.forEach(function(pair) {
    var inputId = pair[0], rangId = pair[1], dispId = pair[2], fmtFn = pair[3];
    var inp  = document.getElementById(inputId);
    var ran  = document.getElementById(rangId);
    var disp = document.getElementById(dispId);
    bindPair(inp, ran, disp, fmtFn, !!decimalInputs[inputId]);
  });
  document.getElementById('miesiac_start').addEventListener('change', function(){ calculate(); });
  document.getElementById('salary_source').addEventListener('change', function(){ calculate(); });

  // Projekcje przyszłe — input+range pairs
  var projPairs = [
    ['future_wibor',        'future_wibor_r',        'future_wibor_rv',        function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['future_cpi',          'future_cpi_r',          'future_cpi_rv',          function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['future_salary',       'future_salary_r',       'future_salary_rv',       function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['future_stock_return', 'future_stock_return_r', 'future_stock_return_rv', function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['future_deposit_rate', 'future_deposit_rate_r', 'future_deposit_rate_rv', function(v){ return parseLocaleFloat(v).toFixed(1) + '%'; }],
    ['future_usdpln',       'future_usdpln_r',       'future_usdpln_rv',       function(v){ return parseLocaleFloat(v).toFixed(2); }]
  ];
  projPairs.forEach(function(pair) {
    var inp = document.getElementById(pair[0]);
    var ran = document.getElementById(pair[1]);
    var disp = document.getElementById(pair[2]);
    if (!inp || !ran || !disp) return;
    bindPair(inp, ran, disp, pair[3], !!decimalInputs[pair[0]]);
  });

  // Wybór instrumentu inwestycyjnego
  var invSel = document.getElementById('investment_type');
  if (invSel) invSel.addEventListener('change', function(){ calculate(); });
}

// ==========================================
// INIT
// ==========================================
syncHistoricalRanges();
bindInputs();
syncFutureProjectionsToggleUI();
initTheme();
calculate();
