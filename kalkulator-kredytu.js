// ==========================================
// STALE I DANE POMOCNICZE
// ==========================================

const DEFAULT_FUTURE_WIBOR = 4.5;
const DEFAULT_FUTURE_CPI   = 3.5;
const DEFAULT_FUTURE_CPI_MONTHLY = (Math.pow(1 + DEFAULT_FUTURE_CPI / 100, 1 / 12) - 1) * 100;
const EPSILON = 1e-12;

const SALARY_SOURCE_CONFIG = {
  average: {
    chartLabel: 'przeciętne',
    tableHeader: 'Wynagrodzenie przeciętne',
    tableTitle: 'Przeciętne miesięczne wynagrodzenie brutto - ogółem (GUS)',
    ratioHeader: 'Rata / wynagrodzenie przeciętne',
    ratioTitle: 'Rata jako % przeciętnego wynagrodzenia',
    data: WYNAGRODZENIA_PRZECIETNE
  },
  minimum: {
    chartLabel: 'minimalne',
    tableHeader: 'Wynagrodzenie minimalne',
    tableTitle: 'Minimalne wynagrodzenie za pracę',
    ratioHeader: 'Rata / wynagrodzenie minimalne',
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
  const meta = getSalaryMeta();
  const data = meta.data;
  if (data[year] !== undefined) return data[year];
  const firstYear = meta.years[0];
  const lastYear = meta.years[meta.years.length - 1];
  if (year < firstYear) return data[firstYear];
  return Math.round(data[lastYear] * Math.pow(1.07, year - lastYear));
}

// ==========================================
// ROCZNE SREDNIE WIBOR (do wykresu historycznego)
// ==========================================
const WIBOR6M_ANNUAL = {};
const WIBOR3M_ANNUAL = {};
for (let y = 1995; y <= 2026; y++) {
  const v6 = [], v3 = [];
  for (let m = 1; m <= 12; m++) {
    const k = y + '-' + String(m).padStart(2, '0');
    if (WIBOR6M_MONTHLY[k] !== undefined) v6.push(WIBOR6M_MONTHLY[k]);
    if (WIBOR3M_MONTHLY[k] !== undefined) v3.push(WIBOR3M_MONTHLY[k]);
  }
  if (v6.length) WIBOR6M_ANNUAL[y] = +(v6.reduce((a,b)=>a+b)/v6.length).toFixed(2);
  if (v3.length) WIBOR3M_ANNUAL[y] = +(v3.reduce((a,b)=>a+b)/v3.length).toFixed(2);
}

const HIST_MIN_YEAR = 2000;
const LAST_HIST_WIBOR_YEAR = 2026;
const LAST_HIST_CPI_ANNUAL = Math.max(...Object.keys(CPI_ANNUAL).map(Number));
const LAST_HIST_CPI_MONTHLY = 2026;

// ==========================================
// FUNKCJE DANYCH
// ==========================================

function getWibor(year, month, mode) {
  const key = year + '-' + String(month).padStart(2, '0');
  const val = mode === '3M' ? WIBOR3M_MONTHLY[key] : WIBOR6M_MONTHLY[key];
  return val !== undefined ? val : DEFAULT_FUTURE_WIBOR;
}

function getCpiAnnual(year) {
  return CPI_ANNUAL[year] !== undefined ? CPI_ANNUAL[year] : DEFAULT_FUTURE_CPI;
}

function getCpiMonthly(year, month) {
  const key = year + '-' + String(month).padStart(2, '0');
  return CPI_MONTHLY[key] !== undefined ? CPI_MONTHLY[key] : DEFAULT_FUTURE_CPI_MONTHLY;
}

function annualizeMonthlyCpi(cpiMonthlyPct) {
  return (Math.pow(1 + cpiMonthlyPct / 100, 12) - 1) * 100;
}

function getMonthlyDeflatorFactor(year, month, cpiMode) {
  if (cpiMode === 'monthly') {
    return 1 / (1 + getCpiMonthly(year, month) / 100);
  }
  return 1 / Math.pow(1 + getCpiAnnual(year) / 100, 1 / 12);
}

function getCpiComparableAnnual(year, month, cpiMode) {
  if (cpiMode === 'monthly') {
    return annualizeMonthlyCpi(getCpiMonthly(year, month));
  }
  return getCpiAnnual(year);
}

// ==========================================
// OBLICZENIA KREDYTU
// ==========================================

function calcMonthlyRate(wibor_pct, marza_pct) {
  return (wibor_pct + marza_pct) / 100 / 12;
}

function calcRata(kwota, rMonthly, nMonths) {
  if (Math.abs(rMonthly) < EPSILON) return kwota / nMonths;
  return kwota * rMonthly * Math.pow(1 + rMonthly, nMonths) /
         (Math.pow(1 + rMonthly, nMonths) - 1);
}

// Srednie WIBOR i CPI dla okresu kredytowania (do analizy czynnikow)
function calcAvgStats(rows) {
  var sumWibor = 0, sumCpi = 0;
  rows.forEach(function(r) {
    sumWibor += r.wibor;
    sumCpi += getCpiComparableAnnual(r.rok, r.calMonth + 1, cpiMode);
  });
  var n = rows.length;
  return { avgWibor: sumWibor / n, avgCpi: sumCpi / n, avgSpread: (sumWibor - sumCpi) / n };
}

// Pelny harmonogram - fixing WIBOR co N miesiecy od dnia startu kredytu.
// Brak stalych dat fixingowych (np. maj/listopad) - termin wynika wylacznie
// z miesiaca startowego i interwalu (3M lub 6M).
function calcHarmonogram(kwota, rokStart, startMonth, latKredytu, marza, wiborMode, cpiMode, rateTypeArg) {
  const nMonths = latKredytu * 12;
  const fixInterval = wiborMode === '3M' ? 3 : 6;
  const MIESIAC_NAZWY = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  const selectedRateType = rateTypeArg || 'rowna';

  let saldo = kwota;
  let rows = [];
  let cumulativeDeflator = 1.0;
  let currentRata = 0, currentWibor = 0, currentStopa = 0;
  let czescKapitalowa = 0;

  for (let m = 0; m < nMonths; m++) {
    const calMonthAbs = (startMonth - 1) + m;
    const calYear  = rokStart + Math.floor(calMonthAbs / 12);
    const calMonth = calMonthAbs % 12;
    const remaining = nMonths - m;

    const isFix = (m % fixInterval === 0);
    if (isFix) {
      currentWibor = getWibor(calYear, calMonth + 1, wiborMode);
      currentStopa = currentWibor + marza;
      const rFix = calcMonthlyRate(currentWibor, marza);
      if (selectedRateType === 'malejaca') {
        czescKapitalowa = saldo / remaining;
      } else {
        currentRata = calcRata(saldo, rFix, remaining);
      }
    }

    const rMonthly = calcMonthlyRate(currentWibor, marza);
    const odsetki = saldo * rMonthly;
    let kapital, rata;
    if (selectedRateType === 'malejaca') {
      kapital = Math.min(czescKapitalowa, saldo);
      rata = kapital + odsetki;
    } else {
      rata = currentRata;
      kapital = Math.min(rata - odsetki, saldo);
    }
    saldo = Math.max(0, saldo - kapital);

    const rataReal = rata * cumulativeDeflator;

    rows.push({
      rok: calYear, calMonth,
      miesiacNazwa: MIESIAC_NAZWY[calMonth],
      dataLabel: MIESIAC_NAZWY[calMonth] + ' ' + calYear,
      miesiac: m + 1, isFix,
      wibor: currentWibor, stopa: currentStopa,
      rata, odsetki, kapital, saldo,
      deflator: cumulativeDeflator, rataReal
    });

    const monthlyDeflatorFactor = getMonthlyDeflatorFactor(calYear, calMonth + 1, cpiMode);
    cumulativeDeflator *= monthlyDeflatorFactor;
  }
  return rows;
}

function aggregateYearly(rows) {
  const byYear = {};
  rows.forEach(r => {
    if (!byYear[r.rok]) byYear[r.rok] = {
      rok: r.rok, sumRata: 0, sumOdsetki: 0, sumKapital: 0,
      sumRataReal: 0, saldo: 0, months: 0, sumWibor: 0, sumStopa: 0,
      wynagr: getWynagr(r.rok)
    };
    const y = byYear[r.rok];
    y.sumRata += r.rata; y.sumOdsetki += r.odsetki; y.sumKapital += r.kapital;
    y.sumRataReal += r.rataReal; y.saldo = r.saldo; y.months++;
    y.sumWibor += r.wibor; y.sumStopa += r.stopa;
  });
  Object.values(byYear).forEach(y => {
    y.wibor = +(y.sumWibor / y.months).toFixed(2);
    y.stopa = +(y.sumStopa / y.months).toFixed(2);
  });
  return Object.values(byYear);
}

// ==========================================
// STAN TRYBU I PRZELACZNIKI
// ==========================================
let myChart = null;
let currentTab = 'nominal';
let currentData = {};
let wiborMode = '3M';
let cpiMode = 'annual';
let salarySource = 'average';
let rateType = 'rowna';
let methodologyOpen = false;
let themeMode = 'dark';

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function applyTheme(mode) {
  themeMode = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', themeMode);
  const btn = document.getElementById('theme_toggle_btn');
  if (btn) {
    const isLight = themeMode === 'light';
    btn.textContent = isLight ? 'Motyw: jasny' : 'Motyw: ciemny';
    btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    btn.setAttribute('aria-label', isLight ? 'Przełącz na ciemny motyw' : 'Przełącz na jasny motyw');
  }
  localStorage.setItem('theme_mode', themeMode);
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme_mode');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    applyTheme(savedTheme);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  const tabs = ['nominal', 'real', 'wibor', 'affordability'];
  document.querySelectorAll('#chart-tab-row .tab-btn').forEach((b, i) => {
    b.classList.toggle('active', tabs[i] === tab);
  });
  renderChart();
}

function switchTableTab(id) {
  ['tA','tB'].forEach(t => {
    document.getElementById(t).classList.toggle('active', t === id);
  });
  ['tbtn_A','tbtn_B'].forEach(b => {
    document.getElementById(b).classList.toggle('active', b === (id === 'tA' ? 'tbtn_A' : 'tbtn_B'));
  });
}

function toggleMethodology() {
  methodologyOpen = !methodologyOpen;
  syncMethodologyToggleUI();
}

function syncMethodologyToggleUI() {
  const body = document.getElementById('metodyka_body');
  const btn = document.getElementById('metodyka_toggle_btn');
  if (!body || !btn) return;
  body.hidden = !methodologyOpen;
  btn.setAttribute('aria-expanded', methodologyOpen ? 'true' : 'false');
  btn.textContent = methodologyOpen ? 'Ukryj metodykę i wzory' : 'Pokaż metodykę i wzory';
}

function setMethodValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateMethodologyPanel(data) {
  const rowA0 = data.rowsA[0];
  const rowA1 = data.rowsA[1] || data.rowsA[0];
  const rowB0 = data.rowsB[0];

  const nA = data.latA * 12;
  const nB = data.latB * 12;
  const rMonthly = calcMonthlyRate(rowA0.wibor, data.marza);
  const powN = Math.pow(1 + rMonthly, nA);

  const odsetki1 = data.kwota * rMonthly;
  const kapital1 = rowA0.rata - odsetki1;
  const saldoPo1 = data.kwota - kapital1;

  const deflator1 = getMonthlyDeflatorFactor(data.rokStart, data.startMonth, data.cpiMode);
  const cpiLabel = data.cpiMode === 'monthly'
    ? 'CPI miesięczna (miesiąc startu, miesiąc do miesiąca)'
    : 'CPI roczne (rok startu)';
  const cpiValue = data.cpiMode === 'monthly'
    ? fmtPct(data.cpiStartRaw) + ' (≈ ' + fmtPct(data.cpiStartComparable) + ' rok do roku)'
    : fmtPct(data.cpiStartRaw);
  const cpiModeLabel = data.cpiMode === 'monthly'
    ? 'Miesięczny (miesiąc do miesiąca)'
    : 'Roczny';
  const deflatorFormula = data.cpiMode === 'monthly'
    ? 'deflator miesięczny = 1 / (1 + CPI miesięczne miesiąc do miesiąca)'
    : 'deflator miesięczny = 1 / (1 + CPI roczne)^(1/12)';
  const rateTypeLabel = data.rateType === 'malejaca'
    ? 'Rata malejąca'
    : 'Rata równa (annuitet)';

  setMethodValue('exp_rate_type', rateTypeLabel);
  setMethodValue('exp_wibor', fmtPct(data.wiborStart));
  setMethodValue('exp_marza', fmtPct(data.marza));
  setMethodValue('exp_stopa_nom', fmtPct(rowA0.stopa));
  setMethodValue('exp_kwota', fmtPLN(data.kwota));
  setMethodValue('exp_r_monthly', fmt(rMonthly * 100, 4) + '%');
  setMethodValue('exp_n_a', String(nA));
  setMethodValue('exp_n_b', String(nB));
  setMethodValue('exp_pow_n', fmt(powN, 4));
  setMethodValue('exp_rata_a1', fmtPLN(rowA0.rata));
  setMethodValue('exp_rata_b1', fmtPLN(rowB0.rata));
  setMethodValue('exp_odsetki_1', fmtPLN(odsetki1));
  setMethodValue('exp_kapital_1', fmtPLN(kapital1));
  setMethodValue('exp_saldo_po_1', fmtPLN(saldoPo1));
  setMethodValue('exp_cpi_mode', cpiModeLabel);
  setMethodValue('exp_cpi_label', cpiLabel);
  setMethodValue('exp_cpi_value', cpiValue);
  setMethodValue('exp_deflator_formula', deflatorFormula);
  setMethodValue('exp_deflator_1', fmt(deflator1, 6));
  setMethodValue('exp_rata_nom_2', fmtPLN(rowA1.rata));
  setMethodValue('exp_rata_real_2', fmtPLN(rowA1.rataReal));
  setMethodValue('exp_prowizja_pct', fmt(data.prowizjaPct, 1) + '%');
  setMethodValue('exp_prowizja_nom_a', fmtPLN(data.prowizjaA));
  setMethodValue('exp_prowizja_nom_b', fmtPLN(data.prowizjaB));
  setMethodValue('exp_prowizja_real_a', fmtPLN(data.prowizjaA));
  setMethodValue('exp_prowizja_real_b', fmtPLN(data.prowizjaB));
  setMethodValue('exp_total_real_a', fmtPLN(data.ratyRealA));
  setMethodValue('exp_total_real_b', fmtPLN(data.ratyRealB));
  setMethodValue('exp_total_real_with_fee_a', fmtPLN(data.totRealWithProwizjaA));
  setMethodValue('exp_total_real_with_fee_b', fmtPLN(data.totRealWithProwizjaB));
  setMethodValue('exp_odsetki_real_a', fmtPLN(data.odsetRealA));
  setMethodValue('exp_odsetki_real_b', fmtPLN(data.odsetRealB));
}

function syncHistoricalRanges() {
  const rokInput = document.getElementById('rok_start');
  const rokRange = document.getElementById('rok_r');
  rokInput.min = HIST_MIN_YEAR; rokInput.max = LAST_HIST_WIBOR_YEAR;
  rokRange.min = HIST_MIN_YEAR; rokRange.max = LAST_HIST_WIBOR_YEAR;
  if (parseInt(rokInput.value) > LAST_HIST_WIBOR_YEAR) {
    rokInput.value = rokRange.value = LAST_HIST_WIBOR_YEAR;
    document.getElementById('rok_rv').innerHTML = String(LAST_HIST_WIBOR_YEAR);
  }
}

// ==========================================
// FORMAT
// ==========================================
function fmt(n, dec) {
  if (dec === undefined) dec = 0;
  return n.toLocaleString('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtPLN(n) { return fmt(Math.round(n)) + ' PLN'; }
function fmtPct(n) { return fmt(n, 2) + '%'; }

// ==========================================
// GLOWNA KALKULACJA
// ==========================================
function calculate() {
  const kwota      = parseFloat(document.getElementById('kwota').value)    || 350000;
  const rokStart   = parseInt(document.getElementById('rok_start').value)  || 2010;
  const startMonth = parseInt(document.getElementById('miesiac_start').value) || 1;
  salarySource     = document.getElementById('salary_source').value || 'average';
  const marza      = parseFloat(document.getElementById('marza').value)    || 2;
  const prowizjaInput = parseFloat(document.getElementById('prowizja').value);
  const prowizjaPct = Number.isFinite(prowizjaInput) ? prowizjaInput : 2;
  const latA       = parseInt(document.getElementById('lat_A').value)      || 30;
  const latB       = parseInt(document.getElementById('lat_B').value)      || 10;
  const fixInterval = wiborMode === '3M' ? 3 : 6;

  const wiborStart = getWibor(rokStart, startMonth, wiborMode);
  const cpiStartRaw   = cpiMode === 'monthly'
    ? getCpiMonthly(rokStart, startMonth)
    : getCpiAnnual(rokStart);
  const cpiStartComparable = cpiMode === 'monthly'
    ? annualizeMonthlyCpi(cpiStartRaw)
    : cpiStartRaw;
  const stopaStart = wiborStart + marza;
  const realStopa  = stopaStart - cpiStartComparable;

  const wiborLabelEl = document.getElementById('wibor_label');
  wiborLabelEl.textContent = 'WIBOR ' + wiborMode + ' (miesiąc startu)';
  wiborLabelEl.title = 'WIBOR ' + wiborMode + ' dla miesiąca startu kredytu';

  const cpiLabelEl = document.getElementById('cpi_label');
  if (cpiMode === 'monthly') {
    cpiLabelEl.textContent = 'Inflacja CPI (miesiąc startu, miesiąc do miesiąca)';
    cpiLabelEl.title = 'Inflacja CPI (miesiąc startu, miesiąc do miesiąca)';
  } else {
    cpiLabelEl.textContent = 'Inflacja CPI (rok startu, roczna)';
    cpiLabelEl.title = 'Inflacja CPI (rok startu, roczna)';
  }
  document.getElementById('wibor_display').textContent     = fmtPct(wiborStart);
  document.getElementById('marza_display').textContent     = fmtPct(marza);
  document.getElementById('total_rate_display').textContent = fmtPct(stopaStart);
  document.getElementById('inf_display').textContent = cpiMode === 'monthly'
    ? fmtPct(cpiStartRaw) + ' (≈ ' + fmtPct(cpiStartComparable) + ' rok do roku)'
    : fmtPct(cpiStartRaw);
  document.getElementById('real_rate_display').textContent  = fmtPct(realStopa);

  const tagWiborEl = document.getElementById('tag_wibor');
  tagWiborEl.textContent = 'WIBOR ' + wiborMode + ' · dane historyczne (notowania miesięczne)';
  tagWiborEl.title = 'Dane WIBOR: notowania miesięczne';

  const tagCpiEl = document.getElementById('tag_cpi');
  if (cpiMode === 'monthly') {
    tagCpiEl.textContent = 'Inflacja CPI · GUS Polska (miesięczna, miesiąc do miesiąca)';
    tagCpiEl.title = 'Inflacja CPI (miesięczna, miesiąc do miesiąca)';
  } else {
    tagCpiEl.textContent = 'Inflacja CPI · GUS Polska (roczna)';
    tagCpiEl.title = 'Inflacja CPI (roczna)';
  }

  document.getElementById('card_la').textContent = latA;
  document.getElementById('card_lb').textContent = latB;

  const rowsA = calcHarmonogram(kwota, rokStart, startMonth, latA, marza, wiborMode, cpiMode, rateType);
  const rowsB = calcHarmonogram(kwota, rokStart, startMonth, latB, marza, wiborMode, cpiMode, rateType);
  const yearA = aggregateYearly(rowsA);
  const yearB = aggregateYearly(rowsB);

  const rata1A = rowsA[0] ? rowsA[0].rata : 0;
  const rata1B = rowsB[0] ? rowsB[0].rata : 0;
  document.getElementById('rata_A').textContent = fmt(Math.round(rata1A));
  document.getElementById('rata_B').textContent = fmt(Math.round(rata1B));
  document.getElementById('diff_rata').textContent = fmt(Math.round(rata1B - rata1A));

  const ratyNomA = rowsA.reduce(function(s,r){ return s + r.rata; }, 0);
  const ratyNomB = rowsB.reduce(function(s,r){ return s + r.rata; }, 0);
  const ratyRealA = rowsA.reduce(function(s,r){ return s + r.rataReal; }, 0);
  const ratyRealB = rowsB.reduce(function(s,r){ return s + r.rataReal; }, 0);
  const prowizjaA = kwota * prowizjaPct / 100;
  const prowizjaB = kwota * prowizjaPct / 100;
  const totNomA   = ratyNomA + prowizjaA;
  const totNomB   = ratyNomB + prowizjaB;
  const totRealA  = ratyRealA + prowizjaA;
  const totRealB  = ratyRealB + prowizjaB;
  const odsetNomA  = ratyNomA - kwota;
  const odsetNomB  = ratyNomB - kwota;
  const odsetRealA = ratyRealA - kwota;
  const odsetRealB = ratyRealB - kwota;
  const infZyskA   = totNomA - totRealA;
  const infZyskB   = totNomB - totRealB;

  const MIESIAC_NAZWY_PL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec',
    'lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
  const dataWyceny = MIESIAC_NAZWY_PL[startMonth - 1] + ' ' + rokStart;

  document.getElementById('cA_lata').textContent = latA;
  document.getElementById('cB_lata').textContent = latB;
  document.getElementById('cA_nom').textContent          = fmtPLN(totNomA);
  document.getElementById('cA_odsetki').textContent      = fmtPLN(odsetNomA);
  document.getElementById('cA_prowizje').textContent     = fmtPLN(prowizjaA);
  document.getElementById('cA_real').textContent         = fmtPLN(totRealA);
  document.getElementById('cA_real_odsetki').textContent = fmtPLN(odsetRealA);
  document.getElementById('cA_inflacja_zysk').textContent = fmtPLN(infZyskA);
  document.getElementById('cB_nom').textContent          = fmtPLN(totNomB);
  document.getElementById('cB_odsetki').textContent      = fmtPLN(odsetNomB);
  document.getElementById('cB_prowizje').textContent     = fmtPLN(prowizjaB);
  document.getElementById('cB_real').textContent         = fmtPLN(totRealB);
  document.getElementById('cB_real_odsetki').textContent = fmtPLN(odsetRealB);
  document.getElementById('cB_inflacja_zysk').textContent = fmtPLN(infZyskB);

  document.querySelectorAll('.real-date-label').forEach(function(el) {
    el.textContent = 'Całkowita kwota realna (PLN z ' + dataWyceny + ')';
    el.title = 'Całkowita kwota po uwzględnieniu inflacji (PLN z ' + dataWyceny + ')';
  });
  document.querySelectorAll('.real-odsetki-label').forEach(function(el) {
    el.textContent = 'Realne odsetki (PLN z ' + dataWyceny + ')';
  });

  const nomDiff  = totNomA - totNomB;
  const realDiff = totRealA - totRealB;
  const verdictEl = document.getElementById('verdict_text');
  if (realDiff > 0) {
    const rataDiffText = rateType === 'malejaca'
      ? ' <strong>wyższa rata początkowa</strong> (' + fmtPLN(rata1B - rata1A) + ' więcej na starcie).'
      : ' <strong>wyższa rata miesięczna</strong> (' + fmtPLN(rata1B - rata1A) + ' więcej).';
    verdictEl.innerHTML =
      'Wariant <strong>' + latA + '-letni</strong> kosztuje nominalnie <strong>' + fmtPLN(nomDiff) +
      '</strong> więcej niż ' + latB + '-letni. W złotówkach z <strong>' + dataWyceny +
      '</strong> ta różnica spada do <strong>' + fmtPLN(realDiff) + '</strong>. ' +
      'Inflacja "zjada" ' + fmtPLN(infZyskA - infZyskB) +
      ' z tej różnicy — długi kredyt jest realnie <strong>tańszy niż wynika z nominałów</strong>.' +
      ' Mimo to wariant ' + latB + '-letni pozostaje tańszy nawet po inflacji — ale cena to' +
      rataDiffText;
  } else {
    verdictEl.innerHTML =
      'W złotówkach z <strong>' + dataWyceny + '</strong> wariant <strong>' + latA +
      '-letni</strong> okazuje się <strong>tańszy lub zbliżony kosztowo</strong> do wariantu ' +
      latB + '-letniego. Wysoka inflacja sprawiła, że późniejsze raty były realnie znacznie tańsze.' +
      ' Nominalna różnica: <strong>' + fmtPLN(nomDiff) + '</strong> — realna: zaledwie <strong>' +
      fmtPLN(Math.abs(realDiff)) + '</strong> (w PLN z ' + dataWyceny + ').';
  }

  const lastHistCPI = cpiMode === 'monthly' ? LAST_HIST_CPI_MONTHLY : LAST_HIST_CPI_ANNUAL;
  document.getElementById('note_extra').innerHTML =
    '<strong>Metodologia (w skrócie):</strong><br>' +
    '1) Co ' + fixInterval + ' miesięcy od startu kredytu (bez stałych dat kalendarzowych) pobieramy aktualny WIBOR ' +
    wiborMode + ' i wyliczamy nową ratę od bieżącego salda.<br>' +
    '2) Dane WIBOR to historyczne notowania miesięczne (zamknięcia miesiąca). Inflacja CPI pochodzi z GUS' +
    (cpiMode === 'monthly' ? ' (miesięczna, miesiąc do miesiąca).' : ' (roczna).') +
    '<br>3) Dane historyczne: WIBOR do ' + LAST_HIST_WIBOR_YEAR + ', CPI do ' + lastHistCPI +
    '. Dla kolejnych lat przyjmujemy stałą projekcję: WIBOR ' + DEFAULT_FUTURE_WIBOR +
    '%, inflacja ' + DEFAULT_FUTURE_CPI + '%.<br>' +
    '4) Prowizję banku (' + fmt(prowizjaPct, 1) + '%) doliczamy jako koszt jednorazowy na starcie — bez zwiększania salda kredytu. W wartości realnej prowizja ma ten sam poziom, bo jest kosztem w miesiącu 0 (deflator = 1).<br>' +
    '5) Realne odsetki i rozkład czynników liczymy od samych rat (bez prowizji), aby oddzielić koszt finansowania od opłaty jednorazowej.<br>' +
    '6) Rodzaj rat: ' + (rateType === 'malejaca' ? 'malejące' : 'równe (annuitet)') + '.';

  updateMethodologyPanel({
    kwota, rokStart, startMonth, latA, latB, marza, cpiMode, rateType,
    wiborStart, cpiStartRaw, cpiStartComparable,
    rowsA, rowsB,
    prowizjaPct, prowizjaA, prowizjaB,
    ratyRealA, ratyRealB,
    totRealWithProwizjaA: totRealA, totRealWithProwizjaB: totRealB,
    odsetRealA, odsetRealB
  });

  // ---- Rozklad czynnikow realnego kosztu ----
  const rowsA0 = calcHarmonogram(kwota, rokStart, startMonth, latA, 0, wiborMode, cpiMode, rateType);
  const rowsB0 = calcHarmonogram(kwota, rokStart, startMonth, latB, 0, wiborMode, cpiMode, rateType);
  const totReal0A = rowsA0.reduce(function(s,r){ return s + r.rataReal; }, 0);
  const totReal0B = rowsB0.reduce(function(s,r){ return s + r.rataReal; }, 0);
  const wiborCpiContribA = totReal0A - kwota;
  const wiborCpiContribB = totReal0B - kwota;
  const marzaContribA = odsetRealA - wiborCpiContribA;
  const marzaContribB = odsetRealB - wiborCpiContribB;
  const statsA = calcAvgStats(rowsA);
  const statsB = calcAvgStats(rowsB);
  const durationEffect = odsetRealA - odsetRealB;

  document.getElementById('fA_lata').textContent = latA;
  document.getElementById('fB_lata').textContent = latB;

  var fA_totalEl = document.getElementById('fA_total');
  fA_totalEl.textContent = fmtPLN(odsetRealA);
  fA_totalEl.className = 'val ' + (odsetRealA >= 0 ? 'highlight-negative' : 'highlight-positive');
  var fB_totalEl = document.getElementById('fB_total');
  fB_totalEl.textContent = fmtPLN(odsetRealB);
  fB_totalEl.className = 'val ' + (odsetRealB >= 0 ? 'highlight-negative' : 'highlight-positive');

  document.getElementById('fA_marza').textContent = fmtPLN(marzaContribA);
  document.getElementById('fB_marza').textContent = fmtPLN(marzaContribB);

  var fA_spreadEl = document.getElementById('fA_spread');
  fA_spreadEl.textContent = fmtPLN(wiborCpiContribA);
  fA_spreadEl.className = 'val ' + (wiborCpiContribA >= 0 ? 'highlight-negative' : 'highlight-positive');
  var fB_spreadEl = document.getElementById('fB_spread');
  fB_spreadEl.textContent = fmtPLN(wiborCpiContribB);
  fB_spreadEl.className = 'val ' + (wiborCpiContribB >= 0 ? 'highlight-negative' : 'highlight-positive');

  document.getElementById('fA_avgWibor').textContent = fmtPct(statsA.avgWibor);
  document.getElementById('fB_avgWibor').textContent = fmtPct(statsB.avgWibor);
  document.getElementById('fA_avgCpi').textContent = fmtPct(statsA.avgCpi);
  document.getElementById('fB_avgCpi').textContent = fmtPct(statsB.avgCpi);

  var fA_spreadAvgEl = document.getElementById('fA_avgSpread');
  fA_spreadAvgEl.textContent = fmtPct(statsA.avgSpread);
  fA_spreadAvgEl.className = 'val ' + (statsA.avgSpread < 0 ? 'highlight-positive' : '');
  var fB_spreadAvgEl = document.getElementById('fB_avgSpread');
  fB_spreadAvgEl.textContent = fmtPct(statsB.avgSpread);
  fB_spreadAvgEl.className = 'val ' + (statsB.avgSpread < 0 ? 'highlight-positive' : '');

  var durEffectEl = document.getElementById('f_duration_effect');
  durEffectEl.textContent = fmtPLN(durationEffect);
  durEffectEl.className = 'val ' + (durationEffect >= 0 ? 'highlight-negative' : 'highlight-positive');

  currentData = { rowsA, rowsB, yearA, yearB, kwota, rokStart, startMonth, latA, latB, marza, rateType, prowizjaPct };
  renderChart();
  renderTable('tableA', rowsA, kwota);
  renderTable('tableB', rowsB, kwota);
}

// ==========================================
// RENDER WYKRESU
// ==========================================
function makeChartOpts(yTitleText, cbLabel) {
  const legendColor = getCssVar('--chart-legend', '#6b7385');
  const tooltipBg = getCssVar('--chart-tooltip-bg', '#13161d');
  const borderColor = getCssVar('--border', '#252a38');
  const tooltipTitleColor = getCssVar('--text', '#e8eaf0');
  const tooltipBodyColor = getCssVar('--chart-tooltip-body', '#9098b0');
  const tickColor = getCssVar('--chart-tick', '#4a5168');
  const gridColor = getCssVar('--chart-grid', 'rgba(37,42,56,0.5)');
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
  const ctx = document.getElementById('myChart').getContext('2d');
  if (myChart) myChart.destroy();

  if (currentTab === 'wibor') {
    const years = [];
    for (let y = HIST_MIN_YEAR; y <= LAST_HIST_WIBOR_YEAR; y++) years.push(y);
    const opts = makeChartOpts('%', function(c) {
      const v = c.parsed.y;
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
    const yearA = d.yearA, yearB = d.yearB;
    const salaryMeta = getSalaryMeta();
    const allYears = Array.from(new Set(yearA.map(function(r){return r.rok;}).concat(yearB.map(function(r){return r.rok;})))).sort();
    const mapA = {}, mapB = {};
    yearA.forEach(function(r){ mapA[r.rok] = r; });
    yearB.forEach(function(r){ mapB[r.rok] = r; });
    function pct(row, field) { return row ? parseFloat((row.sumRata / row.months / row[field] * 100).toFixed(1)) : null; }
    const opts = makeChartOpts('% wynagrodzenia', function(c) {
      return c.parsed.y !== null ? c.dataset.label + ': ' + c.parsed.y.toFixed(1) + '%' : '';
    });
    opts.scales.y.ticks.callback = function(v) { return v + '%'; };
    myChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allYears.map(String),
        datasets: [
          { label: d.latA + ' lat – ' + salaryMeta.chartLabel + ' (%)', data: allYears.map(function(y){ return pct(mapA[y],'wynagr'); }),
            borderColor: '#c8a96e', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false },
          { label: d.latB + ' lat – ' + salaryMeta.chartLabel + ' (%)', data: allYears.map(function(y){ return pct(mapB[y],'wynagr'); }),
            borderColor: '#7eb8c9', borderWidth: 2, pointRadius: 2, tension: 0.35, fill: false }
        ]
      },
      options: opts
    });
    return;
  }

  const yearA = d.yearA, yearB = d.yearB;
  const allYears = Array.from(new Set(yearA.map(function(r){return r.rok;}).concat(yearB.map(function(r){return r.rok;})))).sort();
  const mapA = {}, mapB = {};
  yearA.forEach(function(r){ mapA[r.rok] = r; });
  yearB.forEach(function(r){ mapB[r.rok] = r; });
  let cumA = 0, cumB = 0;
  const cA = [], cB = [];
  allYears.forEach(function(y) {
    const rA = mapA[y], rB = mapB[y];
    if (rA) { cumA += currentTab === 'nominal' ? rA.sumRata : rA.sumRataReal; cA.push(Math.round(cumA)); } else cA.push(null);
    if (rB) { cumB += currentTab === 'nominal' ? rB.sumRata : rB.sumRataReal; cB.push(Math.round(cumB)); } else cB.push(null);
  });

  const yTitle = currentTab === 'nominal' ? 'PLN (nominalne)' : 'PLN (realne, dzisiejsze)';
  const opts = makeChartOpts(yTitle, function(c) {
    const v = c.parsed.y;
    return v !== null ? c.dataset.label + ': ' + fmt(Math.round(v)) + ' PLN' : '';
  });
  opts.scales.y.ticks.callback = function(v) { return (v/1000) + 'k'; };

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allYears.map(String),
      datasets: [
        { label: d.latA + ' lat (Wariant A)', data: cA,
          borderColor: '#c8a96e', backgroundColor: 'rgba(200,169,110,0.08)',
          borderWidth: 2, pointRadius: 2, tension: 0.35, fill: true },
        { label: d.latB + ' lat (Wariant B)', data: cB,
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
function renderTable(tableId, rows, kwota) {
  const t = document.getElementById(tableId);
  const salaryMeta = getSalaryMeta();
  const wynagrCache = {};
  const header = '<thead><tr>' +
    '<th>#</th><th>Data</th>' +
    '<th title="Fixing WIBOR w tym miesiącu">Fixing WIBOR</th>' +
    '<th>WIBOR ' + wiborMode + '</th><th>Stopa</th><th>Rata</th>' +
    '<th>Odsetki</th><th>Kapitał</th>' +
    '<th title="Rata w złotówkach z dnia zaciągnięcia kredytu (zdyskontowana CPI)">Rata realna</th>' +
    '<th title="' + salaryMeta.tableTitle + '">' + salaryMeta.tableHeader + '</th>' +
    '<th title="' + salaryMeta.ratioTitle + '">' + salaryMeta.ratioHeader + '</th>' +
    '<th>Saldo</th>' +
    '</tr></thead>';

  const body = rows.map(function(r) {
    if (!wynagrCache[r.rok]) {
      wynagrCache[r.rok]   = getWynagr(r.rok);
    }
    const wynagr   = wynagrCache[r.rok];
    const pctS  = r.rata / wynagr * 100;
    const colS  = pctS  > 50 ? '#e07070' : pctS  > 35 ? '#c8a96e' : '#70c997';
    const rowStyle = r.isFix ? 'background:rgba(200,169,110,0.07);' : '';
    const fixIcon  = r.isFix ? '<span title="Fixing WIBOR" style="color:var(--accent)">&#9679;</span>' : '';
    return '<tr style="' + rowStyle + '">' +
      '<td data-label="#" style="color:var(--muted)">' + r.miesiac + '</td>' +
      '<td data-label="Data" style="white-space:nowrap">' + r.dataLabel + '</td>' +
      '<td data-label="Fixing WIBOR" style="text-align:center">' + fixIcon + '</td>' +
      '<td data-label="WIBOR ' + wiborMode + '">' + r.wibor.toFixed(2) + '%</td>' +
      '<td data-label="Stopa">' + r.stopa.toFixed(2) + '%</td>' +
      '<td data-label="Rata">' + fmt(Math.round(r.rata)) + '</td>' +
      '<td data-label="Odsetki">' + fmt(Math.round(r.odsetki)) + '</td>' +
      '<td data-label="Kapitał">' + fmt(Math.round(r.kapital)) + '</td>' +
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
    ['kwota',    'kwota_r',  'kwota_rv',  function(v){ return fmt(parseFloat(v)) + ' PLN'; }],
    ['rok_start','rok_r',    'rok_rv',    function(v){ return v; }],
    ['marza',    'marza_r',  'marza_rv',  function(v){ return parseFloat(v).toFixed(1) + '%'; }],
    ['prowizja', 'prowizja_r', 'prowizja_rv', function(v){ return parseFloat(v).toFixed(1) + '%'; }],
    ['lat_A',    'lat_A_r',  'lat_A_rv',  function(v){ return '<span class="badge badge-gold">' + v + ' lat</span>'; }],
    ['lat_B',    'lat_B_r',  'lat_B_rv',  function(v){ return '<span class="badge badge-blue">' + v + ' lat</span>'; }],
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

// Init
syncHistoricalRanges();
bindInputs();
syncMethodologyToggleUI();
initTheme();
calculate();
