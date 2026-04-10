// =============================================================================
// Test runner for symulator-nadplat.js
// =============================================================================
// Usage:  node tests/run-tests-nadplat.js
//
// Loads the data files and overpayment simulator logic into a Node.js VM sandbox,
// then executes test-nadplat.js inside that sandbox.
// No npm dependencies — uses only built-in Node.js modules.
// =============================================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

// --- Mock DOM environment (enough for calculate() to run) -------------------

function makeMockElement() {
  return {
    value: '', textContent: '', innerHTML: '', title: '',
    classList: { toggle: function() {} },
    setAttribute: function() {},
    addEventListener: function() {},
    min: '', max: '',
    getContext: function() { return { clearRect: function() {}, fillRect: function() {} }; },
    hidden: false,
    style: {}
  };
}

// Default input values matching symulator-nadplat.html defaults
var inputValues = {
  kwota: '350000',
  rok_start: '2010',
  miesiac_start: '1',
  okres: '360',
  marza: '2',
  prowizja: '2',
  salary_source: 'private',
  future_wibor: '3.0',
  future_cpi: '3.0',
  future_salary: '3.5',
  future_stock_return: '5.0',
  future_deposit_rate: '3.0',
  future_usdpln: '3.5',
  investment_type: 'none'
};

const sandbox = vm.createContext({
  // Built-ins
  Math: Math, console: console, Object: Object, Array: Array,
  Number: Number, String: String, parseInt: parseInt, parseFloat: parseFloat,
  Set: Set, Map: Map, Error: Error, TypeError: TypeError,
  JSON: JSON, RegExp: RegExp, Date: Date, Symbol: Symbol, Promise: Promise,
  isNaN: isNaN, isFinite: isFinite, undefined: undefined,

  // Browser API stubs
  localStorage: { getItem: function() { return null; }, setItem: function() {} },
  window: { matchMedia: function() { return { matches: false }; } },
  document: {
    getElementById: function(id) {
      var el = makeMockElement();
      if (inputValues[id] !== undefined) el.value = inputValues[id];
      return el;
    },
    querySelectorAll: function() { return { forEach: function() {} }; },
    documentElement: { setAttribute: function() {}, style: {} },
    createElement: function() {
      return {
        className: '', innerHTML: '',
        setAttribute: function() {},
        appendChild: function() {}
      };
    }
  },
  getComputedStyle: function() { return { getPropertyValue: function() { return ''; } }; },
  Chart: function() { this.destroy = function() {}; return this; },
  setTimeout: setTimeout,
  setInterval: setInterval,
  process: process
});

// --- Load source files into sandbox -----------------------------------------

var dataFiles = [
  'data-wibor6m.js',
  'data-wibor3m.js',
  'data-cpi-annual.js',
  'data-cpi-monthly.js',
  'data-wynagrodzenia-prywatny.js',
  'data-wynagrodzenia-przecietne.js',
  'data-wynagrodzenia-minimalne.js',
  'data-wig30.js',
  'data-wig.js',
  'data-spx.js',
  'data-usdpln.js',
  'data-wibor1m.js',
  'data-nbp-rate.js',
  'symulator-nadplat.js'
];

dataFiles.forEach(function(file) {
  var code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox);
});

// --- Run test suite inside the sandbox --------------------------------------

var testCode = fs.readFileSync(path.join(__dirname, 'test-nadplat.js'), 'utf8');
vm.runInContext(testCode, sandbox);
