const fs = require('fs');
let c = fs.readFileSync('src/renderer/modules/caja/cajaView.js', 'utf8');
c = c.replace('<p class="text-4xl font-black tracking-tighter">***</p>', '<p class="text-[10px] font-black tracking-tighter" style="word-break: break-all;">${Object.keys(miTurno).join(", ")}</p>');
fs.writeFileSync('src/renderer/modules/caja/cajaView.js', c);
