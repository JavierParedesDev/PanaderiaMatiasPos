const fs = require('fs');
let c = fs.readFileSync('src/renderer/modules/caja/cajaView.js', 'utf8');
c = c.replace("const ventasTurno = ventas.filter(v =>", "require('fs').writeFileSync('ventas_dump.json', JSON.stringify(ventas.slice(0, 5), null, 2));\n         const ventasTurno = ventas.filter(v =>");
fs.writeFileSync('src/renderer/modules/caja/cajaView.js', c);
