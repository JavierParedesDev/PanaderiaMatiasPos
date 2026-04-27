namespace ProgramaSubidaProductosCS;

partial class Form1
{
    /// <summary>
    ///  Required designer variable.
    /// </summary>
    private System.ComponentModel.IContainer components = null!;

    /// <summary>
    ///  Clean up any resources being used.
    /// </summary>
    /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
    protected override void Dispose(bool disposing)
    {
        if (disposing && (components != null))
        {
            components.Dispose();
        }
        base.Dispose(disposing);
    }

    #region Windows Form Designer generated code

    /// <summary>
    ///  Required method for Designer support - do not modify
    ///  the contents of this method with the code editor.
    /// </summary>
    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();
        lblTitulo = new Label();
        lblApiUrl = new Label();
        txtApiUrl = new TextBox();
        lblUsername = new Label();
        txtUsername = new TextBox();
        lblPassword = new Label();
        txtPassword = new TextBox();
        lblCategoriaDefault = new Label();
        txtCategoriaDefault = new TextBox();
        lblArchivo = new Label();
        txtArchivo = new TextBox();
        btnLogin = new Button();
        lblSesionEstado = new Label();
        btnSeleccionarArchivo = new Button();
        btnRevisarDuplicados = new Button();
        btnExportarDuplicados = new Button();
        btnImportar = new Button();
        lblMapeo = new Label();
        pnlMapeo = new FlowLayoutPanel();
        lblPreview = new Label();
        dgvPreview = new DataGridView();
        lblLog = new Label();
        txtLog = new RichTextBox();
        lblEstado = new Label();
        ((System.ComponentModel.ISupportInitialize)dgvPreview).BeginInit();
        SuspendLayout();
        // 
        // lblTitulo
        // 
        lblTitulo.AutoSize = true;
        lblTitulo.Font = new Font("Segoe UI Semibold", 18F, FontStyle.Bold, GraphicsUnit.Point);
        lblTitulo.Location = new Point(24, 18);
        lblTitulo.Name = "lblTitulo";
        lblTitulo.Size = new Size(415, 32);
        lblTitulo.TabIndex = 0;
        lblTitulo.Text = "Importador de productos desde Excel";
        // 
        // lblApiUrl
        // 
        lblApiUrl.AutoSize = true;
        lblApiUrl.Location = new Point(26, 72);
        lblApiUrl.Name = "lblApiUrl";
        lblApiUrl.Size = new Size(125, 15);
        lblApiUrl.TabIndex = 1;
        lblApiUrl.Text = "URL base del servidor";
        // 
        // txtApiUrl
        // 
        txtApiUrl.Location = new Point(26, 91);
        txtApiUrl.Name = "txtApiUrl";
        txtApiUrl.Size = new Size(349, 23);
        txtApiUrl.TabIndex = 2;
        // 
        // lblUsername
        // 
        lblUsername.AutoSize = true;
        lblUsername.Location = new Point(394, 72);
        lblUsername.Name = "lblUsername";
        lblUsername.Size = new Size(50, 15);
        lblUsername.TabIndex = 3;
        lblUsername.Text = "Usuario";
        // 
        // txtUsername
        // 
        txtUsername.Location = new Point(394, 91);
        txtUsername.Name = "txtUsername";
        txtUsername.Size = new Size(220, 23);
        txtUsername.TabIndex = 4;
        // 
        // lblPassword
        // 
        lblPassword.AutoSize = true;
        lblPassword.Location = new Point(634, 72);
        lblPassword.Name = "lblPassword";
        lblPassword.Size = new Size(67, 15);
        lblPassword.TabIndex = 5;
        lblPassword.Text = "Contrasena";
        // 
        // txtPassword
        // 
        txtPassword.Location = new Point(634, 91);
        txtPassword.Name = "txtPassword";
        txtPassword.PasswordChar = '*';
        txtPassword.Size = new Size(180, 23);
        txtPassword.TabIndex = 6;
        // 
        // lblCategoriaDefault
        // 
        lblCategoriaDefault.AutoSize = true;
        lblCategoriaDefault.Location = new Point(26, 130);
        lblCategoriaDefault.Name = "lblCategoriaDefault";
        lblCategoriaDefault.Size = new Size(133, 15);
        lblCategoriaDefault.TabIndex = 7;
        lblCategoriaDefault.Text = "Categoria default (ID)";
        // 
        // txtCategoriaDefault
        // 
        txtCategoriaDefault.Location = new Point(26, 149);
        txtCategoriaDefault.Name = "txtCategoriaDefault";
        txtCategoriaDefault.PlaceholderText = "Ej: 1";
        txtCategoriaDefault.Size = new Size(176, 23);
        txtCategoriaDefault.TabIndex = 8;
        // 
        // lblArchivo
        // 
        lblArchivo.AutoSize = true;
        lblArchivo.Location = new Point(221, 130);
        lblArchivo.Name = "lblArchivo";
        lblArchivo.Size = new Size(84, 15);
        lblArchivo.TabIndex = 9;
        lblArchivo.Text = "Archivo Excel";
        // 
        // txtArchivo
        // 
        txtArchivo.Location = new Point(221, 149);
        txtArchivo.Name = "txtArchivo";
        txtArchivo.ReadOnly = true;
        txtArchivo.Size = new Size(549, 23);
        txtArchivo.TabIndex = 10;
        // 
        // btnLogin
        // 
        btnLogin.Location = new Point(833, 90);
        btnLogin.Name = "btnLogin";
        btnLogin.Size = new Size(128, 25);
        btnLogin.TabIndex = 11;
        btnLogin.Text = "Iniciar sesion";
        btnLogin.UseVisualStyleBackColor = true;
        btnLogin.Click += BtnLogin_Click;
        // 
        // lblSesionEstado
        // 
        lblSesionEstado.AutoSize = true;
        lblSesionEstado.Location = new Point(833, 122);
        lblSesionEstado.Name = "lblSesionEstado";
        lblSesionEstado.Size = new Size(103, 15);
        lblSesionEstado.TabIndex = 12;
        lblSesionEstado.Text = "Sesion no iniciada";
        // 
        // btnSeleccionarArchivo
        // 
        btnSeleccionarArchivo.Location = new Point(786, 148);
        btnSeleccionarArchivo.Name = "btnSeleccionarArchivo";
        btnSeleccionarArchivo.Size = new Size(175, 25);
        btnSeleccionarArchivo.TabIndex = 13;
        btnSeleccionarArchivo.Text = "Seleccionar Excel";
        btnSeleccionarArchivo.UseVisualStyleBackColor = true;
        btnSeleccionarArchivo.Click += BtnSeleccionarArchivo_Click;
        // 
        // btnRevisarDuplicados
        // 
        btnRevisarDuplicados.Location = new Point(786, 184);
        btnRevisarDuplicados.Name = "btnRevisarDuplicados";
        btnRevisarDuplicados.Size = new Size(175, 25);
        btnRevisarDuplicados.TabIndex = 14;
        btnRevisarDuplicados.Text = "Revisar duplicados";
        btnRevisarDuplicados.UseVisualStyleBackColor = true;
        btnRevisarDuplicados.Click += BtnRevisarDuplicados_Click;
        // 
        // btnExportarDuplicados
        // 
        btnExportarDuplicados.Enabled = false;
        btnExportarDuplicados.Location = new Point(605, 184);
        btnExportarDuplicados.Name = "btnExportarDuplicados";
        btnExportarDuplicados.Size = new Size(175, 25);
        btnExportarDuplicados.TabIndex = 15;
        btnExportarDuplicados.Text = "Exportar duplicados";
        btnExportarDuplicados.UseVisualStyleBackColor = true;
        btnExportarDuplicados.Click += BtnExportarDuplicados_Click;
        // 
        // btnImportar
        // 
        btnImportar.Enabled = false;
        btnImportar.Location = new Point(801, 91);
        btnImportar.Name = "btnImportar";
        btnImportar.Size = new Size(160, 25);
        btnImportar.TabIndex = 16;
        btnImportar.Text = "Importar productos";
        btnImportar.UseVisualStyleBackColor = true;
        btnImportar.Click += BtnImportar_Click;
        // 
        // lblMapeo
        // 
        lblMapeo.AutoSize = true;
        lblMapeo.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
        lblMapeo.Location = new Point(26, 194);
        lblMapeo.Name = "lblMapeo";
        lblMapeo.Size = new Size(149, 20);
        lblMapeo.TabIndex = 9;
        lblMapeo.Text = "Mapeo de columnas";
        // 
        // pnlMapeo
        // 
        pnlMapeo.AutoScroll = true;
        pnlMapeo.BorderStyle = BorderStyle.FixedSingle;
        pnlMapeo.Location = new Point(26, 219);
        pnlMapeo.Name = "pnlMapeo";
        pnlMapeo.Size = new Size(935, 152);
        pnlMapeo.TabIndex = 10;
        // 
        // lblPreview
        // 
        lblPreview.AutoSize = true;
        lblPreview.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
        lblPreview.Location = new Point(26, 390);
        lblPreview.Name = "lblPreview";
        lblPreview.Size = new Size(86, 20);
        lblPreview.TabIndex = 11;
        lblPreview.Text = "Vista previa";
        // 
        // dgvPreview
        // 
        dgvPreview.AllowUserToAddRows = false;
        dgvPreview.AllowUserToDeleteRows = false;
        dgvPreview.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.DisplayedCells;
        dgvPreview.ColumnHeadersHeightSizeMode = DataGridViewColumnHeadersHeightSizeMode.AutoSize;
        dgvPreview.Location = new Point(26, 415);
        dgvPreview.Name = "dgvPreview";
        dgvPreview.ReadOnly = true;
        dgvPreview.RowTemplate.Height = 25;
        dgvPreview.Size = new Size(935, 182);
        dgvPreview.TabIndex = 12;
        // 
        // lblLog
        // 
        lblLog.AutoSize = true;
        lblLog.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
        lblLog.Location = new Point(26, 611);
        lblLog.Name = "lblLog";
        lblLog.Size = new Size(140, 20);
        lblLog.TabIndex = 13;
        lblLog.Text = "Registro del proceso";
        // 
        // txtLog
        // 
        txtLog.Location = new Point(26, 636);
        txtLog.Name = "txtLog";
        txtLog.ReadOnly = true;
        txtLog.Size = new Size(935, 130);
        txtLog.TabIndex = 14;
        txtLog.Text = "";
        // 
        // lblEstado
        // 
        lblEstado.AutoSize = true;
        lblEstado.Location = new Point(26, 778);
        lblEstado.Name = "lblEstado";
        lblEstado.Size = new Size(42, 15);
        lblEstado.TabIndex = 15;
        lblEstado.Text = "Estado";
        // 
        // Form1
        // 
        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(989, 812);
        Controls.Add(lblEstado);
        Controls.Add(txtLog);
        Controls.Add(lblLog);
        Controls.Add(dgvPreview);
        Controls.Add(lblPreview);
        Controls.Add(pnlMapeo);
        Controls.Add(lblMapeo);
        Controls.Add(btnImportar);
        Controls.Add(btnExportarDuplicados);
        Controls.Add(btnRevisarDuplicados);
        Controls.Add(lblSesionEstado);
        Controls.Add(btnLogin);
        Controls.Add(btnSeleccionarArchivo);
        Controls.Add(txtArchivo);
        Controls.Add(txtCategoriaDefault);
        Controls.Add(lblCategoriaDefault);
        Controls.Add(lblArchivo);
        Controls.Add(txtPassword);
        Controls.Add(lblPassword);
        Controls.Add(txtUsername);
        Controls.Add(lblUsername);
        Controls.Add(txtApiUrl);
        Controls.Add(lblApiUrl);
        Controls.Add(lblTitulo);
        MinimumSize = new Size(1005, 851);
        Name = "Form1";
        StartPosition = FormStartPosition.CenterScreen;
        Text = "Programa Subida Productos";
        ((System.ComponentModel.ISupportInitialize)dgvPreview).EndInit();
        ResumeLayout(false);
        PerformLayout();
    }

    #endregion

    private Label lblTitulo;
    private Label lblApiUrl;
    private TextBox txtApiUrl;
    private Label lblUsername;
    private TextBox txtUsername;
    private Label lblPassword;
    private TextBox txtPassword;
    private Label lblCategoriaDefault;
    private TextBox txtCategoriaDefault;
    private Label lblArchivo;
    private TextBox txtArchivo;
    private Button btnLogin;
    private Label lblSesionEstado;
    private Button btnSeleccionarArchivo;
    private Button btnRevisarDuplicados;
    private Button btnExportarDuplicados;
    private Button btnImportar;
    private Label lblMapeo;
    private FlowLayoutPanel pnlMapeo;
    private Label lblPreview;
    private DataGridView dgvPreview;
    private Label lblLog;
    private RichTextBox txtLog;
    private Label lblEstado;
}
