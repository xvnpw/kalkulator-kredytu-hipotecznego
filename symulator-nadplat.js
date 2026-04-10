// ==========================================
// STALE I DANE POMOCNICZE
// ==========================================

const DEFAULT_FUTURE_WIBOR = 4.5;
const DEFAULT_FUTURE_CPI   = 3.5;
const DEFAULT_FUTURE_CPI_MONTHLY = (Math.pow(1 + DEFAULT_FUTURE_CPI / 100, 1 / 12) - 1) * 100;
const EPSILON = 1e-12;

const WYNAGRODZENIA_SEKTOR_HIST = {
  2000: 1893, 2001: 2061, 2002: 2133, 2003: 2201, 2004: 2289,
  2005: 2380, 2006: 2477, 2007: 2691, 2008: 3024, 2009: 3103,
  2010: 3225, 2011: 3474, 2012: 3522, 2013: 3650, 2014: 3783,
  2015: 3899, 2016: 4048, 2017: 4277, 2018: 4585, 2019: 5169
};
const WYNAGRODZENIA_SEKTOR_PRYWATNY = {
  ...WYNAGRODZENIA_SEKTOR_HIST,
  ...WYNAGRODZENIA_PRYWATNY_2020
};

const SALARY_SOURCE_CONFIG = {
  private: {
    chartLabel: 'sektor prywatny',
    tableHeader: 'Wynagrodzenie sektora',
    tableTitle: 'Przeciętne miesięczne wynagrodzenie brutto - sektor prywatny (GUS)',
    ratioHeader: 'Rata / wynagrodzenie',
    ratioTitle: 'Rata jako % wynagrodzenia sektora prywatnego',
    data: WYNAGRODZENIA_SEKTOR_PRYWATNY
  },
  average: {
    chartLabel: 'przeciętne',
    tableHeader: 'Wynagrodzenie przeciętne',
    tableTitle: 'Przeciętne miesięczne wynagrodzenie brutto - ogółem (GUS)',
    ratioHeader: 'Rata / wynagrodzenie',
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
  return SALARY_SOURCE_CONFIG[salarySource] || SALARY_SOURCE_CONFIG.private;
}
function getWynagr(year) {
  var meta = getSalaryMeta();
  var data = meta.data;
  if (data[year] !== undefined) return data[year];
  var firstYear = meta.years[0];
  var lastYear = meta.years[meta.years.length - 1];
  if (year < firstYear) return data[firstYear];
  return Math.round(data[lastYear] * Math.pow(1.07, year - lastYear));
}

// ==========================================
// ROCZNE SREDNIE WIBOR (do wykresu)
// ==========================================
var WIBOR6M_ANNUAL = {};
var WIBOR3M_ANNUAL = {};
for (var y = 1995; y <= 2026; y++) {
  var v6 = [], v3 = [];
  for (var m = 1; m <= 12; m++) {
    var k = y + '-' + String(m).padStart(2, '0');
    if (WIBOR6M_MONTHLY[k] !== undefined) v6.push(WIBOR6M_MONTHLY[k]);
    if (WIBOR3M_MONTHLY[k] !== undefined) v3.push(WIBOR3M_MONTHLY[k]);
  }
  if (v6.length) WIBOR6M_ANNUAL[y] = +(v6.reduce(function(a,b){return a+b;}) / v6.length).toFixed(2);
  if (v3.length) WIBOR3M_ANNUAL[y] = +(v3.reduce(function(a,b){return a+b;}) / v3.length).toFixed(2);
}

var HIST_MIN_YEAR = 2000;
var LAST_HIST_WIBOR_YEAR = 2026;
var LAST_HIST_CPI_ANNUAL = Math.max.apply(null, Object.keys(CPI_ANNUAL).map(Number));
var LAST_HIST_CPI_MONTHLY = 2026;

// ==========================================
// FUNKCJE DANYCH
// ==========================================
function getWibor(year, month, mode) {
  var key = year + '-' + String(month).padStart(2, '0');
  var val = mode === '3M' ? WIBOR3M_MONTHLY[key] : WIBOR6M_MONTHLY[key];
  return val !== undefined ? val : DEFAULT_FUTURE_WIBOR;
}
function getCpiAnnual(year) {
  return CPI_ANNUAL[year] !== undefined ? CPI_ANNUAL[year] : DEFAULT_FUTURE_CPI;
}
function getCpiMonthly(year, month) {
  var key = year + '-' + String(month).padStart(2, '0');
  return CPI_MONTHLY[key] !== undefined ? CPI_MONTHLY[key] : DEFAULT_FUTURE_CPI_MONTHLY;
}
function annualizeMonthlyCpi(cpiMonthlyPct) {
  return (Math.pow(1 + cpiMonthlyPct / 100, 12) - 1) * 100;
}
function getMonthlyDeflatorFactor(year, month, mode) {
  if (mode === 'monthly') return 1 / (1 + getCpiMonthly(year, month) / 100);
  return 1 / Math.pow(1 + getCpiAnnual(year) / 100, 1 / 12);
}
function getCpiComparableAnnual(year, month, mode) {
  if (mode === 'monthly') return annualizeMonthlyCpi(getCpiMonthly(year, month));
  return getCpiAnnual(year);
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
function calcHarmonogram(kwota, rokStart, startMonth, nMonths, marza, wiborMode, cpiModeArg, rateType) {
  var fixInterval = wiborMode === '3M' ? 3 : 6;
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

    var monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth + 1, cpiModeArg);
    cumulativeDeflator *= monthlyDeflatorFactor;
  }
  return rows;
}

// Harmonogram z wydarzeniami
function calcHarmonogramWithEvents(kwota, rokStart, startMonth, nMonths, marza, wiborMode, cpiModeArg, rateType, events, prowizjaPct) {
  var fixInterval = wiborMode === '3M' ? 3 : 6;
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
      var order = { refinansowanie: 0, nadplata: 1, cykliczna: 1, splata: 2 };
      return (order[a.type] || 1) - (order[b.type] || 1);
    });

    for (var ei = 0; ei < monthEvents.length; ei++) {
      var ev = monthEvents[ei];
      if (saldo <= 0) break;

      if (ev.type === 'refinansowanie') {
        currentMarza = ev.nowaMarza;
        if (ev.nowyWibor !== 'bez_zmian') {
          currentWiborMode = ev.nowyWibor;
          fixInterval = currentWiborMode === '3M' ? 3 : 6;
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

    var monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth + 1, cpiModeArg);
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
    sumCpi += getCpiComparableAnnual(r.rok, r.calMonth + 1, cpiMode);
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
var wiborMode = '6M';
var cpiMode = 'annual';
var salarySource = 'private';
var rateType = 'rowna';
var methodologyOpen = false;
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
  calculate();
}
function setCpiMode(mode) {
  cpiMode = mode;
  document.getElementById('btn_cpi_annual').classList.toggle('active', mode === 'annual');
  document.getElementById('btn_cpi_monthly').classList.toggle('active', mode === 'monthly');
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
  var tabs = ['nominal', 'real', 'saldo', 'wibor', 'affordability'];
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
  var rokStart = parseInt(document.getElementById('rok_start').value) || 2021;
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
    nowyWibor: 'bez_zmian'
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
  if (field === 'type') {
    ev.type = value;
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
        'onchange="updateEvent(' + ev.id + ',\'year\',parseInt(this.value)||2021)"></div></div>';

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
        'onchange="updateEvent(' + ev.id + ',\'year\',parseInt(this.value)||2021)"></div></div>';
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
// GLOWNA KALKULACJA
// ==========================================
function calculate() {
  var kwota      = parseFloat(document.getElementById('kwota').value) || 350000;
  var rokStart   = parseInt(document.getElementById('rok_start').value) || 2021;
  var startMonth = parseInt(document.getElementById('miesiac_start').value) || 5;
  salarySource   = document.getElementById('salary_source').value || 'private';
  var marza      = parseFloat(document.getElementById('marza').value) || 1.85;
  var prowizjaPct = parseFloat(document.getElementById('prowizja').value) || 0;
  var nMonths    = parseInt(document.getElementById('okres').value) || 300;
  var fixInterval = wiborMode === '3M' ? 3 : 6;

  var wiborStart = getWibor(rokStart, startMonth, wiborMode);
  var cpiStartRaw = cpiMode === 'monthly' ? getCpiMonthly(rokStart, startMonth) : getCpiAnnual(rokStart);
  var cpiStartComparable = cpiMode === 'monthly' ? annualizeMonthlyCpi(cpiStartRaw) : cpiStartRaw;
  var stopaStart = wiborStart + marza;
  var realStopa  = stopaStart - cpiStartComparable;

  // Aktualizuj etykiety
  document.getElementById('wibor_label').textContent = 'WIBOR ' + wiborMode + ' (miesiąc startu)';
  var cpiLabelEl = document.getElementById('cpi_label');
  cpiLabelEl.textContent = cpiMode === 'monthly' ? 'Inflacja CPI (miesiąc do miesiąca, miesiąc startu)' : 'Inflacja CPI (roczna, rok startu)';
  document.getElementById('wibor_display').textContent = fmtPct(wiborStart);
  document.getElementById('marza_display').textContent = fmtPct(marza);
  document.getElementById('total_rate_display').textContent = fmtPct(stopaStart);
  document.getElementById('inf_display').textContent = cpiMode === 'monthly'
    ? fmtPct(cpiStartRaw) + ' (≈' + fmtPct(cpiStartComparable) + ' rok do roku)'
    : fmtPct(cpiStartRaw);
  document.getElementById('real_rate_display').textContent = fmtPct(realStopa);

  var tagWiborEl = document.getElementById('tag_wibor');
  tagWiborEl.textContent = 'WIBOR ' + wiborMode + ' · dane historyczne (notowania miesięczne)';
  var tagCpiEl = document.getElementById('tag_cpi');
  tagCpiEl.textContent = cpiMode === 'monthly' ? 'Inflacja CPI · GUS Polska (miesięczna, miesiąc do miesiąca)' : 'Inflacja CPI · GUS Polska (roczna)';

  // Harmonogram bazowy (A)
  var rowsA = calcHarmonogram(kwota, rokStart, startMonth, nMonths, marza, wiborMode, cpiMode, rateType);
  var prowizjaA = kwota * prowizjaPct / 100;

  // Harmonogram z wydarzeniami (B)
  var expandedEvents = expandEvents(events, rokStart, startMonth, nMonths);
  var resultB = calcHarmonogramWithEvents(kwota, rokStart, startMonth, nMonths, marza, wiborMode, cpiMode, rateType, expandedEvents, prowizjaPct);
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
    verdictEl.innerHTML = 'Dodaj zdarzenia (nadpłaty, refinansowanie) aby zobaczyć porównanie z harmonogramem bazowym.';
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
      txt += 'Uwaga: po uwzględnieniu inflacji (PLN z ' + dataWyceny + ') wariant z nadpłatami kosztuje realnie <strong>' + fmtPLN(Math.abs(savedRealTotal)) + '</strong> więcej — inflacja "zjadła" oszczędności.';
    }
    if (resultB.totalProwizjeNom > prowizjaA) {
      txt += ' Łączne prowizje w wariancie z nadpłatami: <strong>' + fmtPLN(resultB.totalProwizjeNom) + '</strong>.';
    }
    verdictEl.innerHTML = txt || 'Brak istotnych różnic między wariantami.';
  }

  // Nota metodologiczna
  var lastHistCPI = cpiMode === 'monthly' ? LAST_HIST_CPI_MONTHLY : LAST_HIST_CPI_ANNUAL;
  document.getElementById('note_extra').innerHTML =
    '<strong>Metodologia:</strong> ' +
    'Fixing WIBOR ' + wiborMode + ' co ' + fixInterval + ' miesięcy od startu. ' +
    'Rodzaj rat: ' + (rateType === 'malejaca' ? 'malejące' : 'równe (annuitet)') + '. ' +
    'Dane historyczne: WIBOR do ' + LAST_HIST_WIBOR_YEAR + ', CPI do ' + lastHistCPI +
    '. Projekcja: WIBOR ' + DEFAULT_FUTURE_WIBOR + '%, inflacja ' + DEFAULT_FUTURE_CPI + '%.';

  currentData = {
    rowsA: rowsA, rowsB: rowsB, yearA: yearA, yearB: yearB,
    kwota: kwota, rokStart: rokStart, startMonth: startMonth, nMonths: nMonths,
    marza: marza, resultB: resultB, prowizjaA: prowizjaA
  };
  renderChart();
  renderTable('tableA', rowsA, kwota, false);
  renderTable('tableB', rowsB, kwota, true);
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
          { label: 'Inflacja CPI (%)', data: years.map(function(y){ return CPI_ANNUAL[y] !== undefined ? CPI_ANNUAL[y] : null; }),
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
          { label: 'Bez nadpłat – ' + salaryMeta.chartLabel, data: allYears.map(function(y){ return pct(mapA[y]); }),
            borderColor: '#c8a96e', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false },
          { label: 'Z nadpłatami – ' + salaryMeta.chartLabel, data: allYears.map(function(y){ return pct(mapB[y]); }),
            borderColor: '#7eb8c9', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false }
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
          { label: 'Bez nadpłat (saldo)', data: allYears.map(function(y){ return mapA[y] ? mapA[y].saldo : null; }),
            borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.08)',
            borderWidth: 2, pointRadius: 2, tension: 0.35, fill: true },
          { label: 'Z nadpłatami (saldo)', data: allYears.map(function(y){ return mapB[y] ? mapB[y].saldo : null; }),
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
        { label: 'Bez nadpłat', data: cA,
          borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.08)',
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: true },
        { label: 'Z nadpłatami', data: cB,
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
function renderTable(tableId, rows, kwota, showEvents) {
  var t = document.getElementById(tableId);
  var salaryMeta = getSalaryMeta();
  var wynagrCache = {};
  var evCol = showEvents ? '<th>Nadpłata</th>' : '';
  var header = '<thead><tr>' +
    '<th>#</th><th>Data</th>' +
    '<th title="Fixing WIBOR">Fixing WIBOR</th>' +
    '<th>WIBOR</th><th>Stopa</th><th>Rata</th>' +
    '<th>Odsetki</th><th>Kapitał</th>' + evCol +
    '<th title="Rata realna (PLN z dnia startu)">Rata realna</th>' +
    '<th title="' + salaryMeta.tableTitle + '">' + salaryMeta.tableHeader + '</th>' +
    '<th title="' + salaryMeta.ratioTitle + '">' + salaryMeta.ratioHeader + '</th>' +
    '<th>Saldo</th>' +
    '</tr></thead>';

  var body = rows.map(function(r) {
    if (!wynagrCache[r.rok]) wynagrCache[r.rok] = getWynagr(r.rok);
    var wynagr = wynagrCache[r.rok];
    var pctS = r.rata / wynagr * 100;
    var colS = pctS > 50 ? '#e07070' : pctS > 35 ? '#c8a96e' : '#70c997';

    var rowClass = '';
    if (r.event === 'nadplata') rowClass = 'row-overpay';
    else if (r.event === 'refinansowanie') rowClass = 'row-refinance';
    else if (r.event === 'splata') rowClass = 'row-payoff';
    else if (r.isFix) rowClass = '';

    var rowStyle = r.isFix && !r.event ? 'background:rgba(200,169,110,0.05);' : '';
    var fixIcon = r.isFix ? '<span title="Fixing WIBOR" style="color:var(--accent)">●</span>' : '';
    var evCell = '';
    if (showEvents) {
      if (r.nadplata > 0) evCell = '<td data-label="Nadpłata" style="color:var(--success);font-weight:600">' + fmt(Math.round(r.nadplata)) + '</td>';
      else if (r.event === 'refinansowanie') evCell = '<td data-label="Nadpłata" style="color:var(--accent2);font-size:10px">refinansowanie</td>';
      else if (r.event === 'splata') evCell = '<td data-label="Nadpłata" style="color:var(--danger);font-size:10px">spłata</td>';
      else evCell = '<td data-label="Nadpłata"></td>';
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
      '<td data-label="Saldo">' + fmt(Math.round(r.saldo)) + '</td>' +
      '</tr>';
  }).join('');

  t.innerHTML = header + '<tbody>' + body + '</tbody>';
}

// ==========================================
// BINDING INPUTOW
// ==========================================
function bindInputs() {
  var pairs = [
    ['kwota',    'kwota_r',    'kwota_rv',    function(v){ return fmt(parseFloat(v)) + ' PLN'; }],
    ['rok_start','rok_r',      'rok_rv',      function(v){ return v; }],
    ['marza',    'marza_r',    'marza_rv',    function(v){ return parseFloat(v).toFixed(1) + '%'; }],
    ['prowizja', 'prowizja_r', 'prowizja_rv', function(v){ return parseFloat(v).toFixed(1) + '%'; }],
    ['okres',    'okres_r',    'okres_rv',    function(v){ var n = parseInt(v); return n + ' miesięcy = ' + fmtOkres(n); }]
  ];
  pairs.forEach(function(pair) {
    var inputId = pair[0], rangId = pair[1], dispId = pair[2], fmtFn = pair[3];
    var inp  = document.getElementById(inputId);
    var ran  = document.getElementById(rangId);
    var disp = document.getElementById(dispId);
    function sync(src) { ran.value = inp.value = src.value; disp.innerHTML = fmtFn(src.value); calculate(); }
    inp.addEventListener('input', function(){ sync(inp); });
    ran.addEventListener('input', function(){ sync(ran); });
  });
  document.getElementById('miesiac_start').addEventListener('change', function(){ calculate(); });
  document.getElementById('salary_source').addEventListener('change', function(){ calculate(); });
}

// ==========================================
// INIT
// ==========================================
syncHistoricalRanges();
bindInputs();
initTheme();
calculate();
