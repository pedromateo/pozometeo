# 🏖️ PozoMeteo - Estado del Baño (Pozo del Esparto)

Aplicación Web Progresiva (**PWA**) *Client-Only* para consultar en tiempo real el estado del baño en la playa de **Pozo del Esparto** (Cuevas del Almanzora, Almería).

## 🚀 Características
- **Predicción Multi-Modelo (Ensemble):** Combina datos de **ECMWF**, **GFS** e **ICON** para mayor precisión en velocidad (media aritmética) y dirección del viento (media vectorial/trigonométrica).
- **Evaluador Híbrido:** Revisa tanto el viento ajustado en orilla (+12.5%) como el oleaje marino (*mar de fondo*), priorizando la regla más restrictiva.
- **Gráfico de Tendencia (Sparkline):** Dibujado dinámicamente en HTML5 Canvas.
- **Soporte Offline (PWA):** Service Worker con caché local de recursos y respuestas para cuando estés en la playa sin cobertura.

## 📦 Estructura del Proyecto
- [`index.html`](./index.html): Interfaz visual responsive.
- [`app.js`](./app.js): Lógica de cálculo multi-modelo, evaluación de riesgo y renderizado.
- [`beach_rules.json`](./beach_rules.json): Reglas de dirección de viento y altura de oleaje.
- [`manifest.json`](./manifest.json): Configuración del Manifiesto PWA.
- [`sw.js`](./sw.js): Service Worker para soporte offline.
- [`test.js`](./test.js): Test automatizado con JSDOM.

## 🛠️ Publicación en GitHub Pages

Este repositorio está preparado para desplegarse automáticamente en **GitHub Pages**:

1. En GitHub, ve a **Settings** > **Pages** de este repositorio.
2. En **Build and deployment** > **Source**, selecciona **GitHub Actions** (o *Deploy from a branch* apuntando a `main` / root `/`).
3. Al hacer push a la rama `main`, la web se actualizará y estará accesible públicamente.

## 🧪 Pruebas Locales
Para ejecutar la suite de pruebas locales:
```bash
npm install
npm test
```
