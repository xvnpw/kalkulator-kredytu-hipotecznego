// =============================================================================
// Test runner for kalkulator-kredytu.js
// =============================================================================
// Usage:  node tests/run-tests.js
//
// Loads the data files and calculator logic into a Node.js VM sandbox,
// then executes test-kalkulator.js inside that sandbox.
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
    getElementById: function() { return makeMockElement(); },
    querySelectorAll: function() { return []; },
    documentElement: { setAttribute: function() {}, style: {} }
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
  'data-wynagrodzenia-przecietne.js',
  'data-wynagrodzenia-minimalne.js',
  'kalkulator-kredytu.js'
];

dataFiles.forEach(function(file) {
  var code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, sandbox);
});

// --- Run test suite inside the sandbox --------------------------------------

var testCode = fs.readFileSync(path.join(__dirname, 'test-kalkulator.js'), 'utf8');
vm.runInContext(testCode, sandbox);
