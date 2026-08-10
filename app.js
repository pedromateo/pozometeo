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

let selectedDayIndex = 0; // 0 = Hoy, 1 = Hoy+1, 2 = Hoy+2
let fetchedApiData = null;
let currentForecastData = []; 
let uiTextsConfig = null;
let currentRulesConfig = null;

const fallbackRulesConfig = {
  "beach_info": { "id": "pozo_del_esparto", "name": "Pozo del Esparto", "wind_adjustment_factor": 1.125 },
  "global_wave_rules": [
    { "max_height_m": 0.3, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Calma chicha" },
    { "max_height_m": 0.6, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Oleaje tranquilo" },
    { "max_height_m": 1.1, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Precaución: Oleaje" },
    { "max_height_m": 99.0, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Prohibido / Peligro: Mar de fondo" }
  ],
  "rules": [
    { "id": "offshore", "dir_min_deg": 270, "dir_max_deg": 330, "thresholds": [{ "max_speed_kmh": 10, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar plano" }, { "max_speed_kmh": 20, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Mar plano (Viento de tierra)" }, { "max_speed_kmh": 30, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Mar plano pero brisa fuerte de tierra" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Viento racheado fuerte de tierra" }] },
    { "id": "perpendicular", "dir_min_deg": 60, "dir_max_deg": 100, "thresholds": [{ "max_speed_kmh": 6, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Calma chicha" }, { "max_speed_kmh": 12, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Mar en calma" }, { "max_speed_kmh": 16, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Ligero oleaje de frente" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Olas por viento de levante" }] },
    { "id": "diagonal", "dir_min_deg": 101, "dir_max_deg": 135, "thresholds": [{ "max_speed_kmh": 7, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Mar en calma" }, { "max_speed_kmh": 15, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Mar rizada suave" }, { "max_speed_kmh": 20, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Brisa tolerable" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Marejadilla molesta" }] },
    { "id": "parallel_or_other", "dir_min_deg": 0, "dir_max_deg": 360, "thresholds": [{ "max_speed_kmh": 7, "level": 1, "badge": "🟢 Excelente", "color": "#10B981", "desc": "Brisa imperceptible" }, { "max_speed_kmh": 15, "level": 1, "badge": "🟢 Bueno", "color": "#10B981", "desc": "Brisa paralela" }, { "max_speed_kmh": 22, "level": 2, "badge": "🟡 Aceptable", "color": "#F59E0B", "desc": "Viento moderado" }, { "max_speed_kmh": 999, "level": 3, "badge": "🟠 Difícil", "color": "#F97316", "desc": "Viento fuerte" }] }
  ]
};

const fallbackUITexts = {
  "header": { "title": "Pozo del Esparto", "location": "📍 Cuevas del Almanzora, Almería", "live_badge": "En Vivo" },
  "loader": { "loading_text": "Analizando viento, UV y oleaje multi-modelo..." },
  "offline_card": {
    "title": "Sin Conexión",
    "description": "No hemos podido obtener los datos y no hay información guardada en tu dispositivo. Por favor, conéctate a internet e inténtalo de nuevo.",
    "retry_button": "Reintentar"
  },
  "offline_indicator": { "label": "Mostrando predicción guardada (Sin conexión)" },
  "main_card": {
    "now_label": "AHORA",
    "forecast_prefix": "Previsión",
    "uv_prefix": "☀️ UV:",
    "wind_label": "💨 Viento (Orilla)",
    "wave_label": "🌊 Oleaje",
    "temp_label": "🌡️ Temp. Ambiente",
    "water_temp_label": "🏊 Temp. Agua",
    "gusts_label": "Rachas",
    "sparkline_title_prefix": "Tendencia del Viento"
  },
  "day_selector": { "day_0": "Hoy", "day_1": "Hoy+1", "day_2": "Hoy+2" },
  "hourly_section": {
    "title": "Evolución (08:00 - 23:00)",
    "optimal_badge": "✨ Óptimo",
    "refresh_button": "🔄 Refrescar Datos"
  }
};

async function loadRules() {
  const RULES_URL = './beach_rules.json';
  try {
    const fetchedRules = await fetchWithRetry(RULES_URL);
    if (fetchedRules && fetchedRules.rules && fetchedRules.global_wave_rules) {
      currentRulesConfig = fetchedRules;
      try {
        localStorage.setItem('pozometeo_rules', JSON.stringify(fetchedRules));
      } catch (e) {}
      return currentRulesConfig;
    }
  } catch (err) {
    console.warn('No se pudo descargar beach_rules.json, buscando en caché local...', err);
  }

  try {
    const cached = localStorage.getItem('pozometeo_rules');
    if (cached) {
      currentRulesConfig = JSON.parse(cached);
      return currentRulesConfig;
    }
  } catch (e) {}

  currentRulesConfig = fallbackRulesConfig;
  return currentRulesConfig;
}

function getRules() {
  return currentRulesConfig || fallbackRulesConfig;
}

async function loadUITexts() {
  const TEXTS_URL = './ui_texts.json';
  try {
    const fetchedTexts = await fetchWithRetry(TEXTS_URL);
    if (fetchedTexts) {
      uiTextsConfig = fetchedTexts;
      try {
        localStorage.setItem('pozometeo_texts', JSON.stringify(fetchedTexts));
      } catch (e) {}
      return fetchedTexts;
    }
  } catch (err) {
    console.warn('No se pudo descargar ui_texts.json, buscando en caché local...', err);
  }

  try {
    const cached = localStorage.getItem('pozometeo_texts');
    if (cached) {
      uiTextsConfig = JSON.parse(cached);
      return uiTextsConfig;
    }
  } catch (e) {}

  uiTextsConfig = fallbackUITexts;
  return fallbackUITexts;
}

function applyUITexts(texts) {
  if (!texts) return;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const keyPath = el.getAttribute('data-i18n').split('.');
    let val = texts;
    for (const key of keyPath) {
      if (val && val[key] !== undefined) {
        val = val[key];
      } else {
        val = null;
        break;
      }
    }
    if (val) el.textContent = val;
  });
}

async function initApp() {
  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('content').classList.add('hidden');
  document.getElementById('error-card').classList.add('hidden');
  document.getElementById('offline-indicator').classList.add('hidden');

  let isOffline = !navigator.onLine;

  try {
    const GENERAL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=temperature_2m,precipitation_probability,uv_index&timezone=Europe/Madrid&forecast_days=3';
    const WIND_MULTI_MODEL_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.245&longitude=-1.862&hourly=windspeed_10m,winddirection_10m,windgusts_10m&models=ecmwf_ifs04,gfs_seamless,icon_seamless&timezone=Europe/Madrid&forecast_days=3&wind_speed_unit=kmh';
    const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine?latitude=37.245&longitude=-1.862&hourly=wave_height,sea_surface_temperature&timezone=Europe/Madrid&forecast_days=3';

    // Siempre se aseguran y cargan las reglas y textos primero
    const [rulesConfig, fetchedTexts, generalDataRes, windDataRes, marineDataRes] = await Promise.all([
      loadRules(),
      loadUITexts(),
      fetchWithRetry(GENERAL_URL).catch(() => null),
      fetchWithRetry(WIND_MULTI_MODEL_URL).catch(() => null),
      fetchWithRetry(MARINE_URL).catch(() => null)
    ]);

    applyUITexts(uiTextsConfig);

    let generalData = generalDataRes;
    let windData = windDataRes;
    let marineData = marineDataRes;

    if (generalData && windData && marineData) {
      try {
        localStorage.setItem('pozometeo_api_cache', JSON.stringify({ generalData, windData, marineData }));
      } catch (e) {}
    } else {
      try {
        const cachedApi = localStorage.getItem('pozometeo_api_cache');
        if (cachedApi) {
          const parsed = JSON.parse(cachedApi);
          generalData = parsed.generalData;
          windData = parsed.windData;
          marineData = parsed.marineData;
          isOffline = true;
        }
      } catch (e) {}
    }

    if (!generalData || !generalData.hourly || !windData || !windData.hourly || !marineData || !marineData.hourly) {
      throw new Error("Invalid API Data");
    }

    if (isOffline) {
      document.getElementById('offline-indicator').classList.remove('hidden');
    }

    fetchedApiData = { generalData, windData, marineData, rulesConfig };
    
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');

    updateDayView(selectedDayIndex);

  } catch (error) {
    console.error("Error cargando datos:", error);
    document.getElementById('loader').classList.add('hidden');
    document.getElementById('error-card').classList.remove('hidden');
  }
}

function triggerSwipeAnimation(direction) {
  const container = document.getElementById('swipe-container');
  if (!container) return;
  
  container.classList.remove('animate-slide-from-right', 'animate-slide-from-left', 'animate-bounce-right', 'animate-bounce-left');
  container.style.transform = '';
  container.style.opacity = '';
  
  void container.offsetWidth;
  
  if (direction === 'left') {
    container.classList.add('animate-slide-from-right');
  } else if (direction === 'right') {
    container.classList.add('animate-slide-from-left');
  } else if (direction === 'bounce-left') {
    container.classList.add('animate-bounce-left');
  } else if (direction === 'bounce-right') {
    container.classList.add('animate-bounce-right');
  }

  setTimeout(() => {
    if (container) {
      container.classList.remove('animate-slide-from-right', 'animate-slide-from-left', 'animate-bounce-right', 'animate-bounce-left');
    }
  }, 400);
}

function selectDay(dayIndex, forcedDirection = null) {
  if (dayIndex === selectedDayIndex && !forcedDirection) return;

  const direction = forcedDirection || (dayIndex > selectedDayIndex ? 'left' : 'right');
  selectedDayIndex = dayIndex;

  triggerSwipeAnimation(direction);

  if (fetchedApiData) {
    updateDayView(selectedDayIndex);
  } else {
    initApp();
  }
}

function getGlobalMaxWind() {
  if (!fetchedApiData) return 20;
  const rules = fetchedApiData.rulesConfig || getRules();
  const factor = rules.beach_info ? rules.beach_info.wind_adjustment_factor || 1.125 : 1.125;
  let max = 20;
  for (let i = 0; i < 72; i++) {
    const speeds = [
      fetchedApiData.windData.hourly.windspeed_10m_ecmwf_ifs04[i],
      fetchedApiData.windData.hourly.windspeed_10m_gfs_seamless[i],
      fetchedApiData.windData.hourly.windspeed_10m_icon_seamless[i]
    ].filter(v => v !== null && v !== undefined);
    if (speeds.length > 0) {
      const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const adj = avg * factor;
      if (adj > max) max = adj;
    }
  }
  return parseFloat(max.toFixed(1));
}

function updateDayView(dayIndex) {
  if (!fetchedApiData) return;
  const { generalData, windData, marineData, rulesConfig } = fetchedApiData;
  const rules = rulesConfig || getRules();
  const currentHourReal = new Date().getHours();
  const dayOffset = dayIndex * 24;

  const hourlyForecast = [];
  for (let h = 8; h <= 23; h++) {
    const apiIndex = dayOffset + h;
    
    const speeds = [
      windData.hourly.windspeed_10m_ecmwf_ifs04 ? windData.hourly.windspeed_10m_ecmwf_ifs04[apiIndex] : undefined,
      windData.hourly.windspeed_10m_gfs_seamless ? windData.hourly.windspeed_10m_gfs_seamless[apiIndex] : undefined,
      windData.hourly.windspeed_10m_icon_seamless ? windData.hourly.windspeed_10m_icon_seamless[apiIndex] : undefined
    ].filter(v => v !== null && v !== undefined);

    const gusts = [
      windData.hourly.windgusts_10m_ecmwf_ifs04 ? windData.hourly.windgusts_10m_ecmwf_ifs04[apiIndex] : undefined,
      windData.hourly.windgusts_10m_gfs_seamless ? windData.hourly.windgusts_10m_gfs_seamless[apiIndex] : undefined,
      windData.hourly.windgusts_10m_icon_seamless ? windData.hourly.windgusts_10m_icon_seamless[apiIndex] : undefined
    ].filter(v => v !== null && v !== undefined);

    const dirs = [
      windData.hourly.winddirection_10m_ecmwf_ifs04 ? windData.hourly.winddirection_10m_ecmwf_ifs04[apiIndex] : undefined,
      windData.hourly.winddirection_10m_gfs_seamless ? windData.hourly.winddirection_10m_gfs_seamless[apiIndex] : undefined,
      windData.hourly.winddirection_10m_icon_seamless ? windData.hourly.winddirection_10m_icon_seamless[apiIndex] : undefined
    ].filter(v => v !== null && v !== undefined);

    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const avgGust = gusts.length > 0 ? gusts.reduce((a, b) => a + b, 0) / gusts.length : null;

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
    const waterTemp = marineData.hourly.sea_surface_temperature && marineData.hourly.sea_surface_temperature[apiIndex] !== undefined ? marineData.hourly.sea_surface_temperature[apiIndex] : null;

    const finalSpeed = parseFloat(avgSpeed.toFixed(1));
    const finalGust = avgGust != null ? parseFloat(avgGust.toFixed(1)) : null;
    const finalDir = Math.round(avgDir);

    const evalResult = evaluateStatus(finalSpeed, finalDir, wave, rules, finalGust);
    hourlyForecast.push({ hour: h, speed: finalSpeed, gust: finalGust, dir: finalDir, temp, rain, uv, wave, waterTemp, ...evalResult });
  }

  currentForecastData = hourlyForecast;
  renderUI(hourlyForecast, currentHourReal, dayIndex);
  drawSparkline(currentForecastData, getGlobalMaxWind());
}

function evaluateStatus(speed, dir, wave, config, gust = null) {
  const rules = config || getRules();
  const factor = rules.beach_info ? rules.beach_info.wind_adjustment_factor : 1.125;
  const adjSpeed = speed * factor;
  const adjGust = gust != null ? parseFloat((gust * factor).toFixed(1)) : null;
  const waveRule = rules.global_wave_rules.find(w => wave <= w.max_height_m) || rules.global_wave_rules[rules.global_wave_rules.length - 1];
  
  let windRule = rules.rules.find(r => r.id !== "parallel_or_other" && dir >= r.dir_min_deg && dir <= r.dir_max_deg);
  if (!windRule) windRule = rules.rules.find(r => r.id === "parallel_or_other");
  const windThreshold = windRule.thresholds.find(t => adjSpeed <= t.max_speed_kmh) || windRule.thresholds[windRule.thresholds.length - 1];

  if (waveRule.level > windThreshold.level) {
    return { badge: waveRule.badge, desc: waveRule.desc, color: waveRule.color, adjSpeed: adjSpeed.toFixed(1), adjGust: adjGust != null ? adjGust.toFixed(1) : null };
  } else {
    return { badge: windThreshold.badge, desc: windThreshold.desc, color: windThreshold.color, adjSpeed: adjSpeed.toFixed(1), adjGust: adjGust != null ? adjGust.toFixed(1) : null };
  }
}

function getWindArrowSVG(dir, sizePx = 20, strokeColor = "currentColor") {
  return `<svg style="width:${sizePx}px; height:${sizePx}px; transform: rotate(${dir}deg); display: inline-block; vertical-align: middle; flex-shrink: 0; stroke: ${strokeColor}; transition: transform 0.3s ease;" fill="none" stroke-width="2.8" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="3" x2="12" y2="21"></line><polyline points="19 14 12 21 5 14"></polyline></svg>`;
}

function renderUI(forecast, currentHourReal, dayIndex) {
  const texts = uiTextsConfig || fallbackUITexts;
  const getFormattedDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const day = d.getDate();
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    return `${day} ${months[d.getMonth()]}`;
  };
  const dayNames = [
    (texts.day_selector && texts.day_selector.day_0) || 'Hoy',
    (texts.day_selector && texts.day_selector.day_1) || 'Hoy+1',
    (texts.day_selector && texts.day_selector.day_2) || 'Hoy+2'
  ];
  const isToday = (dayIndex === 0);

  let activeForecast = forecast.find(f => f.hour === currentHourReal && isToday);
  if (!activeForecast) activeForecast = forecast[0];

  const gustsLabel = texts.main_card && texts.main_card.gusts_label ? texts.main_card.gusts_label : 'Rachas';

  document.getElementById('main-status-card').style.backgroundColor = activeForecast.color;
  document.getElementById('card-time').textContent = isToday && currentHourReal >= 8 && currentHourReal <= 23 ? texts.main_card.now_label : `${texts.main_card.forecast_prefix} ${activeForecast.hour}:00h`;
  document.getElementById('card-badge').textContent = activeForecast.badge;
  document.getElementById('card-desc').textContent = activeForecast.desc;
  
  document.getElementById('card-wind').innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <span>${activeForecast.adjSpeed} <span class="text-sm font-normal opacity-70">km/h</span></span>
      <span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 9999px; background-color: rgba(255, 255, 255, 0.25); box-shadow: 0 1px 3px rgba(0,0,0,0.15);" title="Dirección del viento: ${activeForecast.dir}°">
        ${getWindArrowSVG(activeForecast.dir, 24, "#ffffff")}
      </span>
    </span>
  `;
  document.getElementById('card-wave').textContent = `${activeForecast.wave} m`;
  document.getElementById('card-temp').textContent = activeForecast.temp != null ? `${activeForecast.temp}°C` : '-- °C';
  document.getElementById('card-water-temp').textContent = activeForecast.waterTemp != null ? `${activeForecast.waterTemp.toFixed(1)}°C` : '-- °C';

  const uvElement = document.getElementById('card-uv');
  uvElement.textContent = `${texts.main_card.uv_prefix} ${Math.round(activeForecast.uv)}`;
  uvElement.className = activeForecast.uv > 7 ? "text-xs font-bold bg-red-500 text-white px-2 py-1 rounded shadow-sm" : "text-xs font-bold bg-amber-500/90 text-white px-2 py-1 rounded shadow-sm"; 

  const sparklineTitle = document.getElementById('sparkline-title');
  if (sparklineTitle) {
    sparklineTitle.textContent = `${texts.main_card.sparkline_title_prefix} ${dayNames[dayIndex] || dayNames[0]}`;
  }

  // Update Day Selector Buttons
  [0, 1, 2].forEach(i => {
    const btn = document.getElementById(`btn-day-${i}`);
    if (btn) {
      btn.textContent = dayNames[i] || `Día ${i}`;
      if (i === dayIndex) {
        btn.className = "px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-bold bg-[#0072ce] text-white shadow-xs transition-all cursor-pointer";
      } else {
        btn.className = "px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 transition-all cursor-pointer";
      }
    }
  }); 

  const listContainer = document.getElementById('hourly-list');
  listContainer.innerHTML = '';

  forecast.forEach(item => {
    const isCurrent = item.hour === currentHourReal && isToday;
    const isOptimal = item.hour >= 8 && item.hour <= 10;
    
    const row = document.createElement('div');
    row.className = `p-3 sm:px-6 sm:py-4 flex items-center justify-between transition-colors ${isCurrent ? 'bg-blue-50/80 border-l-4 border-[#0072ce]' : 'hover:bg-slate-50'}`;

    row.innerHTML = `
      <div class="flex items-center space-x-3 sm:space-x-4 w-1/2">
        <div class="flex flex-col items-center">
          <span class="text-sm sm:text-base font-bold text-slate-700">${String(item.hour).padStart(2, '0')}:00</span>
        </div>
        <div>
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-sm sm:text-base font-bold text-slate-900">${item.badge}</span>
            ${isOptimal ? `<span class="text-xs sm:text-sm bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-sm mt-0.5 border border-amber-200">${texts.hourly_section.optimal_badge}</span>` : ''}
          </div>
          <p class="text-sm sm:text-base text-slate-600 font-medium leading-normal mt-0.5 sm:mt-1">${item.desc}</p>
        </div>
      </div>
      <div class="text-right text-sm sm:text-base w-1/2 flex flex-col items-end justify-center space-y-1">
        <div class="w-full text-right font-bold text-slate-800 text-sm sm:text-base">
          <span class="align-middle mr-1.5" style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 9999px; background-color: rgba(0, 114, 206, 0.15); color: #0072ce;" title="Dirección del viento: ${item.dir}°">
            ${getWindArrowSVG(item.dir, 14, "#0072ce")}
          </span>
          <span class="align-middle">${item.adjSpeed} <span class="font-normal text-slate-500">km/h</span>${item.adjGust != null ? ` <span class="text-xs sm:text-sm font-normal text-slate-500">| ${item.adjGust} km/h</span>` : ''}</span>
        </div>
        <div class="w-full text-right font-bold text-slate-800 text-sm sm:text-base">
          🌊 ${item.wave} m${item.waterTemp != null ? ` <span class="text-xs sm:text-sm font-normal text-slate-500">| ${item.waterTemp.toFixed(1)}°C</span>` : ''}
        </div>
        <p class="w-full text-right text-slate-500 text-xs sm:text-sm">🌡️ <span class="font-bold text-slate-700">${item.temp}°C</span> | UV: ${Math.round(item.uv)}</p>
      </div>
    `;
    listContainer.appendChild(row);
  });
}

function drawSparkline(forecast, fixedMaxWind) {
  const canvas = document.getElementById('sparkline');
  if (!canvas || !forecast || forecast.length === 0) return;
  const parent = canvas.parentElement;
  if (!parent || parent.clientWidth === 0 || parent.clientHeight === 0) return;

  const ctx = canvas.getContext('2d');
  
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  const width = canvas.width, height = canvas.height;
  
  const maxWind = fixedMaxWind || getGlobalMaxWind();
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

window.addEventListener('resize', () => drawSparkline(currentForecastData, getGlobalMaxWind()));

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

let touchStartX = 0;
let touchStartY = 0;
let isTouchDragging = false;
const SWIPE_THRESHOLD = 40; // px

window.addEventListener('touchstart', (e) => {
  const touchObj = (e.touches && e.touches.length > 0) ? e.touches[0] : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0] : null);
  if (touchObj) {
    touchStartX = touchObj.screenX;
    touchStartY = touchObj.screenY;
    isTouchDragging = false;
    
    const container = document.getElementById('swipe-container');
    if (container) {
      container.classList.remove('animate-slide-from-right', 'animate-slide-from-left', 'animate-bounce-right', 'animate-bounce-left');
      container.style.transition = 'none';
    }
  }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
  if (!e.touches || e.touches.length === 0) return;
  const currentX = e.touches[0].screenX;
  const currentY = e.touches[0].screenY;
  
  const deltaX = currentX - touchStartX;
  const deltaY = currentY - touchStartY;

  if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
    isTouchDragging = true;
    const container = document.getElementById('swipe-container');
    if (container) {
      let offset = deltaX * 0.35;
      if ((selectedDayIndex === 0 && deltaX > 0) || (selectedDayIndex === 2 && deltaX < 0)) {
        offset = deltaX * 0.12;
      }
      container.style.transform = `translateX(${offset}px)`;
      container.style.opacity = `${Math.max(0.6, 1 - Math.abs(offset) / 350)}`;
    }
  }
}, { passive: true });

window.addEventListener('touchend', (e) => {
  const container = document.getElementById('swipe-container');
  if (container) {
    container.style.transition = '';
    container.style.transform = '';
    container.style.opacity = '';
  }

  const touchObj = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : null;
  if (!touchObj) return;

  const touchEndX = touchObj.screenX;
  const touchEndY = touchObj.screenY;
  
  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;
  
  if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
    if (deltaX < 0) {
      if (selectedDayIndex < 2) {
        selectDay(selectedDayIndex + 1, 'left');
      } else {
        triggerSwipeAnimation('bounce-left');
      }
    } else {
      if (selectedDayIndex > 0) {
        selectDay(selectedDayIndex - 1, 'right');
      } else {
        triggerSwipeAnimation('bounce-right');
      }
    }
  }
}, { passive: true });

window.addEventListener('DOMContentLoaded', initApp);
