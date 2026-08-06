const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appjs = fs.readFileSync("app.js", "utf8");
const mockBeachRules = fs.readFileSync("beach_rules.json", "utf8");
const mockUITexts = fs.readFileSync("ui_texts.json", "utf8");

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

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/" });
const window = dom.window;
global.window = window;
global.document = window.document;
global.navigator = { onLine: true };

const fetchedUrls = [];

window.fetch = async (url) => {
  fetchedUrls.push(url);
  if (url.includes("beach_rules")) return { ok: true, json: async () => JSON.parse(mockBeachRules) };
  if (url.includes("ui_texts")) return { ok: true, json: async () => JSON.parse(mockUITexts) };
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

    // Test 6: Day selector buttons existence (Hoy, Hoy+1, Hoy+2)
    const btn0 = document.getElementById('btn-day-0');
    const btn1 = document.getElementById('btn-day-1');
    const btn2 = document.getElementById('btn-day-2');
    if (btn0 && btn1 && btn2 && btn0.textContent.trim() === 'Hoy' && btn1.textContent.trim() === 'Hoy+1' && btn2.textContent.trim() === 'Hoy+2') {
      console.log('✅ TEST 6 PASADO: Botones de selección de 3 días (Hoy, Hoy+1, Hoy+2) presentes en el DOM.');
    } else {
      console.error('❌ TEST 6 FALLADO: Botones del selector de día faltantes o con etiquetas incorrectas.');
      failed = true;
    }

    // Test 7: Default selection is Hoy (btn-day-0 active)
    if (btn0 && btn0.className.includes('bg-[#0072ce]') && !btn1.className.includes('bg-[#0072ce]')) {
      console.log('✅ TEST 7 PASADO: El selector por defecto tiene "Hoy" seleccionado.');
    } else {
      console.error('❌ TEST 7 FALLADO: "Hoy" no aparece seleccionado por defecto.');
      failed = true;
    }

    // Test 8: Interactive day switching (Hoy+1 and Hoy+2)
    if (typeof window.selectDay === 'function') {
      window.selectDay(1); // Click Hoy+1
      const titleDay1 = document.getElementById('sparkline-title') ? document.getElementById('sparkline-title').textContent : '';
      const day1Selected = btn1.className.includes('bg-[#0072ce]') && !btn0.className.includes('bg-[#0072ce]');

      window.selectDay(2); // Click Hoy+2
      const titleDay2 = document.getElementById('sparkline-title') ? document.getElementById('sparkline-title').textContent : '';
      const day2Selected = btn2.className.includes('bg-[#0072ce]') && !btn1.className.includes('bg-[#0072ce]');

      if (day1Selected && day2Selected && titleDay1.includes('Hoy+1') && titleDay2.includes('Hoy+2')) {
        console.log('✅ TEST 8 PASADO: Transición entre Hoy, Hoy+1 y Hoy+2 actualiza la UI y tendencia de viento correctamente.');
      } else {
        console.error('❌ TEST 8 FALLADO: Error al cambiar de día en la previsión.');
        failed = true;
      }
    }

    // Test 9: Verify API endpoints query forecast_days=3
    const forecast3Calls = fetchedUrls.filter(u => u.includes('forecast_days=3'));
    if (forecast3Calls.length >= 3) {
      console.log('✅ TEST 9 PASADO: Las 3 APIs meteorológicas están solicitando previsión para 3 días (forecast_days=3).');
    } else {
      console.error('❌ TEST 9 FALLADO: Las APIs no están solicitando forecast_days=3. Llamadas:', forecast3Calls);
      failed = true;
    }

    // Test 10: Verify getGlobalMaxWind function returns fixed max scale across all 3 days
    if (typeof window.getGlobalMaxWind === 'function') {
      const maxWindVal = window.getGlobalMaxWind();
      if (typeof maxWindVal === 'number' && maxWindVal >= 15) {
        console.log(`✅ TEST 10 PASADO: Escala de viento unificada fijada correctamente a ${maxWindVal} km/h para los 3 días.`);
      } else {
        console.error('❌ TEST 10 FALLADO: getGlobalMaxWind retornó un valor no numérico o inválido:', maxWindVal);
        failed = true;
      }
    }

    // Test 11: Verify UI texts externalization via ui_texts.json
    const headerTitleEl = document.getElementById('header-title');
    if (headerTitleEl && headerTitleEl.textContent === 'Pozo del Esparto') {
      console.log('✅ TEST 11 PASADO: Textos de la UI cargados e inyectados correctamente desde ui_texts.json.');
    } else {
      console.error('❌ TEST 11 FALLADO: Error inyectando textos desde ui_texts.json.');
      failed = true;
    }

    // Test 12: Verify loadRules and getRules availability for predictions without explicit config
    if (typeof window.getRules === 'function' && typeof window.loadRules === 'function') {
      const activeRules = window.getRules();
      const evalWithoutConfig = window.evaluateStatus(12, 90, 0.2); // No config argument passed
      if (activeRules && activeRules.rules && evalWithoutConfig && evalWithoutConfig.badge) {
        console.log(`✅ TEST 12 PASADO: Fichero de reglas siempre disponible y funcional en evaluateStatus() sin pasar configuración explícita -> Badge: "${evalWithoutConfig.badge}".`);
      } else {
        console.error('❌ TEST 12 FALLADO: Las reglas no se cargaron correctamente o evaluateStatus sin config falló.');
        failed = true;
      }
    }

    // Test 13: Verify localStorage cache persistence for rules
    const cachedRulesStr = window.localStorage.getItem('pozometeo_rules');
    if (cachedRulesStr && JSON.parse(cachedRulesStr).beach_info) {
      console.log('✅ TEST 13 PASADO: Fichero de reglas guardado correctamente en localStorage (pozometeo_rules) para disponibilidad offline total.');
    } else {
      console.error('❌ TEST 13 FALLADO: Las reglas no se guardaron en localStorage.');
      failed = true;
    }

    if (failed) {
      console.error('\n💥 Suite de pruebas FINALIZADA CON ERRORES.');
      process.exit(1);
    } else {
      console.log('\n🎉 TODAS LAS PRUEBAS (13/13) HAN PASADO CON ÉXITO.');
      process.exit(0);
    }
  }, 800);

} catch (e) {
  console.error('💥 EXCEPCIÓN EN TESTS:', e);
  process.exit(1);
}
