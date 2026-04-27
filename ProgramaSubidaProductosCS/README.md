# Programa Subida Productos CS

Aplicacion de Windows Forms para importar productos desde un archivo Excel `.xlsx` hacia tu API.

## Como usar

1. Ejecuta la app.
2. Escribe la URL base de tu servidor, por ejemplo `http://64.176.20.67:3000`.
3. Ingresa `usuario` y `contrasena`.
4. Selecciona el archivo Excel.
5. Revisa el mapeo de columnas.
6. Haz clic en `Importar productos`.

La app enviara cada fila al endpoint:

```text
POST /api/productos
Authorization: Bearer TU_TOKEN
Content-Type: application/json
```

URL base recomendada:

```text
http://64.176.20.67:3000
```

No hace falta agregar `/api` manualmente. Si lo escribes, la app lo corrige automaticamente.

Antes de importar, la app intenta iniciar sesion automaticamente y obtener el JWT probando estas rutas comunes:

- `/api/auth/login`
- `/api/login`
- `/login`
- `/auth/login`

## Campos que envia

- `codigo_interno`
- `codigo_barra_externo`
- `nombre`
- `unidad`
- `precio_venta`
- `id_categoria`
- `impuesto_especifico`

## Ejecutar

```bash
dotnet run
```

## Publicar EXE

```bash
dotnet publish -c Release -r win-x64 --self-contained true
```

El ejecutable quedara dentro de `bin\\Release\\net8.0-windows\\win-x64\\publish`.

## Formato sugerido del Excel

La primera fila debe ser el encabezado. La app toma la primera hoja del archivo y deja mapear columnas aunque tengan nombres distintos.

Ejemplo:

| codigo_interno | codigo_barra_externo | nombre | unidad | precio_venta | id_categoria | impuesto_especifico |
|---|---|---|---|---:|---:|---:|
| PAN001 | 7801234567890 | Hallulla | UN | 1200 | 1 | 0 |
