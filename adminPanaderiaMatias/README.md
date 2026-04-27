# Admin Panaderia Matias

Base inicial del panel administrativo en Electron con Tailwind.

## Tecnologias

- Electron
- Tailwind CSS
- JavaScript modular en renderer

## Estructura

- `main.js`: proceso principal de Electron
- `preload.js`: puente seguro entre Electron y la ventana
- `src/renderer/app.js`: entrada principal del frontend
- `src/renderer/modules`: vistas por modulo
- `src/renderer/services`: cliente API y servicios por recurso
- `src/renderer/state`: manejo de sesion
- `src/renderer/styles`: Tailwind de entrada y CSS compilado
- `src/renderer/utils`: utilidades compartidas

## Modulos iniciales

- Login
- Dashboard
- Productos
- Inventario
- Reportes

## Scripts

- `npm start`: compila Tailwind y abre Electron
- `npm run build:css`: recompila estilos

## Nota importante

En este equipo existia la variable `ELECTRON_RUN_AS_NODE=1`, lo que impedia abrir la app.  
El script `npm start` ya la limpia automaticamente antes de ejecutar Electron.
