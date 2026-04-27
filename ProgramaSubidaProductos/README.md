# Programa Subida Productos

Aplicacion de escritorio hecha con Electron para importar productos desde un archivo Excel a tu API.

## Que hace

- Lee la primera hoja de un archivo `.xlsx` o `.xls`.
- Muestra una vista previa de las filas detectadas.
- Permite mapear columnas del Excel hacia los campos que espera tu endpoint.
- Pide usuario y contrasena para iniciar sesion y obtener el JWT automaticamente.
- Envia cada fila por `POST` a `http://64.176.20.67:3000/api/productos`.
- Usa el token JWT recibido en el header `Authorization: Bearer TOKEN`.

## Campos soportados

- `codigo_interno`
- `codigo_barra_externo`
- `nombre`
- `unidad`
- `precio_venta`
- `id_categoria`
- `impuesto_especifico`

## Requisitos

- Node.js instalado
- Tu API corriendo
- Un usuario valido con permisos para crear productos

## Ejecutar

```bash
npm install
npm start
```

## Login automatico

La app intenta iniciar sesion con `username` y `password` probando estas rutas comunes:

- `/api/auth/login`
- `/api/login`
- `/login`
- `/auth/login`

Si tu backend usa una de esas rutas y responde con un JSON que contiene `token`, la sesion queda lista automaticamente para importar.

## URL recomendada

Usa como URL base:

```text
http://64.176.20.67:3000
```

No hace falta agregar `/api` manualmente. Si lo escribes, la app lo corrige automaticamente.

## Formato recomendado del Excel

La primera fila debe contener los nombres de las columnas. Ejemplo:

| codigo_interno | codigo_barra_externo | nombre | unidad | precio_venta | id_categoria | impuesto_especifico |
|---|---|---|---|---:|---:|---:|
| PAN001 | 7801234567890 | Hallulla | UN | 1200 | 1 | 0 |
| PAN002 | 7801234567891 | Marraqueta | UN | 1500 | 1 | 0 |

No es obligatorio que los nombres sean iguales, porque la app deja mapear las columnas manualmente.

## Notas

- Si `unidad` viene vacia, la app usa `UN`.
- Si `impuesto_especifico` viene vacio, la app envia `0`.
- La app filtra filas sin `nombre` o sin `id_categoria`.
