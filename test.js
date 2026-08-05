const { JSDOM } = require("jsdom");
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const appjs = fs.readFileSync("app.js", "utf8");

// Mocking fetch responses
const mockBeachRules = fs.readFileSync("beach_rules.json", "utf8");

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
  throw new Error("Unknown URL");
};

// Replace canvas context since JSDOM doesn't support canvas 2d out of the box easily without canvas package
window.HTMLCanvasElement.prototype.getContext = () => ({
  clearRect: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
});

try {
  window.eval(appjs);
  // Manually trigger DOMContentLoaded
  const event = window.document.createEvent('Event');
  event.initEvent('DOMContentLoaded', true, true);
  window.document.dispatchEvent(event);
  
  // wait a bit for async functions to resolve
  setTimeout(() => {
    const list = document.getElementById('hourly-list');
    if(list.children.length > 0) {
      console.log('SUCCESS: UI populated successfully with ' + list.children.length + ' elements.');
      console.log('Badge text:', document.getElementById('card-badge').textContent);
      console.log('Wind text:', document.getElementById('card-wind').textContent);
    } else {
      console.log('ERROR: UI was not populated');
    }
  }, 1000);
} catch (e) {
  console.log('ERROR:', e);
}
