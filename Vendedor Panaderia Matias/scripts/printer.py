import os
import sys
import json
import win32print
from escpos.printer import Win32Raw
from datetime import datetime
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

def format_currency(value):
    try:
        return f"${int(value):,}".replace(",", ".")
    except:
        return f"${value}"

def truncate(text, max_len):
    return str(text)[:max_len]

def rjust_line(left, right, width):
    gap = width - len(left) - len(right)
    if gap < 1:
        gap = 1
    return left + " " * gap + right

def detect_paper_width_mm(printer_name):
    """
    Intenta leer el ancho de papel desde las propiedades de la impresora Windows.
    Retorna el ancho en mm, o None si no puede detectarlo.
    PaperWidth en DEVMODE está en décimas de mm (ej: 800 = 80mm, 580 = 58mm).
    """
    try:
        handle = win32print.OpenPrinter(printer_name)
        try:
            info = win32print.GetPrinter(handle, 2)
            devmode = info.get('pDevMode')
            if devmode and hasattr(devmode, 'PaperWidth') and devmode.PaperWidth:
                width_mm = devmode.PaperWidth / 10.0
                if width_mm > 0:
                    return width_mm
        finally:
            win32print.ClosePrinter(handle)
    except Exception:
        pass
    return None

def resolve_cols(paper_mm):
    """
    Convierte el ancho de papel en mm a (COLS, NAME_MAX).
    Conservador para evitar desbordamiento en impresoras pequeñas.
    """
    if paper_mm <= 52:
        return 22, 14    # 50mm
    elif paper_mm <= 62:
        return 32, 22    # 58mm
    else:
        return 48, 32    # 80mm

def print_ticket(data):
    try:
        printer_name = data.get("printer_name") or win32print.GetDefaultPrinter()
        p = Win32Raw(printer_name)

        # ── ¿Solo abrir gaveta sin imprimir? ─────────────────────────────────
        skip_print = data.get("skip_print", False)
        if skip_print:
            # Abrir gaveta (pin 2, pulso estándar) y terminar
            try:
                p.cashdraw(2)
            except Exception:
                p.cashdraw(5)
            return True, "Gaveta abierta (sin impresión)"

        # ── Detectar ancho de papel ───────────────────────────────────────────
        detected_mm = detect_paper_width_mm(printer_name)
        if detected_mm and detected_mm > 0:
            paper_mm = detected_mm
            source = f"auto ({detected_mm:.0f}mm)"
        else:
            paper_mm = float(data.get("paper_width", 80))
            source = f"manual ({paper_mm:.0f}mm)"

        COLS, NAME_MAX = resolve_cols(paper_mm)
        SEP = "-" * COLS

        sys.stderr.write(f"[PRINTER] Papel: {source} → COLS={COLS}\n")

        p.set(align="center", font="a")

        # ── Margen Izquierdo ──────────────────────────────────────────────────
        # GS L nL nH (1D 4C nL nH) -> nL + nH*256 dots
        # 80mm: ~24-32 dots (~3-4mm)
        # 58mm: ~8-16 dots (~1-2mm)
        margin_dots = 24 if paper_mm > 62 else 12
        p._raw(b'\x1d\x4c' + bytes([margin_dots % 256, margin_dots // 256]))

        # ── Logo ─────────────────────────────────────────────────────────
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            logo_path = data.get("logo_path") or os.path.join(script_dir, "..", "src", "renderer", "assets", "logo.png")
            if os.path.exists(logo_path) and HAS_PIL:
                # Tamaño máximo del logo según el papel
                if paper_mm <= 52:
                    max_logo_px = 160   # 50mm
                elif paper_mm <= 62:
                    max_logo_px = 200   # 58mm
                else:
                    max_logo_px = 300   # 80mm

                img = Image.open(logo_path)

                # Componer sobre fondo BLANCO antes de convertir a grises.
                # Sin esto, los píxeles transparentes del PNG quedan negros.
                if img.mode in ("RGBA", "LA"):
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[-1])
                    img = bg
                elif img.mode == "P" and "transparency" in img.info:
                    img = img.convert("RGBA")
                    bg = Image.new("RGB", img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[-1])
                    img = bg
                else:
                    img = img.convert("RGB")

                # Redimensionar proporcionalmente
                w, h = img.size
                if w > max_logo_px:
                    ratio = max_logo_px / w
                    img = img.resize((max_logo_px, int(h * ratio)), Image.LANCZOS)

                img = img.convert("L")  # escala de grises para ESC/POS
                p.image(img)
            elif os.path.exists(logo_path):
                p.image(logo_path)  # sin redimensionar si no hay Pillow
        except Exception as ex:
            sys.stderr.write(f"[LOGO ERR] {ex}\n")

        # ── Encabezado ─────────────────────────────────────────────────────────
        if COLS >= 46:
            # 80mm: encabezado normal para evitar texto exagerado.
            p.set(align="center", font="a", bold=True, double_height=False, double_width=False)
            p.text("PANADERIA\n")
            p.text("MATIAS\n")
            p.set(align="center", font="a", bold=False, double_height=False, double_width=False)
            p.text("Panaderia y Pasteleria\n")
        else:
            # 50/58mm: texto normal para que la boleta quede compacta.
            p.set(align="center", font="b", bold=True, double_height=False, double_width=False)
            p.text("PANADERIA MATIAS\n")
            p.set(align="center", font="b", bold=False, double_height=False, double_width=False)
            p.text("Pan. y Pasteleria\n")

        p.text(SEP + "\n")

        if data.get("tipo") == "arqueo":
            p.set(align="center", font="a", bold=True, double_height=False, double_width=False)
            p.text("RESUMEN DE ARQUEO\n")
            p.set(align="center", font="a", bold=False, double_height=False, double_width=False)
            
            p.text(f"Cajero: {str(data.get('cajero', 'N/A')).upper()}\n")
            if data.get("fecha_inicio"):
                p.text(f"Inicio: {data.get('fecha_inicio')}\n")
            fecha_termino = data.get("fecha_termino") or data.get("fecha") or datetime.now().strftime("%d/%m/%Y %H:%M")
            p.text(f"Termino: {fecha_termino}\n")
            p.text(SEP + "\n")
            
            p.set(align="left", font="a", bold=False, double_height=False, double_width=False)
            p.text("DETALLE DE VENTA\n")
            p.text(rjust_line("Monto Inicial:", format_currency(data.get("monto_apertura", 0)), COLS) + "\n")
            p.text(rjust_line("Efectivo:", format_currency(data.get("ventas_efectivo", 0)), COLS) + "\n")
            p.text(rjust_line("Tarjeta:", format_currency(data.get("ventas_tarjeta", 0)), COLS) + "\n")
            p.text(rjust_line("Transferencia:", format_currency(data.get("ventas_transferencia", 0)), COLS) + "\n")
            p.text(rjust_line("Monto Total:", format_currency(data.get("monto_total", 0)), COLS) + "\n")
            p.text(SEP + "\n")
            
            cigarros = data.get("cigarros") or []
            cigarros_total = data.get("cigarros_total", 0) or 0
            if cigarros:
                p.text("CIGARROS DEL TURNO\n")
                p.text(rjust_line("Total cigarros:", format_currency(cigarros_total), COLS) + "\n")
                for item in cigarros:
                    nombre = str(item.get("producto", ""))[:NAME_MAX].upper()
                    try:
                        cantidad = float(item.get("unidades_vendidas", 0))
                    except:
                        cantidad = 0
                    total_item = float(item.get("total_recaudado", 0) or 0)
                    cant_str = f"{cantidad:.3f}".rstrip("0").rstrip(".") if cantidad % 1 != 0 else str(int(cantidad))
                    p.text(f"{nombre}\n")
                    p.text(rjust_line(f"Cant {cant_str}", format_currency(total_item), COLS) + "\n")
                p.text(SEP + "\n")
            
            retiros = data.get("retiros")
            total_retiros = data.get("total_retiros", 0)
            
            # Si no hay retiros en data, intentar buscarlos en la raiz si el JSON cambió
            if not retiros and "retiros_turno" in data:
                retiros = data.get("retiros_turno")

            if retiros and len(retiros) > 0:
                p.text("RETIROS DEL TURNO\n")
                p.text(rjust_line("Total retiros:", format_currency(total_retiros), COLS) + "\n")
                for r in retiros:
                    motivo = str(r.get("motivo") or r.get("descripcion") or "S/M")[:NAME_MAX].upper()
                    monto_r = float(r.get("monto", 0))
                    p.text(f"{motivo}\n")
                    p.text(rjust_line(" ", format_currency(monto_r), COLS) + "\n")
                p.text(SEP + "\n")
            else:
                sys.stderr.write("[DEBUG] No se encontraron retiros en la data\n")

            p.text(rjust_line("Efectivo Esperado:", format_currency(data.get("esperado", 0)), COLS) + "\n")
            p.text(rjust_line("Efectivo Declarado:", format_currency(data.get("declarado", 0)), COLS) + "\n")
            
            diff = float(data.get("diferencia", 0))
            diff_str = format_currency(diff)
            if diff > 0:
                diff_str = f"+{diff_str}"
            p.text(rjust_line("Diferencia:", diff_str, COLS) + "\n")

            cuadrado = abs(diff) < 0.5 if data.get("cuadrado") is None else bool(data.get("cuadrado"))
            estado = "CUADRADO" if cuadrado else "NO CUADRADO"
            p.set(align="center", font="a", bold=True, double_height=False, double_width=False)
            p.text(SEP + "\n")
            p.text(f"ESTADO: {estado}\n")
            p.set(align="left", font="a", bold=False, double_height=False, double_width=False)
            
            if data.get("observaciones"):
                p.text(SEP + "\n")
                p.text("OBSERVACIONES:\n")
                p.text(f"{data.get('observaciones')}\n")
                
            p.text(SEP + "\n")
            p.text("\n\n\n")
            p.cut()
            
            try:
                p.cashdraw(2)
            except Exception:
                try:
                    p.cashdraw(5)
                except Exception:
                    pass
                    
            return True, f"Ticket de arqueo impreso ({source}, {COLS} cols)"

        p.set(align="center", font="a", bold=True, double_height=False, double_width=False)
        p.text("BOLETA DE VENTA\n")

        p.set(align="center", font="a", bold=False, double_height=False, double_width=False)
        p.text(f"Folio: {data.get('folio', 'N/A')}\n")

        fecha = data.get("fecha")
        if not fecha:
            fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
        p.text(f"Fecha: {fecha}\n")

        metodo = str(data.get("metodo", "Efectivo")).upper()
        p.text(f"Pago : {metodo}\n")
        p.text(SEP + "\n")

        # ── Productos ──────────────────────────────────────────────────────────
        p.set(align="left", font="a", bold=False, double_height=False, double_width=False)
        items = data.get("items", [])
        for item in items:
            nombre = truncate(item.get("nombre", ""), NAME_MAX).upper()
            try:
                cantidad = float(item.get("cantidad", 0))
                precio_u = float(item.get("precio_unitario", 0))
            except:
                cantidad = 0
                precio_u = 0

            subtotal = cantidad * precio_u
            cant_str = (
                f"{cantidad:.3f}".rstrip("0").rstrip(".")
                if cantidad % 1 != 0
                else str(int(cantidad))
            )

            if COLS <= 32:
                # Formato compacto: 2 líneas por producto
                p.text(f"{nombre}\n")
                detail = f"  {cant_str}x{format_currency(precio_u)}"
                p.text(rjust_line(detail, format_currency(subtotal), COLS) + "\n")
            else:
                # Formato 80mm: 1 línea con columnas
                p.text(
                    f"{nombre:<{NAME_MAX}} "
                    f"{cant_str:>5} "
                    f"{format_currency(precio_u):>8} "
                    f"{format_currency(subtotal):>10}\n"
                )

        p.text(SEP + "\n")

        # ── Total ──────────────────────────────────────────────────────────────
        total = float(data.get("total", 0))
        p.set(align="right", font="a", bold=True, double_height=False, double_width=False)
        p.text(f"TOTAL {format_currency(total)}\n")

        p.set(align="right", font="a", bold=False, double_height=False, double_width=False)

        # ── Vuelto ─────────────────────────────────────────────────────────────
        vuelto = data.get("vuelto")
        if vuelto is not None and float(vuelto) > 0:
            p.text(f"Vuelto: {format_currency(vuelto)}\n")

        # ── Footer ─────────────────────────────────────────────────────────────
        p.set(align="center", font="a", bold=False, double_height=False, double_width=False)
        p.text(SEP + "\n")
        p.text("Gracias por su preferencia!\n")
        p.text("No valida como doc. tributario\n")
        p.text("\n\n\n")
        p.cut()

        # ── Abrir gaveta SIEMPRE después de imprimir ──────────────────────────
        try:
            p.cashdraw(2)
        except Exception:
            try:
                p.cashdraw(5)
            except Exception:
                pass

        return True, f"Ticket impreso ({source}, {COLS} cols)"
    except Exception as e:
        return False, str(e)


if __name__ == "__main__":
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "No se recibieron datos"}))
            sys.exit(1)

        ticket_data = json.loads(raw_input)
        success, message = print_ticket(ticket_data)

        result = {"success": success}
        result["message" if success else "error"] = message
        print(json.dumps(result))
        sys.exit(0 if success else 1)

    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Formato JSON invalido"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
