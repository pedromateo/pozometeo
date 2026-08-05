# 🏖️ Pozo del Esparto - Estado del Baño (Web App & PWA) v3.0 (Ensemble Forecast)

Aplicación web progresiva (PWA) *Client-Only* para evaluar en tiempo real la calidad del baño en la playa de **Pozo del Esparto** (Almería).

## 🚀 Características Premium Incluidas (v3.0)
1. **Predicción por Conjuntos (Multi-Modelo):** Descarga simultánea de los 3 mejores modelos globales (ECMWF, GFS, ICON) calculando una media aritmética para la velocidad y una media vectorial/trigonométrica para la dirección del viento.
2. **Evaluador Híbrido:** Analiza el viento de la orilla (+12.5% factor de ajuste) y la altura del oleaje marino (*mar de fondo*), priorizando siempre la condición más restrictiva/peligrosa.
3. **Interfaz Dinámica (UI/UX):** Modo Oscuro automático, gráfico nativo *Sparkline* de tendencia del viento y flechas direccionales reactivas.
4. **Soporte Offline:** Service Worker con estrategia de caché para acceso sin cobertura en la playa.

---

## 📄 Archivos del Proyecto

### 1️⃣ `beach_rules.json` (Motor de Conocimiento Desacoplado)
```json
{
  "beach_info": {
    "id": "pozo_del_esparto",
    "name": "Pozo del Esparto",
    "wind_adjustment_factor": 1.125
  },
  "global_wave_rules": [
    { "max_height_m": 0.6, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Oleaje tranquilo" },
    { "max_height_m": 1.1, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Precaución: Presencia de oleaje" },
    { "max_height_m": 99.0, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Prohibido / Peligro: Mar de fondo" }
  ],
  "rules": [
    {
      "id": "offshore",
      "dir_min_deg": 270,
      "dir_max_deg": 330,
      "thresholds": [
        { "max_speed_kmh": 999, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar plano (Viento de tierra)" }
      ]
    },
    {
      "id": "perpendicular",
      "dir_min_deg": 60,
      "dir_max_deg": 100,
      "thresholds": [
        { "max_speed_kmh": 8,  "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Mar en calma" },
        { "max_speed_kmh": 12, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Ligero oleaje de frente" },
        { "max_speed_kmh": 999,"level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Olas por viento de levante" }
      ]
    },
    {
      "id": "diagonal",
      "dir_min_deg": 101,
      "dir_max_deg": 135,
      "thresholds": [
        { "max_speed_kmh": 11, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar rizada suave" },
        { "max_speed_kmh": 16, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Brisa diagonal tolerable" },
        { "max_speed_kmh": 999,"level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Marejadilla molesta" }
      ]
    },
    {
      "id": "parallel_or_other",
      "dir_min_deg": 0,
      "dir_max_deg": 360,
      "thresholds": [
        { "max_speed_kmh": 15, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Brisa paralela" },
        { "max_speed_kmh": 999, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Viento fuerte lateral" }
      ]
    }
  ]
}
```

### 2️⃣ `manifest.json` (PWA Config)
```json
{
  "short_name": "Pozo Esparto",
  "name": "Estado del Mar - Pozo del Esparto",
  "icons": [
    {
      "src": "https://cdn-icons-png.flaticon.com/512/2932/2932445.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "https://cdn-icons-png.flaticon.com/512/2932/2932445.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "./index.html",
  "background_color": "#0072ce",
  "theme_color": "#0072ce",
  "display": "standalone",
  "orientation": "portrait"
}
```

### 3️⃣ `sw.js` (Service Worker - Caché Offline)
```javascript
const CACHE_NAME = 'pozo-bano-v3';
const ASSETS = ['./', './index.html', './app.js', './beach_rules.json', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('api.open-meteo.com')) return; // No cachear APIs
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
```

### 4️⃣ `index.html` (Vista UI Responsiva)
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estado del Baño - Pozo del Esparto</title>
  
  <link rel="manifest" href="./manifest.json">
  <meta name="theme-color" content="#0072ce">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/2932/2932445.png">
  <script src="https://cdn.tailwindcss.com"></script>
  
  <script>
    tailwind.config = { darkMode: 'media' };
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
    }
  </script>
</head>
<body class="bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 min-h-screen flex flex-col items-center transition-colors duration-300">

  <header class="bg-[#0072ce] dark:bg-blue-900 text-white shadow-md w-full">
    <div class="max-w-xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
      <div>
        <h1 class="text-lg sm:text-xl font-black tracking-tight">Pozo del Esparto</h1>
        <p class="text-[11px] sm:text-xs text-blue-100 dark:text-blue-300">Cuevas del Almanzora, Almería</p>
      </div>
      <span class="text-[10px] sm:text-xs bg-white/20 px-2 py-1 rounded font-bold uppercase tracking-wider">Estado del Baño</span>
    </div>
  </header>

  <main class="w-full max-w-xl px-4 py-4 sm:py-8 space-y-4 sm:space-y-6 flex-grow">
    
    <div id="loader" class="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center space-y-3 border border-slate-200 dark:border-slate-700 shadow-sm">
      <div class="inline-block w-10 h-10 border-4 border-[#0072ce] border-t-transparent rounded-full animate-spin"></div>
      <p class="text-slate-600 dark:text-slate-300 font-semibold text-sm">Analizando viento, UV y oleaje multi-modelo...</p>
    </div>

    <div id="content" class="hidden space-y-4 sm:space-y-6">
      <section id="main-status-card" class="rounded-2xl p-6 sm:p-8 shadow-md text-white relative overflow-hidden transition-all duration-300">
        <div class="flex justify-between items-center mb-4">
          <span id="card-time" class="text-xs sm:text-sm font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">--</span>
          <span id="card-uv" class="text-xs font-bold bg-amber-500/90 px-2 py-1 rounded shadow-sm">☀️ UV: --</span>
        </div>
        
        <div class="my-4 sm:my-6">
          <span id="card-badge" class="inline-block text-sm sm:text-base font-black uppercase tracking-wider px-3 py-1.5 rounded-md bg-white text-slate-900 mb-3 shadow-sm">--</span>
          <h2 id="card-desc" class="text-2xl sm:text-3xl font-extrabold leading-tight">--</h2>
        </div>
        
        <div class="border-t border-white/20 my-4 sm:my-6"></div>
        
        <div class="grid grid-cols-2 gap-3 sm:gap-4 text-white relative z-10">
          <div class="bg-black/15 p-3 rounded-xl backdrop-blur-sm">
            <p class="text-[10px] sm:text-xs uppercase font-bold opacity-80 mb-1">💨 Viento (Orilla)</p>
            <p id="card-wind" class="text-lg sm:text-2xl font-extrabold flex items-center">-- km/h</p>
          </div>
          <div class="bg-black/15 p-3 rounded-xl backdrop-blur-sm">
            <p class="text-[10px] sm:text-xs uppercase font-bold opacity-80 mb-1">🌊 Oleaje</p>
            <p id="card-wave" class="text-lg sm:text-2xl font-extrabold">-- m</p>
          </div>
        </div>

        <div class="mt-4 pt-2 w-full h-12 relative opacity-80">
          <p class="text-[9px] uppercase font-bold tracking-widest mb-1 opacity-70">Tendencia del Viento Hoy</p>
          <canvas id="sparkline" class="w-full h-full"></canvas>
        </div>
      </section>

      <section class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors">
        <div class="px-4 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Evolución (08:00 - 20:00)</h3>
          <span id="day-label" class="text-[11px] sm:text-xs bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded text-slate-600 dark:text-slate-300 font-bold">--</span>
        </div>
        <div id="hourly-list" class="divide-y divide-slate-100 dark:divide-slate-700"></div>
      </section>

      <button onclick="initApp()" class="w-full py-3 sm:py-4 bg-[#0072ce] dark:bg-blue-600 hover:bg-[#005ba4] text-white font-bold text-sm sm:text-base rounded-xl shadow-sm transition-all active:scale-[0.98]">
        🔄 Refrescar Datos
      </button>
    </div>
  </main>
  
  <script src="./app.js"></script>
</body>
</html>
```

### 5️⃣ `app.js` (Lógica Ensemble & Motor de Evaluación)
```javascript
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

let currentForecastData = []; 

async function initApp() {
  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('content').classList.add('hidden');

  try {
    const GENERAL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=temperature_2m,precipitation_probability,uv_index&timezone=Europe/Madrid&forecast_days=2';
    // Ensemble de Viento: ECMWF (EUR), GFS (USA), ICON (GER)
    const WIND_MULTI_MODEL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=windspeed_10m,winddirection_10m&models=ecmwf_ifs04,gfs_seamless,icon_seamless&timezone=Europe/Madrid&forecast_days=2&wind_speed_unit=kmh';
    const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=37.245&longitude=-1.862&hourly=wave_height&timezone=Europe/Madrid&forecast_days=2';

    const [rulesConfig, generalData, windData, marineData] = await Promise.all([
      fetchWithRetry('./beach_rules.json'),
      fetchWithRetry(GENERAL_URL),
      fetchWithRetry(WIND_MULTI_MODEL_URL),
      fetchWithRetry(MARINE_URL)
    ]);

    const currentHourReal = new Date().getHours();
    const isNextDay = currentHourReal > 20;
    const dayOffset = isNextDay ? 24 : 0; 
    
    document.getElementById('day-label').innerText = isNextDay ? "Mañana" : "Hoy";

    const hourlyForecast = [];
    for (let h = 8; h <= 20; h++) {
      const apiIndex = dayOffset + h;
      
      const speeds = [
        windData.hourly.windspeed_10m_ecmwf_ifs04[apiIndex],
        windData.hourly.windspeed_10m_gfs_seamless[apiIndex],
        windData.hourly.windspeed_10m_icon_seamless[apiIndex]
      ].filter(v => v !== null && v !== undefined);

      const dirs = [
        windData.hourly.winddirection_10m_ecmwf_ifs04[apiIndex],
        windData.hourly.winddirection_10m_gfs_seamless[apiIndex],
        windData.hourly.winddirection_10m_icon_seamless[apiIndex]
      ].filter(v => v !== null && v !== undefined);

      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

      let sumSin = 0, sumCos = 0;
      dirs.forEach(d => {
        const rad = d * (Math.PI / 180);
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
      });
      let avgDir = (Math.atan2(sumSin, sumCos) * (180 / Math.PI) + 360) % 360;

      const temp = generalData.hourly.temperature_2m[apiIndex];
      const rain = generalData.hourly.precipitation_probability[apiIndex] || 0;
      const uv = generalData.hourly.uv_index[apiIndex] || 0;
      const wave = marineData.hourly.wave_height[apiIndex] || 0;

      const finalSpeed = parseFloat(avgSpeed.toFixed(1));
      const finalDir = Math.round(avgDir);

      const evalResult = evaluateStatus(finalSpeed, finalDir, wave, rulesConfig);
      hourlyForecast.push({ hour: h, speed: finalSpeed, dir: finalDir, temp, rain, uv, wave, ...evalResult });
    }

    currentForecastData = hourlyForecast;
    renderUI(hourlyForecast, currentHourReal, isNextDay);

  } catch (error) {
    console.error("Error:", error);
    alert("Sin conexión. Inténtalo más tarde.");
  } finally {
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    drawSparkline(currentForecastData); 
  }
}

function evaluateStatus(speed, dir, wave, config) {
  const adjSpeed = speed * config.beach_info.wind_adjustment_factor;
  const waveRule = config.global_wave_rules.find(w => wave <= w.max_height_m);
  
  let windRule = config.rules.find(r => r.id !== "parallel_or_other" && dir >= r.dir_min_deg && dir <= r.dir_max_deg);
  if (!windRule) windRule = config.rules.find(r => r.id === "parallel_or_other");
  const windThreshold = windRule.thresholds.find(t => adjSpeed <= t.max_speed_kmh);

  if (waveRule.level > windThreshold.level) {
    return { badge: waveRule.badge, desc: waveRule.desc, color: waveRule.color, adjSpeed: adjSpeed.toFixed(1) };
  } else {
    return { badge: windThreshold.badge, desc: windThreshold.desc, color: windThreshold.color, adjSpeed: adjSpeed.toFixed(1) };
  }
}

function renderUI(forecast, currentHourReal, isNextDay) {
  let activeForecast = forecast.find(f => f.hour === currentHourReal && !isNextDay);
  if (!activeForecast) activeForecast = forecast[0];

  document.getElementById('main-status-card').style.backgroundColor = activeForecast.color;
  document.getElementById('card-time').innerText = !isNextDay && currentHourReal >= 8 && currentHourReal <= 20 ? "AHORA" : `Previsión ${activeForecast.hour}:00h`;
  document.getElementById('card-badge').innerText = activeForecast.badge;
  document.getElementById('card-desc').innerText = activeForecast.desc;
  
  document.getElementById('card-wind').innerHTML = `${activeForecast.adjSpeed} <span class="text-sm font-normal opacity-70 ml-1">km/h</span> <span class="inline-block transform transition-transform ml-2" style="transform: rotate(${activeForecast.dir}deg)">↓</span>`;
  document.getElementById('card-wave').innerText = `${activeForecast.wave} m`;

  const uvElement = document.getElementById('card-uv');
  uvElement.innerText = `☀️ UV: ${Math.round(activeForecast.uv)}`;
  uvElement.className = activeForecast.uv > 7 ? "text-xs font-bold bg-red-500 text-white px-2 py-1 rounded shadow-sm" : "text-xs font-bold bg-amber-500/90 text-white px-2 py-1 rounded shadow-sm"; 

  const listContainer = document.getElementById('hourly-list');
  listContainer.innerHTML = '';

  forecast.forEach(item => {
    const isCurrent = item.hour === currentHourReal && !isNextDay;
    const isOptimal = item.hour >= 8 && item.hour <= 10;
    
    const row = document.createElement('div');
    row.className = `p-3 sm:px-6 sm:py-4 flex items-center justify-between transition-colors ${isCurrent ? 'bg-blue-50/80 dark:bg-blue-900/30 border-l-4 border-[#0072ce] dark:border-blue-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`;

    row.innerHTML = `
      <div class="flex items-center space-x-3 sm:space-x-4 w-1/2">
        <div class="flex flex-col items-center">
          <span class="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">${String(item.hour).padStart(2, '0')}:00</span>
        </div>
        <div>
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" style="background-color: ${item.color}"></span>
            <span class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">${item.badge}</span>
            ${isOptimal ? '<span class="text-[9px] sm:text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-1.5 py-0.5 rounded-sm mt-0.5 border border-amber-200 dark:border-amber-800">✨ Óptimo</span>' : ''}
          </div>
          <p class="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5 sm:mt-1">${item.desc}</p>
        </div>
      </div>
      <div class="text-right text-[11px] sm:text-xs w-1/2">
        <p class="font-bold text-slate-800 dark:text-slate-200">💨 ${item.adjSpeed} <span class="text-[9px] sm:text-[10px] font-normal text-slate-500 dark:text-slate-400">km/h <span class="inline-block transform transition-transform" style="transform: rotate(${item.dir}deg)">↓</span></span> | 🌊 ${item.wave}m</p>
        <p class="text-slate-400 dark:text-slate-500 mt-0.5 sm:mt-1">🌡️ ${item.temp}°C | UV: ${Math.round(item.uv)}</p>
      </div>
    `;
    listContainer.appendChild(row);
  });
}

function drawSparkline(forecast) {
  const canvas = document.getElementById('sparkline');
  if (!canvas || forecast.length === 0) return;
  const ctx = canvas.getContext('2d');
  
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  const width = canvas.width, height = canvas.height;
  
  const maxWind = Math.max(...forecast.map(f => parseFloat(f.adjSpeed)), 20); 
  const minWind = 0;

  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  forecast.forEach((f, i) => {
    const x = (i / (forecast.length - 1)) * width;
    const y = height - ((parseFloat(f.adjSpeed) - minWind) / (maxWind - minWind)) * height;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  
  ctx.stroke();
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
}

window.addEventListener('resize', () => drawSparkline(currentForecastData));
window.addEventListener('DOMContentLoaded', initApp);
```
