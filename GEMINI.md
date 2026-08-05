# 🏖️ PozoMeteo — Contexto para Gemini / Antigravity

> **INSTRUCCIÓN DE CARGA INICIAL PARA ASISTENTES IA (GEMINI / ANTIGRAVITY):**
> Este fichero es la **fuente única de verdad** del proyecto. Debe cargarse y consultarse obligatoriamente al inicio de cada sesión de trabajo para conocer el rol, la arquitectura, el stack y las reglas de negocio de PozoMeteo.

---

## 📌 1. Visión General del Proyecto
**PozoMeteo** es una Aplicación Web Progresiva (**PWA**) *Client-Only* diseñada para evaluar y mostrar en tiempo real las condiciones del mar y el estado del baño en la playa de **Pozo del Esparto** (Cuevas del Almanzora, Almería, España).

- **Coordenadas GPS de referencia:** Latitud `37.245`, Longitud `-1.862`.
- **Estrategia PWA:** Funciona offline en la playa gracias a un Service Worker (`sw.js`) que combina estrategias *Stale-While-Revalidate* para datos meteorológicos de la API de Open-Meteo y *Cache-First* para assets estáticos.

---

## 🛠️ 2. Stack Tecnológico y Arquitectura
- **HTML / UI:** `index.html` — Layout semántico responsive, optimizado para dispositivos móviles y escritorio, soporte para Dark Mode (`slate-900`).
- **Lógica de Negocio (Vanilla JS):** `app.js` — Sin frameworks ni librerías pesadas. Control de ciclo de vida, consultas API asíncronas con reintentos (`fetchWithRetry`), cálculos de ensamble meteorológico, evaluación de reglas y renderizado DOM.
- **Estilos CSS:** `style.css` (generado desde `input.css` / Tailwind CSS) — Diseño dinámico, glassmorphism, badges de color contextuales, animaciones de carga y transiciones fluidas.
- **Motor de Reglas y Textos:** `beach_rules.json` (reglas y umbrales) y `ui_texts.json` (textos de la interfaz desacoplados del código para fácil modificación).
- **PWA & Offline:** `manifest.json` y `sw.js` — Service Worker nativo para instalación en pantalla de inicio e interacción offline.
- **Visualización Gráfica:** HTML5 `<canvas id="sparkline">` para dibujar tendencias de viento sin librerías externas.
- **Pruebas / Verificación:** `test.js` — Pruebas de integración nativas mediante `jsdom`.

---

## ⚙️ 3. Reglas de Negocio y Lógica Meteorológica (Multi-Modelo)

### 3.1. Ensamble Multi-Modelo de Viento
Para lograr máxima precisión, el sistema realiza peticiones simultáneas a 3 modelos globales de predicción meteorológica (Open-Meteo API):
1. **ECMWF** (`ecmwf_ifs04`)
2. **GFS** (`gfs_seamless`)
3. **ICON** (`icon_seamless`)

- **Velocidad del viento:** Se calcula como la media aritmética de los tres modelos:
  $$\text{Velocidad Media} = \frac{v_{\text{ecmwf}} + v_{\text{gfs}} + v_{\text{icon}}}{3}$$
- **Ajuste de Orilla (Shore Factor):** `wind_adjustment_factor = 1.125` (+12.5% sobre la velocidad media para prever rachas en la linde del agua).
- **Dirección del viento:** Se calcula mediante la **media vectorial/trigonométrica** (para evitar fallos en el cambio 359° ↔ 0°):
  $$\bar{X} = \sum \cos(\theta_i), \quad \bar{Y} = \sum \sin(\theta_i), \quad \bar{\theta} = \text{atan2}(\bar{Y}, \bar{X}) \pmod{360^\circ}$$

### 3.2. Evaluador Híbrido de Seguridad del Baño
El sistema compara el nivel de riesgo entre:
1. **Oleaje Marino (Mar de fondo):** Según altura de ola (`wave_height` en metros) definida en `global_wave_rules`.
2. **Viento Ajustado en Orilla:** Clasificado por cuadrante de dirección:
   - **Tierra/Terral (Offshore: 270°-330°):** Mar plano, baño excelente.
   - **Levante / Perpendicular (60°-100°):** Genera ola de frente.
   - **Diagonal (101°-135°):** Brisa diagonal / marejadilla.
   - **Paralelo / Otros (0°-360°):** Viento lateral.

**Principio de Prudencia:** En caso de discrepancia entre viento y oleaje, el sistema aplica **siempre la regla más restrictiva** (la de mayor nivel de riesgo / peligro).

---

## 📂 4. Mapa del Repositorio

```
pozometeo/
├── GEMINI.md          # Fichero único de contexto para Gemini / Antigravity (este archivo)
├── index.html         # Interfaz visual responsive y contenedores dinámicos
├── app.js             # Lógica multi-modelo, fetch con reintentos, evaluador híbrido y sparkline canvas
├── beach_rules.json   # Configuración y umbrales de seguridad (viento y oleaje)
├── ui_texts.json      # Todos los textos de la interfaz de usuario personalizables
├── style.css          # Estilos optimizados y utilidades visuales
├── input.css          # Fichero fuente de estilos
├── manifest.json      # Configuración de PWA (iconos, tema, display standalone)
├── sw.js              # Service Worker (Caché Stale-While-Revalidate y Cache-First)
├── test.js            # Pruebas automatizadas con JSDOM
├── package.json       # Configuración de dependencias (jsdom) y scripts de prueba
├── PLAN.md            # Planificación detallada y arquitectura v3.0
└── README.md          # Guía rápida del usuario y despliegue en GitHub Pages
```

---

## 📋 5. Instrucciones de Desarrollo y Reglas Globales

Al modificar o expandir este proyecto:
1. **Preservar el desacoplamiento:** No hardcodear reglas de viento u oleaje en `app.js`; utilizar o modificar `beach_rules.json`.
2. **Mantener la filosofía Vanilla / Zero-Dependencies en el cliente:** Toda la UI debe funcionar directamente en el navegador sin bundling ni compilación obligatoria.
3. **Respetar la resiliencia offline:** Si añades assets estáticos (imágenes, fuentes, css), agrégalos al array `ASSETS` en `sw.js`.
4. **Optimización Móvil:** Toda respuesta y elemento UI debe estar diseñado pensando prioritariamente en pantallas estrechas / dispositivos móviles.
5. **Verificación de cambios:** Comprobar la sintaxis y comportamiento mediante `test.js` o inspección directa en el navegador.

---
*Fichero único de contexto unificado.*
