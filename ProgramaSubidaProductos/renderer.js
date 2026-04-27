const estado = {
  filePath: "",
  rows: [],
  token: "",
  usuario: null,
};

const LOGIN_ROUTES = [
  "/api/auth/login",
  "/api/login",
  "/login",
  "/auth/login",
];

const seleccionarBtn = document.getElementById("seleccionarExcel");
const importarBtn = document.getElementById("importarProductos");
const iniciarSesionBtn = document.getElementById("iniciarSesion");
const fileInfo = document.getElementById("fileInfo");
const tablaPreview = document.getElementById("tablaPreview");
const logArea = document.getElementById("logArea");
const authStatus = document.getElementById("authStatus");
const apiUrlInput = document.getElementById("apiUrl");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const columnasBase = [
  { key: "codigo_interno", label: "Codigo interno" },
  { key: "codigo_barra_externo", label: "Codigo de barra" },
  { key: "nombre", label: "Nombre" },
  { key: "unidad", label: "Unidad" },
  { key: "precio_venta", label: "Precio venta" },
  { key: "id_categoria", label: "ID categoria" },
  { key: "impuesto_especifico", label: "Impuesto especifico" },
];

seleccionarBtn.addEventListener("click", async () => {
  limpiarLog();

  try {
    const resultado = await window.electronAPI.seleccionarExcel();

    if (resultado.canceled) {
      agregarLog("Seleccion de archivo cancelada.");
      return;
    }

    estado.filePath = resultado.filePath;
    estado.rows = resultado.rows || [];
    mostrarInfoArchivo(resultado);
    renderizarMapeo(resultado.columnas || []);
    renderizarPreview();
    importarBtn.disabled = false;
    agregarLog(`Archivo cargado: ${resultado.totalFilas} filas detectadas.`);
  } catch (error) {
    agregarLog(`Error al abrir el archivo: ${error.message}`, true);
  }
});

iniciarSesionBtn.addEventListener("click", async () => {
  limpiarLog();

  try {
    await autenticar();
    agregarLog("Sesion iniciada correctamente.");
  } catch (error) {
    agregarLog(error.message, true);
  }
});

importarBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim();

  if (!estado.rows.length) {
    agregarLog("Primero debes cargar un archivo Excel.", true);
    return;
  }

  if (!apiUrl) {
    agregarLog("Debes indicar la URL base del servidor.", true);
    return;
  }

  if (!estado.token) {
    try {
      agregarLog("No hay sesion activa. Intentando iniciar sesion...");
      await autenticar();
      agregarLog("Sesion iniciada. Continuando con la importacion.");
    } catch (error) {
      agregarLog(error.message, true);
      return;
    }
  }

  const mapeo = obtenerMapeo();
  const filasTransformadas = transformarFilas(estado.rows, mapeo);

  if (!filasTransformadas.length) {
    agregarLog("No hay filas validas para importar.", true);
    return;
  }

  importarBtn.disabled = true;
  seleccionarBtn.disabled = true;
  iniciarSesionBtn.disabled = true;
  limpiarLog();
  agregarLog(`Iniciando carga de ${filasTransformadas.length} productos...`);

  let exitosos = 0;
  let errores = 0;

  for (let index = 0; index < filasTransformadas.length; index += 1) {
    const producto = filasTransformadas[index];

    try {
      const response = await fetch(`${normalizarBaseUrl(apiUrl)}/api/productos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${estado.token}`,
        },
        body: JSON.stringify(producto),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        errores += 1;

        if (response.status === 401 || response.status === 403) {
          limpiarSesion();
          actualizarEstadoSesion("La sesion expiro o el token fue rechazado.", "error");
        }

        agregarLog(
          `Fila ${index + 2}: error ${response.status} - ${data.error || "No se pudo crear el producto."}`,
          true
        );
        continue;
      }

      exitosos += 1;
      agregarLog(`Fila ${index + 2}: producto "${producto.nombre}" creado correctamente.`);
    } catch (error) {
      errores += 1;
      agregarLog(`Fila ${index + 2}: fallo de conexion - ${error.message}`, true);
    }
  }

  agregarLog(`Proceso terminado. Exitosos: ${exitosos}. Errores: ${errores}.`);
  importarBtn.disabled = false;
  seleccionarBtn.disabled = false;
  iniciarSesionBtn.disabled = false;
});

apiUrlInput.addEventListener("change", limpiarSesion);
usernameInput.addEventListener("change", limpiarSesion);
passwordInput.addEventListener("change", limpiarSesion);

async function autenticar() {
  const apiUrl = apiUrlInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!apiUrl) {
    throw new Error("Debes indicar la URL base del servidor.");
  }

  if (!username || !password) {
    throw new Error("Debes ingresar usuario y contrasena para iniciar sesion.");
  }

  iniciarSesionBtn.disabled = true;
  actualizarEstadoSesion("Iniciando sesion...", "");

  try {
    const data = await intentarLoginEnRutas(apiUrl, username, password);

    if (!data?.token) {
      throw new Error("La API respondio sin token JWT.");
    }

    estado.token = data.token;
    estado.usuario = data.usuario || { username };

    const nombreUsuario = estado.usuario.username || username;
    const rolUsuario = estado.usuario.rol ? ` (${estado.usuario.rol})` : "";
    actualizarEstadoSesion(`Sesion iniciada como ${nombreUsuario}${rolUsuario}.`, "ok");
    return data;
  } catch (error) {
    limpiarSesion();
    actualizarEstadoSesion(error.message, "error");
    throw error;
  } finally {
    iniciarSesionBtn.disabled = false;
  }
}

async function intentarLoginEnRutas(apiUrl, username, password) {
  const errores = [];

  for (const route of LOGIN_ROUTES) {
    const loginUrl = `${normalizarBaseUrl(apiUrl)}${route}`;

    try {
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const mensaje = data.error || data.mensaje || `Error ${response.status}`;
        errores.push(`${route}: ${mensaje}`);
        continue;
      }

      return data;
    } catch (error) {
      errores.push(`${route}: ${error.message}`);
    }
  }

  throw new Error(
    `No se pudo iniciar sesion. Rutas probadas: ${errores.join(" | ")}`
  );
}

function limpiarSesion() {
  estado.token = "";
  estado.usuario = null;
  actualizarEstadoSesion("Sesion no iniciada.", "");
}

function actualizarEstadoSesion(texto, tipo) {
  authStatus.textContent = texto;
  authStatus.className = "auth-status";

  if (tipo) {
    authStatus.classList.add(tipo);
  }
}

function mostrarInfoArchivo(resultado) {
  fileInfo.innerHTML = `
    <div><strong>Archivo:</strong> ${resultado.filePath}</div>
    <div><strong>Hoja:</strong> ${resultado.sheetName}</div>
    <div><strong>Filas:</strong> ${resultado.totalFilas}</div>
  `;
}

function renderizarMapeo(columnas) {
  const contenedor = document.getElementById("mapeoColumnas");
  contenedor.innerHTML = "";

  columnasBase.forEach((campo) => {
    const wrapper = document.createElement("label");
    wrapper.className = "mapping-item";

    const titulo = document.createElement("span");
    titulo.textContent = campo.label;

    const select = document.createElement("select");
    select.dataset.target = campo.key;

    const vacio = document.createElement("option");
    vacio.value = "";
    vacio.textContent = "Seleccionar columna";
    select.appendChild(vacio);

    columnas.forEach((columna) => {
      const option = document.createElement("option");
      option.value = columna;
      option.textContent = columna;
      if (normalizarTexto(columna) === normalizarTexto(campo.key)) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    wrapper.appendChild(titulo);
    wrapper.appendChild(select);
    contenedor.appendChild(wrapper);
  });
}

function renderizarPreview() {
  const columnas = estado.rows.length ? Object.keys(estado.rows[0]) : [];

  if (!columnas.length) {
    tablaPreview.innerHTML = "<p>No se encontraron datos para previsualizar.</p>";
    return;
  }

  const thead = `<thead><tr>${columnas.map((col) => `<th>${escapeHtml(col)}</th>`).join("")}</tr></thead>`;
  const tbody = estado.rows
    .slice(0, 8)
    .map(
      (fila) =>
        `<tr>${columnas.map((col) => `<td>${escapeHtml(fila[col] ?? "")}</td>`).join("")}</tr>`
    )
    .join("");

  tablaPreview.innerHTML = `<table>${thead}<tbody>${tbody}</tbody></table>`;
}

function obtenerMapeo() {
  const selects = document.querySelectorAll("#mapeoColumnas select");
  const mapeo = {};

  selects.forEach((select) => {
    mapeo[select.dataset.target] = select.value;
  });

  return mapeo;
}

function transformarFilas(rows, mapeo) {
  return rows
    .map((row) => ({
      codigo_interno: leerValor(row, mapeo.codigo_interno),
      codigo_barra_externo: leerValor(row, mapeo.codigo_barra_externo),
      nombre: leerValor(row, mapeo.nombre),
      unidad: leerValor(row, mapeo.unidad) || "UN",
      precio_venta: convertirNumero(leerValor(row, mapeo.precio_venta)),
      id_categoria: convertirNumero(leerValor(row, mapeo.id_categoria)),
      impuesto_especifico: convertirNumero(leerValor(row, mapeo.impuesto_especifico) || 0),
    }))
    .filter((producto) => producto.nombre && producto.id_categoria);
}

function leerValor(row, columna) {
  if (!columna) {
    return "";
  }

  return String(row[columna] ?? "").trim();
}

function convertirNumero(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return 0;
  }

  const limpio = String(valor).replace(/\./g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isNaN(numero) ? 0 : numero;
}

function normalizarBaseUrl(url) {
  let baseUrl = url.trim();

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  if (baseUrl.endsWith("/api")) {
    baseUrl = baseUrl.slice(0, -4);
  }

  return baseUrl;
}

function normalizarTexto(valor) {
  return String(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function escapeHtml(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function agregarLog(texto, error = false) {
  const item = document.createElement("div");
  item.className = error ? "log-item error" : "log-item";
  item.textContent = texto;
  logArea.prepend(item);
}

function limpiarLog() {
  logArea.innerHTML = "";
}
