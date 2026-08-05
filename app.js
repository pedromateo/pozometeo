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
  document.getElementById('error-card').classList.add('hidden');
  document.getElementById('offline-indicator').classList.add('hidden');

  let isOffline = !navigator.onLine;

  try {
    const GENERAL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=temperature_2m,precipitation_probability,uv_index&timezone=Europe/Madrid&forecast_days=2';
    const WIND_MULTI_MODEL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=windspeed_10m,winddirection_10m&models=ecmwf_ifs04,gfs_seamless,icon_seamless&timezone=Europe/Madrid&forecast_days=2&wind_speed_unit=kmh';
    const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=37.245&longitude=-1.862&hourly=wave_height&timezone=Europe/Madrid&forecast_days=2';

    const RULES_URL = './beach_rules.json';
    const fallbackRulesConfig = {
      "beach_info": { "id": "pozo_del_esparto", "name": "Pozo del Esparto", "wind_adjustment_factor": 1.125 },
      "global_wave_rules": [
        { "max_height_m": 0.6, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Oleaje tranquilo" },
        { "max_height_m": 1.1, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Precaución: Presencia de oleaje" },
        { "max_height_m": 99.0, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Prohibido / Peligro: Mar de fondo" }
      ],
      "rules": [
        { "id": "offshore", "dir_min_deg": 270, "dir_max_deg": 330, "thresholds": [{ "max_speed_kmh": 999, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar plano (Viento de tierra)" }] },
        { "id": "perpendicular", "dir_min_deg": 60, "dir_max_deg": 100, "thresholds": [{ "max_speed_kmh": 8, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Mar en calma" }, { "max_speed_kmh": 12, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Ligero oleaje de frente" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Olas por viento de levante" }] },
        { "id": "diagonal", "dir_min_deg": 101, "dir_max_deg": 135, "thresholds": [{ "max_speed_kmh": 11, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar rizada suave" }, { "max_speed_kmh": 16, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Brisa diagonal tolerable" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Marejadilla molesta" }] },
        { "id": "parallel_or_other", "dir_min_deg": 0, "dir_max_deg": 360, "thresholds": [{ "max_speed_kmh": 15, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Brisa paralela" }, { "max_speed_kmh": 999, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Viento fuerte lateral" }] }
      ]
    };

    const [generalData, windData, marineData, fetchedRules] = await Promise.all([
      fetchWithRetry(GENERAL_URL),
      fetchWithRetry(WIND_MULTI_MODEL_URL),
      fetchWithRetry(MARINE_URL),
      fetchWithRetry(RULES_URL).catch(() => fallbackRulesConfig)
    ]);
    const rulesConfig = fetchedRules || fallbackRulesConfig;

    if (!generalData || !generalData.hourly) {
        throw new Error("Invalid API Data");
    }

    if (isOffline) {
        document.getElementById('offline-indicator').classList.remove('hidden');
    }

    const currentHourReal = new Date().getHours();
    const isNextDay = currentHourReal > 20;
    const dayOffset = isNextDay ? 24 : 0; 
    
    document.getElementById('day-label').textContent = isNextDay ? "Mañana" : "Hoy";

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

    document.getElementById('loader').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    drawSparkline(currentForecastData); 

  } catch (error) {
    console.error("Error cargando datos:", error);
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('error-card').classList.remove('hidden');
  }
}

function evaluateStatus(speed, dir, wave, config) {
  const adjSpeed = speed * config.beach_info.wind_adjustment_factor;
  const waveRule = config.global_wave_rules.find(w => wave <= w.max_height_m) || config.global_wave_rules[config.global_wave_rules.length - 1];
  
  let windRule = config.rules.find(r => r.id !== "parallel_or_other" && dir >= r.dir_min_deg && dir <= r.dir_max_deg);
  if (!windRule) windRule = config.rules.find(r => r.id === "parallel_or_other");
  const windThreshold = windRule.thresholds.find(t => adjSpeed <= t.max_speed_kmh) || windRule.thresholds[windRule.thresholds.length - 1];

  if (waveRule.level > windThreshold.level) {
    return { badge: waveRule.badge, desc: waveRule.desc, color: waveRule.color, adjSpeed: adjSpeed.toFixed(1) };
  } else {
    return { badge: windThreshold.badge, desc: windThreshold.desc, color: windThreshold.color, adjSpeed: adjSpeed.toFixed(1) };
  }
}

function getWindArrowSVG(dir, sizeClass = "w-5 h-5", colorClass = "") {
  return `<svg class="inline-block ${sizeClass} ${colorClass} transform transition-transform align-middle shrink-0" style="transform: rotate(${dir}deg);" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"></line><polyline points="19 14 12 21 5 14"></polyline></svg>`;
}

function renderUI(forecast, currentHourReal, isNextDay) {
  let activeForecast = forecast.find(f => f.hour === currentHourReal && !isNextDay);
  if (!activeForecast) activeForecast = forecast[0];

  document.getElementById('main-status-card').style.backgroundColor = activeForecast.color;
  document.getElementById('card-time').textContent = !isNextDay && currentHourReal >= 8 && currentHourReal <= 20 ? "AHORA" : `Previsión ${activeForecast.hour}:00h`;
  document.getElementById('card-badge').textContent = activeForecast.badge;
  document.getElementById('card-desc').textContent = activeForecast.desc;
  
  document.getElementById('card-wind').innerHTML = `
    <span class="flex items-center gap-1.5">
      <span>${activeForecast.adjSpeed} <span class="text-sm font-normal opacity-70">km/h</span></span>
      <span class="inline-flex items-center justify-center p-1 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-sm shadow-sm" title="Dirección: ${activeForecast.dir}°">
        ${getWindArrowSVG(activeForecast.dir, "w-6 h-6 sm:w-7 sm:h-7", "text-white")}
      </span>
    </span>
  `;
  document.getElementById('card-wave').textContent = `${activeForecast.wave} m`;

  const uvElement = document.getElementById('card-uv');
  uvElement.textContent = `☀️ UV: ${Math.round(activeForecast.uv)}`;
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
            ${isOptimal ? '<span class="text-[10px] sm:text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 px-1.5 py-0.5 rounded-sm mt-0.5 border border-amber-200 dark:border-amber-800">✨ Óptimo</span>' : ''}
          </div>
          <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-normal mt-0.5 sm:mt-1">${item.desc}</p>
        </div>
      </div>
      <div class="text-right text-xs sm:text-sm w-1/2">
        <div class="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-end gap-1">
          <span>💨 ${item.adjSpeed} <span class="text-[10px] sm:text-xs font-normal text-slate-500 dark:text-slate-400">km/h</span></span>
          <span class="inline-flex items-center justify-center p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 shadow-xs" title="Dirección: ${item.dir}°">
            ${getWindArrowSVG(item.dir, "w-4 h-4 sm:w-5 sm:h-5")}
          </span>
          <span class="ml-1">| 🌊 ${item.wave}m</span>
        </div>
        <p class="text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 text-[11px] sm:text-xs">🌡️ ${item.temp}°C | UV: ${Math.round(item.uv)}</p>
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

window.addEventListener('online', () => {
  if(!document.getElementById('content').classList.contains('hidden')) {
    document.getElementById('offline-indicator').classList.add('hidden');
  }
});

window.addEventListener('offline', () => {
    if(!document.getElementById('content').classList.contains('hidden')) {
        document.getElementById('offline-indicator').classList.remove('hidden');
    }
});

window.addEventListener('DOMContentLoaded', initApp);
