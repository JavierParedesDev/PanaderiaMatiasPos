import sys
import json
import win32print
from escpos.printer import Win32Raw
from datetime import datetime

def format_currency(value):
    try:
        return f"${int(value):,}".replace(",", ".")
    except:
        return f"${value}"

def print_ticket(data):
    try:
        # Obtener la impresora predeterminada de Windows
        printer_name = win32print.GetDefaultPrinter()
        
        # Conectar a la impresora vía Win32Raw (comandos ESC/POS directos)
        p = Win32Raw(printer_name)
        
        # Encabezado con estética premium (Centrado y Negrita)
        p.set(align='center', bold=True, double_height=True, double_width=True)
        p.text("PANADERIA MATIAS\n")
        
        p.set(align='center', bold=False, double_height=False, double_width=False)
        p.text(f"Folio: {data.get('folio', 'N/A')}\n")
        
        # Fecha formateada o actual
        fecha = data.get('fecha')
        if not fecha:
            fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
        p.text(f"Fecha: {fecha}\n")
        
        p.text("-" * 32 + "\n")
        
        # Listado de productos
        p.set(align='left', bold=False)
        items = data.get('items', [])
        for item in items:
            nombre = str(item.get('nombre', ''))[:22]
            cantidad = int(item.get('cantidad', 0))
            precio_u = float(item.get('precio_unitario', 0))
            subtotal = cantidad * precio_u
            
            # Línea 1: Nombre del producto
            p.text(f"{nombre.upper()}\n")
            # Línea 2: Cantidad x Precio [...] Subtotal
            detail_line = f" {cantidad} x {format_currency(precio_u):<12} {format_currency(subtotal):>11}\n"
            p.text(detail_line)
            
        p.text("-" * 32 + "\n")
        
        # Total Destacado
        p.set(align='right', bold=True, double_height=True)
        total = float(data.get('total', 0))
        p.text(f"TOTAL: {format_currency(total)}\n")
        
        # Método de Pago y Footer
        p.set(align='center', bold=False, double_height=False)
        p.text(f"METODO: {data.get('metodo', 'Efectivo').upper()}\n")
        p.text("\n¡Gracias por su preferencia!\n")
        p.text("Panaderia Matias - Calidad Superior\n\n")
        
        # Espacio para el corte
        p.text("\n\n\n")
        
        # Comando de corte
        p.cut()
        
        return True, "Ticket impreso correctamente"
    except Exception as e:
        return False, str(e)

if __name__ == "__main__":
    try:
        # Leer JSON de la entrada estándar
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({"success": False, "error": "No se recibieron datos"}))
            sys.exit(1)
            
        ticket_data = json.loads(raw_input)
        success, message = print_ticket(ticket_data)
        
        # Retornar resultado en JSON para que Node lo interprete
        result = {"success": success}
        if success:
            result["message"] = message
        else:
            result["error"] = message
            
        print(json.dumps(result))
        sys.exit(0 if success else 1)
        
    except json.JSONDecodeError:
        print(json.dumps({"success": False, "error": "Formato JSON invalido"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
