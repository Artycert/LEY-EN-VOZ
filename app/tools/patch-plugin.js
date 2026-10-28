// Arreglo al plugin de sesión multimedia: sin imagen de portada, setMetadata cerraba la app (NullPointerException).
const fs = require('fs');
const f = 'node_modules/@jofr/capacitor-media-session/android/src/main/java/io/github/jofr/capacitor/mediasessionplugin/MediaSessionPlugin.java';
let s = fs.readFileSync(f, 'utf8');
const old = 'final List<JSONObject> artworkList = artworkArray.toList();';
if (s.includes(old)) {
  s = s.replace(old, 'final List<JSONObject> artworkList = artworkArray != null ? artworkArray.toList() : new java.util.ArrayList<JSONObject>();');
  s = s.replace('String src = artwork.getString("src");\n            if (src != null) {\n                this.artwork = urlToBitmap(src);\n            }',
    'String src = artwork.optString("src", null);\n            if (src != null) {\n                try { this.artwork = urlToBitmap(src); } catch (Exception e) { Log.w(TAG, "No se pudo leer la portada", e); }\n            }');
  fs.writeFileSync(f, s);
  console.log('plugin parchado');
} else console.log('plugin ya parchado');
