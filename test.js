const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appjs = fs.readFileSync("app.js", "utf8");
const mockBeachRules = fs.readFileSync("beach_rules.json", "utf8");

// Mocking API responses
const mockGeneral = {
  hourly: {
    temperature_2m: Array(100).fill(25),
    precipitation_probability: Array(100).fill(0),
    uv_index: Array(100).fill(5),
  }
};
const mockWind = {
  hourly: {
    windspeed_10m_ecmwf_ifs04: Array(100).fill(15),
    winddirection_10m_ecmwf_ifs04: Array(100).fill(90),
    windspeed_10m_gfs_seamless: Array(100).fill(16),
    winddirection_10m_gfs_seamless: Array(100).fill(95),
    windspeed_10m_icon_seamless: Array(100).fill(14),
    winddirection_10m_icon_seamless: Array(100).fill(85),
  }
};
const mockMarine = {
  hourly: {
    wave_height: Array(100).fill(0.5)
  }
};

const dom = new JSDOM(html, { runScripts: "outside-only" });
const window = dom.window;
global.window = window;
global.document = window.document;
global.navigator = { onLine: true };

window.fetch = async (url) => {
  if (url.includes("beach_rules")) return { ok: true, json: async () => JSON.parse(mockBeachRules) };
  if (url.includes("temperature_2m")) return { ok: true, json: async () => mockGeneral };
  if (url.includes("windspeed_10m")) return { ok: true, json: async () => mockWind };
  if (url.includes("wave_height")) return { ok: true, json: async () => mockMarine };
  throw new Error("Unknown URL: " + url);
};

// Canvas Mock
window.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
});

console.log("🧪 Iniciando suite de pruebas PozoMeteo...");

try {
  window.eval(appjs);

  // Dispatch DOMContentLoaded
  const event = window.document.createEvent('Event');
  event.initEvent('DOMContentLoaded', true, true);
  window.document.dispatchEvent(event);

  setTimeout(() => {
    let failed = false;

    // Test 1: Hourly list length
    const list = document.getElementById('hourly-list');
    if (list && list.children.length === 13) {
      console.log('✅ TEST 1 PASADO: Lista horaria generada correctamente (13 tramos de 08:00 a 20:00).');
    } else {
      console.error('❌ TEST 1 FALLADO: Elementos esperados 13, encontrados:', list ? list.children.length : 0);
      failed = true;
    }

    // Test 2: Main Status Card SVG Wind Arrow
    const cardWind = document.getElementById('card-wind');
    const mainSvg = cardWind ? cardWind.querySelector('svg') : null;
    if (mainSvg && mainSvg.getAttribute('viewBox') === '0 0 24 24') {
      console.log('✅ TEST 2 PASADO: Flecha SVG de viento presente en la tarjeta principal.');
    } else {
      console.error('❌ TEST 2 FALLADO: La flecha SVG en card-wind no existe o no es válida.');
      failed = true;
    }

    // Test 3: Hourly List SVG Wind Arrows
    const hourlySvgs = list ? list.querySelectorAll('svg') : [];
    if (hourlySvgs.length === 13) {
      console.log('✅ TEST 3 PASADO: Flechas SVG de viento presentes en cada fila horaria (13/13).');
    } else {
      console.error('❌ TEST 3 FALLADO: Flechas SVG en la lista horaria:', hourlySvgs.length);
      failed = true;
    }

    // Test 4: Single status badge (No duplicate dot span)
    const firstRow = list ? list.children[0] : null;
    const legacyDotSpan = firstRow ? firstRow.querySelector('span.w-2\\.5, span.sm\\:w-3') : null;
    if (!legacyDotSpan) {
      console.log('✅ TEST 4 PASADO: No hay puntos de color duplicados en el listado por horas.');
    } else {
      console.error('❌ TEST 4 FALLADO: Se encontró punto de color duplicado en la fila.');
      failed = true;
    }

    // Test 5: Hybrid Evaluation function unit test
    if (typeof window.evaluateStatus === 'function') {
      const config = JSON.parse(mockBeachRules);
      const res = window.evaluateStatus(15, 90, 0.4, config); // 15 km/h levante, 0.4m wave
      if (res && res.badge) {
        console.log(`✅ TEST 5 PASADO: evaluateStatus ejecutado exitosamente -> Badge: "${res.badge}"`);
      } else {
        console.error('❌ TEST 5 FALLADO: evaluateStatus retornó resultado inválido');
        failed = true;
      }
    }

    if (failed) {
      console.error('\n💥 Suite de pruebas FINALIZADA CON ERRORES.');
      process.exit(1);
    } else {
      console.log('\n🎉 TODAS LAS PRUEBAS (5/5) HAN PASADO CON ÉXITO.');
      process.exit(0);
    }
  }, 800);

} catch (e) {
  console.error('💥 EXCEPCIÓN EN TESTS:', e);
  process.exit(1);
}
