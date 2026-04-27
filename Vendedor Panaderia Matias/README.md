# Vendedor Panadería Matías

Terminal de ventas para el personal de Panadería Matías, construida en Electron con Tailwind.

## Tecnologías

- Electron
- Tailwind CSS
- JavaScript modular en renderer

## Estructura

- `main.js`: proceso principal de Electron
- `preload.js`: puente seguro entre Electron y la ventana
- `src/renderer/app.js`: entrada principal del frontend
- `src/renderer/config.js`: URL del servidor API
- `src/renderer/modules`: vistas por módulo
- `src/renderer/services`: cliente API y servicios por recurso
- `src/renderer/state`: manejo de sesión
- `src/renderer/styles`: Tailwind de entrada y CSS compilado
- `src/renderer/utils`: utilidades compartidas

## Módulos principales

- Login
- Punto de venta
- Historial de tickets
- Caja y turnos
- Productos

## Scripts

- `npm start`: compila Tailwind y abre Electron
- `npm run build:css`: recompila estilos
- `npm run dist`: genera el instalador de Windows

## Configuración de API

La URL del backend se cambia en `src/renderer/config.js`:

```js
window.APP_CONFIG = {
  API_BASE_URL: 'http://64.176.20.67:3000/api'
};
```

Para usar un servidor local, cambia ese valor por algo como `http://localhost:3000/api`.

## Nota importante

En este equipo existía la variable `ELECTRON_RUN_AS_NODE=1`, lo que impedía abrir la app.  
El script `npm start` ya la limpia automáticamente antes de ejecutar Electron.
