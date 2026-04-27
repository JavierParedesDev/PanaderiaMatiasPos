using System.Globalization;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;

namespace ProgramaSubidaProductosCS;

public partial class Form1 : Form
{
    private readonly HttpClient _httpClient = new();
    private readonly List<Dictionary<string, string>> _rows = [];
    private readonly List<string> _headers = [];
    private readonly Dictionary<string, ComboBox> _mappingSelectors = [];
    private readonly List<DuplicateReviewItem> _lastDuplicateReview = [];
    private readonly List<PreparedProductRow> _lastPreparedRows = [];
    private string _token = string.Empty;
    private LoginUserInfo? _currentUser;

    private static readonly string[] LoginRoutes =
    [
        "/api/auth/login",
        "/api/login",
        "/login",
        "/auth/login"
    ];

    private static readonly (string Key, string Label)[] RequiredFields =
    [
        ("codigo_interno", "Codigo barra interno"),
        ("codigo_barra_externo", "Codigo barra externo"),
        ("nombre", "Nombre"),
        ("unidad", "Unidad"),
        ("precio_venta", "Precio venta"),
        ("id_categoria", "ID categoria"),
        ("impuesto_especifico", "Impuesto especifico")
    ];

    private static readonly Dictionary<string, string[]> FieldAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["codigo_interno"] = ["codigo barra interno", "codigobarrainterno", "barra interno", "interno", "codigo interno"],
        ["codigo_barra_externo"] = ["codigo barra externo", "codigobarraexterno", "barra externo", "externo", "ean", "barcode"],
        ["nombre"] = ["nombre", "descripcion corta", "producto"],
        ["unidad"] = ["unidad", "u medida", "umedida", "medida"],
        ["precio_venta"] = ["precio", "precio venta", "precioventa", "valor venta"],
        ["id_categoria"] = ["id categoria", "categoria", "categoria id", "idcategoria"],
        ["impuesto_especifico"] = ["impuesto especifico", "impuesto", "impuestoespecifico"]
    };

    public Form1()
    {
        InitializeComponent();
        Text = "Programa Subida Productos";
        txtApiUrl.Text = "http://64.176.20.67:3000";
        txtCategoriaDefault.Text = "1";
        lblEstado.Text = "Sesion no iniciada. Carga un archivo .xlsx para comenzar.";
        lblSesionEstado.Text = "Sesion no iniciada";
        ConstruirMapeo([]);
        UpdateImportButtonState();
        UpdateDuplicateExportButton();
    }

    private async void BtnLogin_Click(object sender, EventArgs e)
    {
        txtLog.Clear();

        try
        {
            await AuthenticateAsync();
            AppendLog("Sesion iniciada correctamente.");
            UpdateImportButtonState();
        }
        catch (Exception ex)
        {
            AppendLog(ex.Message, true);
        }
    }

    private void BtnSeleccionarArchivo_Click(object sender, EventArgs e)
    {
        using OpenFileDialog dialog = new()
        {
            Filter = "Archivos Excel (*.xlsx)|*.xlsx",
            Title = "Selecciona un archivo Excel"
        };

        if (dialog.ShowDialog() != DialogResult.OK)
        {
            return;
        }

        try
        {
            CargarExcel(dialog.FileName);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"No se pudo leer el archivo Excel.\n\nDetalle: {ex.Message}",
                "Error al cargar Excel",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private async void BtnImportar_Click(object sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(_token))
        {
            MessageBox.Show("Primero debes iniciar sesion.", "Falta sesion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        if (_rows.Count == 0)
        {
            MessageBox.Show("Primero debes cargar un archivo Excel.", "Falta archivo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        string apiUrl = txtApiUrl.Text.Trim();
        if (string.IsNullOrWhiteSpace(apiUrl))
        {
            MessageBox.Show("Debes indicar la URL base del servidor.", "Falta URL", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        Dictionary<string, string> mapping = GetCurrentMapping();
        string? validationMessage = ValidateMapping(mapping);
        if (!string.IsNullOrWhiteSpace(validationMessage))
        {
            MessageBox.Show(validationMessage, "Mapeo incompleto", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        List<PreparedProductRow> preparedRows = TransformRows(mapping);

        if (preparedRows.Count == 0)
        {
            MessageBox.Show("No se encontraron filas validas para enviar.", "Sin datos", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        ToggleImportControls(false);
        txtLog.Clear();
        _lastDuplicateReview.Clear();
        _lastPreparedRows.Clear();
        _lastPreparedRows.AddRange(preparedRows.Select(ClonePreparedProductRow));
        UpdateDuplicateExportButton();
        AppendLog($"Analizando {preparedRows.Count} productos del Excel...");

        int success = 0;
        int errors = 0;
        int skipped = 0;

        try
        {
            List<DuplicateReviewItem> duplicateMessages = DetectExcelDuplicatesDetailed(preparedRows);
            foreach (DuplicateReviewItem duplicateMessage in duplicateMessages)
            {
                _lastDuplicateReview.Add(duplicateMessage);
                if (duplicateMessage.BlocksImport)
                {
                    skipped++;
                }
                AppendLog(duplicateMessage.Message, true);
            }

            HashSet<string> existingInternalCodes = [];
            HashSet<string> existingExternalCodes = [];

            try
            {
                ExistingProductCatalog catalog = await FetchExistingProductsAsync(apiUrl);
                existingInternalCodes = catalog.InternalCodes;
                existingExternalCodes = catalog.ExternalCodes;
                AppendLog($"Base consultada: {catalog.TotalProducts} productos existentes.");
            }
            catch (Exception ex)
            {
                AppendLog($"No se pudo consultar duplicados en la base: {ex.Message}", true);
            }

            List<PreparedProductRow> rowsToImport = [];

            foreach (PreparedProductRow preparedRow in preparedRows)
            {
                if (preparedRow.SkipImport)
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(preparedRow.Product.codigo_interno) &&
                    existingInternalCodes.Contains(preparedRow.Product.codigo_interno))
                {
                    skipped++;
                    preparedRow.SkipImport = true;
                    AppendLog(
                        $"Fila {preparedRow.ExcelRowNumber}: duplicado en base por codigo interno \"{preparedRow.Product.codigo_interno}\". Producto omitido.",
                        true);
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(preparedRow.Product.codigo_barra_externo) &&
                    existingExternalCodes.Contains(preparedRow.Product.codigo_barra_externo))
                {
                    skipped++;
                    preparedRow.SkipImport = true;
                    AppendLog(
                        $"Fila {preparedRow.ExcelRowNumber}: duplicado en base por codigo barra externo \"{preparedRow.Product.codigo_barra_externo}\". Producto omitido.",
                        true);
                    continue;
                }

                rowsToImport.Add(preparedRow);
            }

            if (rowsToImport.Count == 0)
            {
                MessageBox.Show("Todos los productos fueron omitidos por duplicados o datos invalidos.", "Sin filas para importar", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            AppendLog($"Iniciando carga de {rowsToImport.Count} productos nuevos...");

            for (int i = 0; i < rowsToImport.Count; i++)
            {
                PreparedProductRow preparedRow = rowsToImport[i];
                ProductPayload product = preparedRow.Product;

                try
                {
                    using HttpRequestMessage request = new(HttpMethod.Post, $"{NormalizeBaseUrl(apiUrl)}/api/productos");
                    request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);
                    request.Content = new StringContent(
                        JsonSerializer.Serialize(product),
                        Encoding.UTF8,
                        "application/json");

                    using HttpResponseMessage response = await _httpClient.SendAsync(request);
                    string responseBody = await response.Content.ReadAsStringAsync();

                    if (!response.IsSuccessStatusCode)
                    {
                        string apiMessage = ExtractApiMessage(responseBody);

                        if (LooksLikeDuplicateError(apiMessage))
                        {
                            skipped++;
                            preparedRow.SkipImport = true;
                            List<DuplicateReviewItem> apiDuplicateItems = BuildApiDuplicateReviewItems(preparedRow, apiMessage);
                            foreach (DuplicateReviewItem item in apiDuplicateItems)
                            {
                                _lastDuplicateReview.Add(item);
                            }
                            UpdateDuplicateExportButton();
                            AppendLog($"Fila {preparedRow.ExcelRowNumber}: duplicado detectado por la API - {apiMessage}", true);

                            if (!string.IsNullOrWhiteSpace(preparedRow.Product.codigo_interno))
                            {
                                existingInternalCodes.Add(preparedRow.Product.codigo_interno);
                            }

                            if (!string.IsNullOrWhiteSpace(preparedRow.Product.codigo_barra_externo))
                            {
                                existingExternalCodes.Add(preparedRow.Product.codigo_barra_externo);
                            }

                            continue;
                        }

                        errors++;

                        if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
                        {
                            ClearSession();
                            UpdateSessionStatus("Sesion expirada o token rechazado.", true);
                            UpdateStatus("La sesion expiro o el token fue rechazado.");
                            UpdateImportButtonState();
                        }

                        AppendLog($"Fila {preparedRow.ExcelRowNumber}: error {(int)response.StatusCode} - {apiMessage}", true);
                        continue;
                    }

                    success++;

                    if (!string.IsNullOrWhiteSpace(product.codigo_interno))
                    {
                        existingInternalCodes.Add(product.codigo_interno);
                    }

                    if (!string.IsNullOrWhiteSpace(product.codigo_barra_externo))
                    {
                        existingExternalCodes.Add(product.codigo_barra_externo);
                    }

                    AppendLog($"Fila {preparedRow.ExcelRowNumber}: producto \"{product.nombre}\" creado correctamente.");
                }
                catch (Exception ex)
                {
                    errors++;
                    AppendLog($"Fila {preparedRow.ExcelRowNumber}: fallo de conexion - {ex.Message}", true);
                }
            }
        }
        finally
        {
            ToggleImportControls(true);
            UpdateImportButtonState();
            UpdateDuplicateExportButton();
        }

        lblEstado.Text = $"Proceso finalizado. Exitosos: {success}. Duplicados omitidos: {skipped}. Errores: {errors}.";
        AppendLog(lblEstado.Text);
    }

    private async Task<LoginResponse> AuthenticateAsync()
    {
        string apiUrl = txtApiUrl.Text.Trim();
        string username = txtUsername.Text.Trim();
        string password = txtPassword.Text;

        if (string.IsNullOrWhiteSpace(apiUrl))
        {
            throw new InvalidOperationException("Debes indicar la URL base del servidor.");
        }

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException("Debes ingresar usuario y contrasena para iniciar sesion.");
        }

        btnLogin.Enabled = false;
        btnSeleccionarArchivo.Enabled = false;
        UpdateSessionStatus("Iniciando sesion...", false);
        UpdateStatus("Iniciando sesion...");

        try
        {
            LoginResponse login = await TryLoginRoutesAsync(apiUrl, username, password);

            if (string.IsNullOrWhiteSpace(login.token))
            {
                throw new InvalidOperationException("La API respondio sin token JWT.");
            }

            _token = login.token;
            _currentUser = login.usuario ?? new LoginUserInfo { username = username };

            string userLabel = _currentUser.username ?? username;
            string roleLabel = string.IsNullOrWhiteSpace(_currentUser.rol) ? string.Empty : $" ({_currentUser.rol})";
            UpdateSessionStatus($"Sesion iniciada: {userLabel}{roleLabel}", false);
            UpdateStatus($"Sesion iniciada como {userLabel}{roleLabel}.");
            return login;
        }
        catch (Exception ex)
        {
            ClearSession();
            UpdateSessionStatus("Error al iniciar sesion.", true);
            throw new InvalidOperationException(ex.Message, ex);
        }
        finally
        {
            btnLogin.Enabled = true;
            btnSeleccionarArchivo.Enabled = true;
        }
    }

    private async Task<LoginResponse> TryLoginRoutesAsync(string apiUrl, string username, string password)
    {
        List<string> errors = [];

        foreach (string route in LoginRoutes)
        {
            string loginUrl = $"{NormalizeBaseUrl(apiUrl)}{route}";

            try
            {
                LoginRequest payload = new()
                {
                    username = username,
                    password = password
                };

                using StringContent content = new(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                using HttpResponseMessage response = await _httpClient.PostAsync(loginUrl, content);
                string responseBody = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    string apiMessage = ExtractApiMessage(responseBody);
                    errors.Add($"{route}: {apiMessage}");
                    continue;
                }

                LoginResponse? login = JsonSerializer.Deserialize<LoginResponse>(responseBody, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (login is null)
                {
                    errors.Add($"{route}: La API devolvio una respuesta vacia.");
                    continue;
                }

                return login;
            }
            catch (Exception ex)
            {
                errors.Add($"{route}: {ex.Message}");
            }
        }

        throw new InvalidOperationException($"No se pudo iniciar sesion. Rutas probadas: {string.Join(" | ", errors)}");
    }

    private void CargarExcel(string filePath)
    {
        _rows.Clear();
        _headers.Clear();

        using XLWorkbook workbook = new(filePath);
        IXLWorksheet worksheet = workbook.Worksheets.First();
        IXLRange? usedRange = worksheet.RangeUsed();

        if (usedRange is null)
        {
            throw new InvalidOperationException("La hoja esta vacia.");
        }

        int firstRow = usedRange.RangeAddress.FirstAddress.RowNumber;
        int lastRow = usedRange.RangeAddress.LastAddress.RowNumber;
        int firstColumn = usedRange.RangeAddress.FirstAddress.ColumnNumber;
        int lastColumn = usedRange.RangeAddress.LastAddress.ColumnNumber;
        int headerRow = DetectHeaderRow(worksheet, firstRow, lastRow, firstColumn, lastColumn);

        for (int col = firstColumn; col <= lastColumn; col++)
        {
            string header = worksheet.Cell(headerRow, col).GetString().Trim();
            if (string.IsNullOrWhiteSpace(header))
            {
                header = $"Columna_{col}";
            }

            _headers.Add(header);
        }

        for (int row = headerRow + 1; row <= lastRow; row++)
        {
            Dictionary<string, string> rowData = [];
            bool hasValues = false;

            for (int col = firstColumn; col <= lastColumn; col++)
            {
                string value = worksheet.Cell(row, col).GetFormattedString().Trim();
                rowData[_headers[col - firstColumn]] = value;
                if (!string.IsNullOrWhiteSpace(value))
                {
                    hasValues = true;
                }
            }

            if (hasValues)
            {
                _rows.Add(rowData);
            }
        }

        txtArchivo.Text = filePath;
        lblEstado.Text = $"Archivo cargado: {_rows.Count} filas desde la hoja {worksheet.Name}. Encabezado detectado en fila {headerRow}.";
        ConstruirMapeo(_headers);
        LoadPreviewGrid();
        txtLog.Clear();
        _lastDuplicateReview.Clear();
        _lastPreparedRows.Clear();
        UpdateDuplicateExportButton();
        AppendLog(lblEstado.Text);
        UpdateImportButtonState();
    }

    private void ConstruirMapeo(IEnumerable<string> headers)
    {
        pnlMapeo.Controls.Clear();
        _mappingSelectors.Clear();
        List<string> sourceHeaders = headers.ToList();

        foreach ((string key, string label) in RequiredFields)
        {
            Panel panel = new()
            {
                Width = 300,
                Height = 60,
                Margin = new Padding(6)
            };

            Label title = new()
            {
                Text = label,
                AutoSize = true,
                Location = new Point(0, 0)
            };

            ComboBox selector = new()
            {
                Width = 280,
                DropDownStyle = ComboBoxStyle.DropDownList,
                Location = new Point(0, 24)
            };

            selector.Items.Add("(Sin asignar)");
            foreach (string header in sourceHeaders)
            {
                selector.Items.Add(header);
            }

            string? suggested = FindSuggestedHeader(sourceHeaders, key, label);
            selector.SelectedItem = suggested ?? "(Sin asignar)";

            panel.Controls.Add(title);
            panel.Controls.Add(selector);
            pnlMapeo.Controls.Add(panel);
            _mappingSelectors[key] = selector;
        }
    }

    private void LoadPreviewGrid()
    {
        dgvPreview.Columns.Clear();
        dgvPreview.Rows.Clear();
        dgvPreview.SuspendLayout();

        foreach (string header in _headers)
        {
            dgvPreview.Columns.Add(header, header);
        }

        foreach (Dictionary<string, string> row in _rows)
        {
            dgvPreview.Rows.Add(_headers.Select(h => row.GetValueOrDefault(h, string.Empty)).ToArray());
        }

        dgvPreview.ResumeLayout();
    }

    private Dictionary<string, string> GetCurrentMapping()
    {
        Dictionary<string, string> mapping = [];

        foreach ((string key, _) in RequiredFields)
        {
            string selected = _mappingSelectors[key].SelectedItem?.ToString() ?? string.Empty;
            mapping[key] = selected == "(Sin asignar)" ? string.Empty : selected;
        }

        return mapping;
    }

    private List<PreparedProductRow> TransformRows(Dictionary<string, string> mapping)
    {
        List<PreparedProductRow> products = [];
        int defaultCategoryId = ParseInt(txtCategoriaDefault.Text);
        int skippedRows = 0;

        for (int index = 0; index < _rows.Count; index++)
        {
            Dictionary<string, string> row = _rows[index];
            int categoryId = ParseInt(ReadValue(row, mapping, "id_categoria"));
            if (categoryId <= 0)
            {
                categoryId = defaultCategoryId;
            }

            ProductPayload product = new()
            {
                codigo_interno = ReadValue(row, mapping, "codigo_interno"),
                codigo_barra_externo = ReadValue(row, mapping, "codigo_barra_externo"),
                nombre = ReadValue(row, mapping, "nombre"),
                unidad = string.IsNullOrWhiteSpace(ReadValue(row, mapping, "unidad")) ? "UN" : ReadValue(row, mapping, "unidad"),
                precio_venta = ParseDecimal(ReadValue(row, mapping, "precio_venta")),
                id_categoria = categoryId,
                impuesto_especifico = ParseDecimal(ReadValue(row, mapping, "impuesto_especifico"))
            };

            if (string.IsNullOrWhiteSpace(product.nombre) || product.id_categoria <= 0)
            {
                skippedRows++;
                continue;
            }

            products.Add(new PreparedProductRow
            {
                ExcelRowNumber = index + 2,
                Product = product
            });
        }

        if (skippedRows > 0)
        {
            AppendLog($"Se omitieron {skippedRows} filas por falta de datos obligatorios.", true);
        }

        return products;
    }

    private List<DuplicateReviewItem> DetectExcelDuplicatesDetailed(List<PreparedProductRow> preparedRows)
    {
        List<DuplicateReviewItem> duplicates = [];
        Dictionary<string, PreparedProductRow> internalCodeMap = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, PreparedProductRow> externalCodeMap = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, PreparedProductRow> nameMap = new(StringComparer.OrdinalIgnoreCase);

        foreach (PreparedProductRow row in preparedRows)
        {
            string internalCode = row.Product.codigo_interno.Trim();
            if (!string.IsNullOrWhiteSpace(internalCode))
            {
                if (internalCodeMap.TryGetValue(internalCode, out PreparedProductRow? existingInternal))
                {
                    bool sameName = string.Equals(row.Product.nombre?.Trim(), existingInternal.Product.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
                    row.SkipImport = true;
                    duplicates.Add(new DuplicateReviewItem
                    {
                        Source = "Excel",
                        Type = "codigo_interno",
                        ExcelRowNumber = row.ExcelRowNumber,
                        Code = internalCode,
                        ExcelName = row.Product.nombre ?? string.Empty,
                        RelatedRowOrId = existingInternal.ExcelRowNumber.ToString(),
                        RelatedName = existingInternal.Product.nombre ?? string.Empty,
                        NameMatches = sameName,
                        Message = BuildDuplicateMessage("Excel", "codigo interno", internalCode, row, existingInternal)
                    });
                }
                else
                {
                    internalCodeMap[internalCode] = row;
                }
            }

            string externalCode = row.Product.codigo_barra_externo.Trim();
            if (!string.IsNullOrWhiteSpace(externalCode))
            {
                if (externalCodeMap.TryGetValue(externalCode, out PreparedProductRow? existingExternal))
                {
                    bool sameName = string.Equals(row.Product.nombre?.Trim(), existingExternal.Product.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
                    row.SkipImport = true;
                    duplicates.Add(new DuplicateReviewItem
                    {
                        Source = "Excel",
                        Type = "codigo_barra_externo",
                        ExcelRowNumber = row.ExcelRowNumber,
                        Code = externalCode,
                        ExcelName = row.Product.nombre ?? string.Empty,
                        RelatedRowOrId = existingExternal.ExcelRowNumber.ToString(),
                        RelatedName = existingExternal.Product.nombre ?? string.Empty,
                        NameMatches = sameName,
                        Message = BuildDuplicateMessage("Excel", "codigo barra externo", externalCode, row, existingExternal)
                    });
                }
                else
                {
                    externalCodeMap[externalCode] = row;
                }
            }

            string productName = (row.Product.nombre ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(productName))
            {
                if (nameMap.TryGetValue(productName, out PreparedProductRow? existingName))
                {
                    duplicates.Add(new DuplicateReviewItem
                    {
                        Source = "Excel",
                        Type = "nombre",
                        ExcelRowNumber = row.ExcelRowNumber,
                        Code = productName,
                        ExcelName = row.Product.nombre ?? string.Empty,
                        RelatedRowOrId = existingName.ExcelRowNumber.ToString(),
                        RelatedName = existingName.Product.nombre ?? string.Empty,
                        NameMatches = true,
                        Message = $"Fila {row.ExcelRowNumber}: duplicado en Excel por nombre \"{productName}\". Ya aparece en fila {existingName.ExcelRowNumber}."
                    });
                }
                else
                {
                    nameMap[productName] = row;
                }
            }

        }

        return ConsolidateDuplicateReviewItems(duplicates);
    }

    private async Task<ExistingProductCatalog> FetchExistingProductsAsync(string apiUrl)
    {
        using HttpRequestMessage request = new(HttpMethod.Get, $"{NormalizeBaseUrl(apiUrl)}/api/productos");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _token);

        using HttpResponseMessage response = await _httpClient.SendAsync(request);
        string responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(ExtractApiMessage(responseBody));
        }

        JsonElement productsElement = ExtractProductsElement(responseBody);
        ExistingProductCatalog catalog = new();

        if (productsElement.ValueKind != JsonValueKind.Array)
        {
            return catalog;
        }

        foreach (JsonElement item in productsElement.EnumerateArray())
        {
            catalog.TotalProducts++;
            ExistingProductInfo productInfo = new();

            if (item.TryGetProperty("id", out JsonElement idElement) && idElement.TryGetInt32(out int id))
            {
                productInfo.id = id;
            }

            if (item.TryGetProperty("codigo_interno", out JsonElement internalCodeElement))
            {
                string? code = internalCodeElement.GetString();
                if (!string.IsNullOrWhiteSpace(code))
                {
                    code = code.Trim();
                    catalog.InternalCodes.Add(code);
                    productInfo.codigo_interno = code;
                    catalog.InternalProductsByCode.TryAdd(code, productInfo);
                }
            }

            if (item.TryGetProperty("codigo_barra_externo", out JsonElement externalCodeElement))
            {
                string? code = externalCodeElement.GetString();
                if (!string.IsNullOrWhiteSpace(code))
                {
                    code = code.Trim();
                    catalog.ExternalCodes.Add(code);
                    productInfo.codigo_barra_externo = code;
                    catalog.ExternalProductsByCode.TryAdd(code, productInfo);
                }
            }

            if (item.TryGetProperty("nombre", out JsonElement nameElement))
            {
                string? name = nameElement.GetString();
                if (!string.IsNullOrWhiteSpace(name))
                {
                    name = name.Trim();
                    productInfo.nombre = name;
                    catalog.ProductsByName.TryAdd(name, productInfo);
                }
            }
        }

        return catalog;
    }

    private static JsonElement ExtractProductsElement(string responseBody)
    {
        using JsonDocument doc = JsonDocument.Parse(responseBody);
        JsonElement root = doc.RootElement;

        if (root.ValueKind == JsonValueKind.Array)
        {
            return root.Clone();
        }

        string[] candidates = ["productos", "data", "items", "rows"];
        foreach (string candidate in candidates)
        {
            if (root.TryGetProperty(candidate, out JsonElement nested) && nested.ValueKind == JsonValueKind.Array)
            {
                return nested.Clone();
            }
        }

        return root.Clone();
    }

    private List<DuplicateReviewItem> DetectDatabaseDuplicatesDetailed(List<PreparedProductRow> preparedRows, ExistingProductCatalog catalog)
    {
        List<DuplicateReviewItem> duplicates = [];

        foreach (PreparedProductRow row in preparedRows)
        {
            if (!string.IsNullOrWhiteSpace(row.Product.codigo_interno) &&
                catalog.InternalProductsByCode.TryGetValue(row.Product.codigo_interno, out ExistingProductInfo? internalProduct))
            {
                bool sameName = string.Equals(row.Product.nombre?.Trim(), internalProduct.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
                duplicates.Add(new DuplicateReviewItem
                {
                    Source = "Base",
                    Type = "codigo_interno",
                    ExcelRowNumber = row.ExcelRowNumber,
                    Code = row.Product.codigo_interno,
                    ExcelName = row.Product.nombre ?? string.Empty,
                    RelatedRowOrId = internalProduct.id > 0 ? $"ID {internalProduct.id}" : "Base",
                    RelatedName = internalProduct.nombre ?? string.Empty,
                    NameMatches = sameName,
                    Message = BuildDuplicateMessageAgainstDatabase("codigo interno", row.Product.codigo_interno, row, internalProduct)
                });
            }

            if (!string.IsNullOrWhiteSpace(row.Product.codigo_barra_externo) &&
                catalog.ExternalProductsByCode.TryGetValue(row.Product.codigo_barra_externo, out ExistingProductInfo? externalProduct))
            {
                bool sameName = string.Equals(row.Product.nombre?.Trim(), externalProduct.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
                duplicates.Add(new DuplicateReviewItem
                {
                    Source = "Base",
                    Type = "codigo_barra_externo",
                    ExcelRowNumber = row.ExcelRowNumber,
                    Code = row.Product.codigo_barra_externo,
                    ExcelName = row.Product.nombre ?? string.Empty,
                    RelatedRowOrId = externalProduct.id > 0 ? $"ID {externalProduct.id}" : "Base",
                    RelatedName = externalProduct.nombre ?? string.Empty,
                    NameMatches = sameName,
                    Message = BuildDuplicateMessageAgainstDatabase("codigo barra externo", row.Product.codigo_barra_externo, row, externalProduct)
                });
            }

            if (!string.IsNullOrWhiteSpace(row.Product.nombre) &&
                catalog.ProductsByName.TryGetValue(row.Product.nombre.Trim(), out ExistingProductInfo? existingByName))
            {
                duplicates.Add(new DuplicateReviewItem
                {
                    Source = "Base",
                    Type = "nombre",
                    ExcelRowNumber = row.ExcelRowNumber,
                    Code = row.Product.nombre ?? string.Empty,
                    ExcelName = row.Product.nombre ?? string.Empty,
                    RelatedRowOrId = existingByName.id > 0 ? $"ID {existingByName.id}" : "Base",
                    RelatedName = existingByName.nombre ?? string.Empty,
                    NameMatches = true,
                    Message = $"Fila {row.ExcelRowNumber}: duplicado en Base por nombre \"{row.Product.nombre}\". Ya existe un producto con ese nombre."
                });
            }

        }

        return ConsolidateDuplicateReviewItems(duplicates);
    }

    private List<DuplicateReviewItem> ConsolidateDuplicateReviewItems(List<DuplicateReviewItem> items)
    {
        return items
            .GroupBy(item => $"{item.Source}|{item.ExcelRowNumber}|{item.RelatedRowOrId}")
            .Select(group =>
            {
                List<DuplicateReviewItem> groupedItems = group.ToList();
                DuplicateReviewItem first = groupedItems[0];
                bool hasName = groupedItems.Any(i => i.Type == "nombre");
                bool hasCode = groupedItems.Any(i => i.Type == "codigo_interno" || i.Type == "codigo_barra_externo");

                string category = hasName && hasCode
                    ? "ambos"
                    : hasCode
                        ? "codigos"
                        : "nombre";

                string typeLabel = hasName && hasCode
                    ? "ambos"
                    : string.Join(", ", groupedItems.Select(i => i.Type).Distinct());

                string combinedMessage = first.Source == "Base"
                    ? BuildCombinedDatabaseMessage(groupedItems, first.ExcelRowNumber, first.RelatedRowOrId, first.ExcelName, first.RelatedName)
                    : BuildCombinedExcelMessage(groupedItems, first.ExcelRowNumber, first.RelatedRowOrId, first.ExcelName, first.RelatedName);

                return new DuplicateReviewItem
                {
                    Source = first.Source,
                    Type = typeLabel,
                    Category = category,
                    BlocksImport = hasCode || hasName,
                    ExcelRowNumber = first.ExcelRowNumber,
                    Code = string.Join(" | ", groupedItems.Select(i => $"{i.Type}: {i.Code}").Distinct()),
                    ExcelName = first.ExcelName,
                    RelatedRowOrId = first.RelatedRowOrId,
                    RelatedName = first.RelatedName,
                    NameMatches = groupedItems.All(i => i.NameMatches),
                    Message = combinedMessage
                };
            })
            .OrderBy(item => item.ExcelRowNumber)
            .ThenBy(item => item.Source)
            .ToList();
    }

    private static string BuildCombinedExcelMessage(List<DuplicateReviewItem> items, int excelRowNumber, string relatedRowOrId, string excelName, string relatedName)
    {
        string duplicatedFields = string.Join(", ", items.Select(i => i.Type).Distinct());
        return $"Fila {excelRowNumber}: duplicado en Excel por {duplicatedFields}. Coincide con fila {relatedRowOrId}. Nombre actual: \"{excelName}\". Nombre relacionado: \"{relatedName}\".";
    }

    private static string BuildCombinedDatabaseMessage(List<DuplicateReviewItem> items, int excelRowNumber, string relatedRowOrId, string excelName, string relatedName)
    {
        string duplicatedFields = string.Join(", ", items.Select(i => i.Type).Distinct());
        return $"Fila {excelRowNumber}: duplicado en Base por {duplicatedFields}. Coincide con {relatedRowOrId}. Nombre Excel: \"{excelName}\". Nombre base: \"{relatedName}\".";
    }

    private static string BuildDuplicateMessage(string origin, string fieldLabel, string code, PreparedProductRow currentRow, PreparedProductRow previousRow)
    {
        bool sameName = string.Equals(currentRow.Product.nombre?.Trim(), previousRow.Product.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
        string nameDetail = sameName
            ? $"El nombre coincide: \"{currentRow.Product.nombre}\"."
            : $"Nombres distintos: fila {previousRow.ExcelRowNumber} = \"{previousRow.Product.nombre}\" y fila {currentRow.ExcelRowNumber} = \"{currentRow.Product.nombre}\".";

        return $"Fila {currentRow.ExcelRowNumber}: duplicado en {origin} por {fieldLabel} \"{code}\". Ya aparece en fila {previousRow.ExcelRowNumber}. {nameDetail}";
    }

    private static string BuildDuplicateMessageAgainstDatabase(string fieldLabel, string code, PreparedProductRow excelRow, ExistingProductInfo dbProduct)
    {
        bool sameName = string.Equals(excelRow.Product.nombre?.Trim(), dbProduct.nombre?.Trim(), StringComparison.OrdinalIgnoreCase);
        string dbName = string.IsNullOrWhiteSpace(dbProduct.nombre) ? "(sin nombre en base)" : dbProduct.nombre;
        string excelName = string.IsNullOrWhiteSpace(excelRow.Product.nombre) ? "(sin nombre en excel)" : excelRow.Product.nombre;
        string nameDetail = sameName
            ? $"El nombre coincide con la base: \"{excelName}\"."
            : $"Nombres distintos: base = \"{dbName}\" y Excel = \"{excelName}\".";

        return $"Fila {excelRow.ExcelRowNumber}: duplicado en Base por {fieldLabel} \"{code}\". {nameDetail}";
    }

    private static string? FindSuggestedHeader(IEnumerable<string> sourceHeaders, string key, string label)
    {
        List<string> candidates = [];
        candidates.Add(key);
        candidates.Add(label);

        if (FieldAliases.TryGetValue(key, out string[]? aliases))
        {
            candidates.AddRange(aliases);
        }

        foreach (string candidate in candidates)
        {
            string normalizedCandidate = NormalizeText(candidate);
            string? match = sourceHeaders.FirstOrDefault(h => NormalizeText(h) == normalizedCandidate);
            if (!string.IsNullOrWhiteSpace(match))
            {
                return match;
            }
        }

        return null;
    }

    private string? ValidateMapping(Dictionary<string, string> mapping)
    {
        string[] requiredMappedFields = ["codigo_interno", "nombre", "unidad", "precio_venta"];
        List<string> missing = [];

        foreach (string field in requiredMappedFields)
        {
            if (!mapping.TryGetValue(field, out string? selected) || string.IsNullOrWhiteSpace(selected))
            {
                string label = RequiredFields.First(f => f.Key == field).Label;
                missing.Add(label);
            }
        }

        if (missing.Count > 0)
        {
            return $"Debes asignar estas columnas antes de importar: {string.Join(", ", missing)}.";
        }

        if (ParseInt(txtCategoriaDefault.Text) <= 0 &&
            (!mapping.TryGetValue("id_categoria", out string? categoryField) || string.IsNullOrWhiteSpace(categoryField)))
        {
            return "Debes asignar una columna para ID categoria o indicar una Categoria default (ID) valida.";
        }

        return null;
    }

    private static int DetectHeaderRow(IXLWorksheet worksheet, int firstRow, int lastRow, int firstColumn, int lastColumn)
    {
        int maxRowsToInspect = Math.Min(lastRow, firstRow + 20);
        int bestRow = firstRow;
        int bestScore = int.MinValue;

        for (int row = firstRow; row <= maxRowsToInspect; row++)
        {
            int nonEmptyCells = 0;
            int recognizedHeaders = 0;
            int textLikeCells = 0;

            for (int col = firstColumn; col <= lastColumn; col++)
            {
                string value = worksheet.Cell(row, col).GetString().Trim();
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                nonEmptyCells++;
                string normalized = NormalizeText(value);

                if (RequiredFields.Any(field => normalized == NormalizeText(field.Key) || normalized == NormalizeText(field.Label)))
                {
                    recognizedHeaders += 3;
                }

                if (LooksLikeHeader(value))
                {
                    textLikeCells++;
                }
            }

            int score = recognizedHeaders + textLikeCells + nonEmptyCells;
            if (score > bestScore)
            {
                bestScore = score;
                bestRow = row;
            }
        }

        return bestRow;
    }

    private static bool LooksLikeHeader(string value)
    {
        string trimmed = value.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return false;
        }

        if (decimal.TryParse(trimmed, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
        {
            return false;
        }

        int letters = trimmed.Count(char.IsLetter);
        int digits = trimmed.Count(char.IsDigit);
        return letters >= digits;
    }

    private static string ReadValue(Dictionary<string, string> row, Dictionary<string, string> mapping, string fieldKey)
    {
        if (!mapping.TryGetValue(fieldKey, out string? sourceColumn) || string.IsNullOrWhiteSpace(sourceColumn))
        {
            return string.Empty;
        }

        return row.GetValueOrDefault(sourceColumn, string.Empty).Trim();
    }

    private static decimal ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        string normalized = value
            .Trim()
            .Replace(" ", string.Empty)
            .Replace("$", string.Empty)
            .Replace("CLP", string.Empty, StringComparison.OrdinalIgnoreCase);

        if (decimal.TryParse(normalized, NumberStyles.Any, new CultureInfo("es-CL"), out decimal esValue))
        {
            return esValue;
        }

        if (decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal invValue))
        {
            return invValue;
        }

        normalized = normalized.Replace(".", string.Empty).Replace(",", ".");
        return decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out decimal fallback) ? fallback : 0;
    }

    private static int ParseInt(string? value)
    {
        return (int)Math.Round(ParseDecimal(value), MidpointRounding.AwayFromZero);
    }

    private static string NormalizeBaseUrl(string value)
    {
        string baseUrl = value.Trim();

        if (baseUrl.EndsWith("/"))
        {
            baseUrl = baseUrl[..^1];
        }

        if (baseUrl.EndsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            baseUrl = baseUrl[..^4];
        }

        return baseUrl;
    }

    private static string NormalizeText(string value)
    {
        string normalized = value.Normalize(NormalizationForm.FormD);
        StringBuilder builder = new();

        foreach (char c in normalized)
        {
            UnicodeCategory category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category != UnicodeCategory.NonSpacingMark && char.IsLetterOrDigit(c))
            {
                builder.Append(char.ToLowerInvariant(c));
            }
        }

        return builder.ToString();
    }

    private static string ExtractApiMessage(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return "La API no devolvio detalle del error.";
        }

        try
        {
            using JsonDocument doc = JsonDocument.Parse(responseBody);

            if (doc.RootElement.TryGetProperty("error", out JsonElement errorProperty))
            {
                return errorProperty.GetString() ?? "Error reportado por la API.";
            }

            if (doc.RootElement.TryGetProperty("mensaje", out JsonElement messageProperty))
            {
                return messageProperty.GetString() ?? "Mensaje recibido desde la API.";
            }
        }
        catch
        {
            // Si la respuesta no es JSON, devolvemos el contenido tal cual.
        }

        return responseBody;
    }

    private static bool LooksLikeDuplicateError(string apiMessage)
    {
        if (string.IsNullOrWhiteSpace(apiMessage))
        {
            return false;
        }

        string normalized = apiMessage.Trim().ToLowerInvariant();

        return normalized.Contains("codigo ya existe")
            || normalized.Contains("código ya existe")
            || normalized.Contains("duplicate")
            || normalized.Contains("duplicado")
            || normalized.Contains("unique")
            || normalized.Contains("llave duplicada")
            || normalized.Contains("clave duplicada");
    }

    private List<DuplicateReviewItem> BuildApiDuplicateReviewItems(PreparedProductRow row, string apiMessage)
    {
        List<DuplicateReviewItem> items = [];

        if (!string.IsNullOrWhiteSpace(row.Product.codigo_interno))
        {
            items.Add(new DuplicateReviewItem
            {
                Source = "API",
                Type = "codigo_interno",
                Category = "codigos",
                BlocksImport = true,
                ExcelRowNumber = row.ExcelRowNumber,
                Code = row.Product.codigo_interno,
                ExcelName = row.Product.nombre ?? string.Empty,
                RelatedRowOrId = "API",
                RelatedName = string.Empty,
                NameMatches = false,
                Message = $"Fila {row.ExcelRowNumber}: posible duplicado por codigo interno \"{row.Product.codigo_interno}\" detectado por la API. Detalle: {apiMessage}"
            });
        }

        if (!string.IsNullOrWhiteSpace(row.Product.codigo_barra_externo))
        {
            items.Add(new DuplicateReviewItem
            {
                Source = "API",
                Type = "codigo_barra_externo",
                Category = "codigos",
                BlocksImport = true,
                ExcelRowNumber = row.ExcelRowNumber,
                Code = row.Product.codigo_barra_externo,
                ExcelName = row.Product.nombre ?? string.Empty,
                RelatedRowOrId = "API",
                RelatedName = string.Empty,
                NameMatches = false,
                Message = $"Fila {row.ExcelRowNumber}: posible duplicado por codigo barra externo \"{row.Product.codigo_barra_externo}\" detectado por la API. Detalle: {apiMessage}"
            });
        }

        if (items.Count == 0)
        {
            items.Add(new DuplicateReviewItem
            {
                Source = "API",
                Type = "codigo_no_determinado",
                Category = "codigos",
                BlocksImport = true,
                ExcelRowNumber = row.ExcelRowNumber,
                Code = string.Empty,
                ExcelName = row.Product.nombre ?? string.Empty,
                RelatedRowOrId = "API",
                RelatedName = string.Empty,
                NameMatches = false,
                Message = $"Fila {row.ExcelRowNumber}: duplicado detectado por la API, pero no se pudo determinar la columna exacta. Detalle: {apiMessage}"
            });
        }

        return items;
    }

    private void ToggleImportControls(bool enabled)
    {
        btnImportar.Enabled = enabled && CanImport();
        btnSeleccionarArchivo.Enabled = enabled;
        btnLogin.Enabled = enabled;
    }

    private void UpdateStatus(string message)
    {
        lblEstado.Text = message;
    }

    private void ClearSession()
    {
        _token = string.Empty;
        _currentUser = null;
        UpdateSessionStatus("Sesion no iniciada", false);
    }

    private void UpdateSessionStatus(string message, bool isError)
    {
        lblSesionEstado.Text = message;
        lblSesionEstado.ForeColor = isError ? Color.Firebrick : Color.DarkGreen;
    }

    private bool CanImport()
    {
        return !string.IsNullOrWhiteSpace(_token) && _rows.Count > 0;
    }

    private void UpdateImportButtonState()
    {
        btnImportar.Enabled = CanImport();
    }

    private async void BtnRevisarDuplicados_Click(object sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(_token))
        {
            MessageBox.Show("Primero debes iniciar sesion.", "Falta sesion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        if (_rows.Count == 0)
        {
            MessageBox.Show("Primero debes cargar un archivo Excel.", "Falta archivo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        string apiUrl = txtApiUrl.Text.Trim();
        if (string.IsNullOrWhiteSpace(apiUrl))
        {
            MessageBox.Show("Debes indicar la URL base del servidor.", "Falta URL", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        Dictionary<string, string> mapping = GetCurrentMapping();
        string? validationMessage = ValidateMapping(mapping);
        if (!string.IsNullOrWhiteSpace(validationMessage))
        {
            MessageBox.Show(validationMessage, "Mapeo incompleto", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        List<PreparedProductRow> preparedRows = TransformRows(mapping);
        if (preparedRows.Count == 0)
        {
            MessageBox.Show("No se encontraron filas validas para revisar.", "Sin datos", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        txtLog.Clear();
        _lastDuplicateReview.Clear();
        _lastPreparedRows.Clear();
        _lastPreparedRows.AddRange(preparedRows.Select(ClonePreparedProductRow));
        AppendLog($"Revisando duplicados para {preparedRows.Count} productos del Excel...");

        List<DuplicateReviewItem> excelDuplicates = DetectExcelDuplicatesDetailed(preparedRows);
        foreach (DuplicateReviewItem item in excelDuplicates)
        {
            _lastDuplicateReview.Add(item);
            AppendLog(item.Message, true);
        }

        try
        {
            ExistingProductCatalog catalog = await FetchExistingProductsAsync(apiUrl);
            List<DuplicateReviewItem> databaseDuplicates = DetectDatabaseDuplicatesDetailed(preparedRows, catalog);

            foreach (DuplicateReviewItem item in databaseDuplicates)
            {
                _lastDuplicateReview.Add(item);
                AppendLog(item.Message, true);
            }

            int totalDuplicates = excelDuplicates.Count + databaseDuplicates.Count;
            UpdateDuplicateExportButton();
            if (totalDuplicates == 0)
            {
                lblEstado.Text = "Revision completada. No se detectaron duplicados.";
                AppendLog(lblEstado.Text);
                return;
            }

            lblEstado.Text = $"Revision completada. Duplicados detectados: {totalDuplicates}.";
            AppendLog(lblEstado.Text);
        }
        catch (Exception ex)
        {
            UpdateDuplicateExportButton();
            lblEstado.Text = "Revision parcial completada. Solo se revisaron duplicados del Excel.";
            AppendLog($"No se pudo revisar duplicados en la base: {ex.Message}", true);
            AppendLog(lblEstado.Text, true);
        }
    }

    private void BtnExportarDuplicados_Click(object sender, EventArgs e)
    {
        if (_lastDuplicateReview.Count == 0)
        {
            MessageBox.Show("Primero debes ejecutar la revision de duplicados.", "Sin datos", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        using SaveFileDialog dialog = new()
        {
            Filter = "Archivos Excel (*.xlsx)|*.xlsx",
            Title = "Guardar revision de duplicados",
            FileName = $"duplicados_productos_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx"
        };

        if (dialog.ShowDialog() != DialogResult.OK)
        {
            return;
        }

        try
        {
            ExportDuplicateReviewToExcel(dialog.FileName);
            AppendLog($"Revision de duplicados exportada a: {dialog.FileName}");
            lblEstado.Text = "Revision de duplicados exportada correctamente.";
        }
        catch (Exception ex)
        {
            MessageBox.Show($"No se pudo exportar el archivo.\n\nDetalle: {ex.Message}", "Error al exportar", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void ExportDuplicateReviewToExcel(string filePath)
    {
        using XLWorkbook workbook = new();
        CreateDuplicateSummaryWorksheet(workbook);
        CreateDuplicateWorksheet(workbook, "Duplicados por nombre", _lastDuplicateReview.Where(x => x.Category == "nombre").ToList(), XLColor.LightYellow);
        CreateDuplicateWorksheet(workbook, "Duplicados por codigos", _lastDuplicateReview.Where(x => x.Category == "codigos").ToList(), XLColor.LightSalmon);
        CreateDuplicateWorksheet(workbook, "Duplicados ambos", _lastDuplicateReview.Where(x => x.Category == "ambos").ToList(), XLColor.LightPink);

        IXLWorksheet readyWorksheet = workbook.Worksheets.Add("Listos para importar");
        string[] readyHeaders =
        [
            "Fila Excel",
            "Codigo barra interno",
            "Codigo barra externo",
            "Nombre",
            "Unidad",
            "Precio venta",
            "ID categoria",
            "Impuesto especifico",
            "Estado"
        ];

        for (int i = 0; i < readyHeaders.Length; i++)
        {
            readyWorksheet.Cell(1, i + 1).Value = readyHeaders[i];
            readyWorksheet.Cell(1, i + 1).Style.Font.Bold = true;
            readyWorksheet.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightGreen;
        }

        List<PreparedProductRow> readyRows = GetRowsReadyForImport();
        for (int index = 0; index < readyRows.Count; index++)
        {
            PreparedProductRow item = readyRows[index];
            int row = index + 2;

            readyWorksheet.Cell(row, 1).Value = item.ExcelRowNumber;
            readyWorksheet.Cell(row, 2).Value = item.Product.codigo_interno;
            readyWorksheet.Cell(row, 3).Value = item.Product.codigo_barra_externo;
            readyWorksheet.Cell(row, 4).Value = item.Product.nombre;
            readyWorksheet.Cell(row, 5).Value = item.Product.unidad;
            readyWorksheet.Cell(row, 6).Value = item.Product.precio_venta;
            readyWorksheet.Cell(row, 7).Value = item.Product.id_categoria;
            readyWorksheet.Cell(row, 8).Value = item.Product.impuesto_especifico;
            readyWorksheet.Cell(row, 9).Value = item.Status;
        }

        readyWorksheet.Columns().AdjustToContents();
        workbook.SaveAs(filePath);
    }

    private void CreateDuplicateSummaryWorksheet(XLWorkbook workbook)
    {
        IXLWorksheet worksheet = workbook.Worksheets.Add("Resumen duplicados");

        string[] headers =
        [
            "Fila Excel",
            "Nombre producto",
            "Codigo barra interno",
            "Codigo barra externo",
            "Precio venta",
            "Duplicado por codigo interno",
            "Duplicado por codigo externo",
            "Duplicado por nombre",
            "IDs / filas relacionadas",
            "Nombres relacionados",
            "Detalle"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(1, i + 1).Value = headers[i];
            worksheet.Cell(1, i + 1).Style.Font.Bold = true;
            worksheet.Cell(1, i + 1).Style.Fill.BackgroundColor = XLColor.LightSteelBlue;
        }

        List<DuplicateSummaryRow> summaryRows = BuildDuplicateSummaryRows();
        for (int index = 0; index < summaryRows.Count; index++)
        {
            DuplicateSummaryRow item = summaryRows[index];
            int row = index + 2;

            worksheet.Cell(row, 1).Value = item.ExcelRowNumber;
            worksheet.Cell(row, 2).Value = item.ProductName;
            worksheet.Cell(row, 3).Value = item.InternalCode;
            worksheet.Cell(row, 4).Value = item.ExternalCode;
            worksheet.Cell(row, 5).Value = item.Price;
            worksheet.Cell(row, 6).Value = item.HasInternalDuplicate ? "Si" : "No";
            worksheet.Cell(row, 7).Value = item.HasExternalDuplicate ? "Si" : "No";
            worksheet.Cell(row, 8).Value = item.HasNameDuplicate ? "Si" : "No";
            worksheet.Cell(row, 9).Value = item.RelatedIdsOrRows;
            worksheet.Cell(row, 10).Value = item.RelatedNames;
            worksheet.Cell(row, 11).Value = item.Details;
        }

        worksheet.Columns().AdjustToContents();
    }

    private void CreateDuplicateWorksheet(XLWorkbook workbook, string sheetName, List<DuplicateReviewItem> items, XLColor headerColor)
    {
        IXLWorksheet worksheet = workbook.Worksheets.Add(sheetName);

        string[] headers =
        [
            "Origen",
            "Tipo",
            "Fila Excel",
            "Codigo",
            "Nombre Excel",
            "Fila relacionada",
            "Nombre relacionado",
            "Coincide nombre",
            "Detalle"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(1, i + 1).Value = headers[i];
            worksheet.Cell(1, i + 1).Style.Font.Bold = true;
            worksheet.Cell(1, i + 1).Style.Fill.BackgroundColor = headerColor;
        }

        for (int index = 0; index < items.Count; index++)
        {
            DuplicateReviewItem item = items[index];
            int row = index + 2;

            worksheet.Cell(row, 1).Value = item.Source;
            worksheet.Cell(row, 2).Value = item.Type;
            worksheet.Cell(row, 3).Value = item.ExcelRowNumber;
            worksheet.Cell(row, 4).Value = item.Code;
            worksheet.Cell(row, 5).Value = item.ExcelName;
            worksheet.Cell(row, 6).Value = item.RelatedRowOrId;
            worksheet.Cell(row, 7).Value = item.RelatedName;
            worksheet.Cell(row, 8).Value = item.NameMatches ? "Si" : "No";
            worksheet.Cell(row, 9).Value = item.Message;
        }

        worksheet.Columns().AdjustToContents();
    }

    private void UpdateDuplicateExportButton()
    {
        btnExportarDuplicados.Enabled = _lastDuplicateReview.Count > 0;
    }

    private List<DuplicateSummaryRow> BuildDuplicateSummaryRows()
    {
        Dictionary<int, PreparedProductRow> preparedByRow = _lastPreparedRows
            .GroupBy(x => x.ExcelRowNumber)
            .ToDictionary(g => g.Key, g => ClonePreparedProductRow(g.First()));

        return _lastDuplicateReview
            .GroupBy(item => item.ExcelRowNumber)
            .OrderBy(group => group.Key)
            .Select(group =>
            {
                PreparedProductRow? preparedRow = preparedByRow.GetValueOrDefault(group.Key);
                List<DuplicateReviewItem> items = group.ToList();

                return new DuplicateSummaryRow
                {
                    ExcelRowNumber = group.Key,
                    ProductName = preparedRow?.Product.nombre ?? items.Select(i => i.ExcelName).FirstOrDefault() ?? string.Empty,
                    InternalCode = preparedRow?.Product.codigo_interno ?? string.Empty,
                    ExternalCode = preparedRow?.Product.codigo_barra_externo ?? string.Empty,
                    Price = preparedRow?.Product.precio_venta ?? 0,
                    HasInternalDuplicate = items.Any(i => i.Type.Contains("codigo_interno", StringComparison.OrdinalIgnoreCase) || i.Code.Contains("codigo_interno:", StringComparison.OrdinalIgnoreCase)),
                    HasExternalDuplicate = items.Any(i => i.Type.Contains("codigo_barra_externo", StringComparison.OrdinalIgnoreCase) || i.Code.Contains("codigo_barra_externo:", StringComparison.OrdinalIgnoreCase)),
                    HasNameDuplicate = items.Any(i => i.Type.Contains("nombre", StringComparison.OrdinalIgnoreCase) || i.Code.Contains("nombre:", StringComparison.OrdinalIgnoreCase)),
                    RelatedIdsOrRows = string.Join(" | ", items.Select(i => i.RelatedRowOrId).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct()),
                    RelatedNames = string.Join(" | ", items.Select(i => i.RelatedName).Where(x => !string.IsNullOrWhiteSpace(x)).Distinct()),
                    Details = string.Join(" || ", items.Select(i => i.Message).Distinct())
                };
            })
            .ToList();
    }

    private List<PreparedProductRow> GetRowsReadyForImport()
    {
        HashSet<int> blockingDuplicateRows = _lastDuplicateReview
            .Where(item => item.BlocksImport)
            .Select(item => item.ExcelRowNumber)
            .Where(row => row > 0)
            .ToHashSet();

        HashSet<int> nameOnlyDuplicateRows = _lastDuplicateReview
            .Where(item => item.BlocksImport && item.Category == "nombre")
            .Select(item => item.ExcelRowNumber)
            .Where(row => row > 0)
            .ToHashSet();

        return _lastPreparedRows
            .Select(ClonePreparedProductRow)
            .Select(row =>
            {
                if (blockingDuplicateRows.Contains(row.ExcelRowNumber))
                {
                    row.SkipImport = true;
                    if (nameOnlyDuplicateRows.Contains(row.ExcelRowNumber))
                    {
                        row.Status = "Omitido por nombre duplicado";
                    }
                    else
                    {
                        row.Status = "Omitido por codigo duplicado";
                    }
                }
                else if (nameOnlyDuplicateRows.Contains(row.ExcelRowNumber))
                {
                    row.SkipImport = true;
                    row.Status = "Omitido por nombre duplicado";
                }
                else
                {
                    row.Status = "Listo";
                }

                return row;
            })
            .ToList();
    }

    private static PreparedProductRow ClonePreparedProductRow(PreparedProductRow source)
    {
        return new PreparedProductRow
        {
            ExcelRowNumber = source.ExcelRowNumber,
            SkipImport = source.SkipImport,
            Status = source.Status,
            Product = new ProductPayload
            {
                codigo_interno = source.Product.codigo_interno,
                codigo_barra_externo = source.Product.codigo_barra_externo,
                nombre = source.Product.nombre,
                unidad = source.Product.unidad,
                precio_venta = source.Product.precio_venta,
                id_categoria = source.Product.id_categoria,
                impuesto_especifico = source.Product.impuesto_especifico
            }
        };
    }

    private void AppendLog(string message, bool isError = false)
    {
        string line = $"[{DateTime.Now:HH:mm:ss}] {message}{Environment.NewLine}";
        txtLog.SelectionColor = isError ? Color.Firebrick : Color.DarkGreen;
        txtLog.AppendText(line);
        txtLog.SelectionColor = txtLog.ForeColor;
        txtLog.ScrollToCaret();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        _httpClient.Dispose();
        base.OnFormClosed(e);
    }
}

public sealed class ProductPayload
{
    public string codigo_interno { get; set; } = string.Empty;
    public string codigo_barra_externo { get; set; } = string.Empty;
    public string nombre { get; set; } = string.Empty;
    public string unidad { get; set; } = "UN";
    public decimal precio_venta { get; set; }
    public int id_categoria { get; set; }
    public decimal impuesto_especifico { get; set; }
}

public sealed class PreparedProductRow
{
    public int ExcelRowNumber { get; set; }
    public ProductPayload Product { get; set; } = new();
    public bool SkipImport { get; set; }
    public string Status { get; set; } = "Listo";
}

public sealed class ExistingProductCatalog
{
    public int TotalProducts { get; set; }
    public HashSet<string> InternalCodes { get; } = new(StringComparer.OrdinalIgnoreCase);
    public HashSet<string> ExternalCodes { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, ExistingProductInfo> InternalProductsByCode { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, ExistingProductInfo> ExternalProductsByCode { get; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, ExistingProductInfo> ProductsByName { get; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class ExistingProductInfo
{
    public int id { get; set; }
    public string codigo_interno { get; set; } = string.Empty;
    public string codigo_barra_externo { get; set; } = string.Empty;
    public string nombre { get; set; } = string.Empty;
}

public sealed class DuplicateReviewItem
{
    public string Source { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public bool BlocksImport { get; set; }
    public int ExcelRowNumber { get; set; }
    public string Code { get; set; } = string.Empty;
    public string ExcelName { get; set; } = string.Empty;
    public string RelatedRowOrId { get; set; } = string.Empty;
    public string RelatedName { get; set; } = string.Empty;
    public bool NameMatches { get; set; }
    public string Message { get; set; } = string.Empty;
}

public sealed class DuplicateSummaryRow
{
    public int ExcelRowNumber { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string InternalCode { get; set; } = string.Empty;
    public string ExternalCode { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public bool HasInternalDuplicate { get; set; }
    public bool HasExternalDuplicate { get; set; }
    public bool HasNameDuplicate { get; set; }
    public string RelatedIdsOrRows { get; set; } = string.Empty;
    public string RelatedNames { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
}

public sealed class LoginRequest
{
    public string username { get; set; } = string.Empty;
    public string password { get; set; } = string.Empty;
}

public sealed class LoginResponse
{
    public string token { get; set; } = string.Empty;
    public LoginUserInfo? usuario { get; set; }
    public string? mensaje { get; set; }
}

public sealed class LoginUserInfo
{
    public int id { get; set; }
    public string? username { get; set; }
    public string? rol { get; set; }
    public int? id_sucursal { get; set; }
}
