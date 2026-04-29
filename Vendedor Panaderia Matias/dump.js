const fs = require('fs');
let c = fs.readFileSync('src/renderer/modules/caja/cajaView.js', 'utf8');
c = c.replace('${Object.keys(miTurno).join(", ")}', '${(async () => { try { require("fs").writeFileSync("miTurno.json", JSON.stringify(miTurno, null, 2)); } catch(e){} })() || Object.keys(miTurno).join(", ")}');
fs.writeFileSync('src/renderer/modules/caja/cajaView.js', c);
