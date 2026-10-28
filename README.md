# Ley en Voz

App de Android para escuchar leyes con voz natural grabada, completas o por temas, con una explicación al final de cada tema. Cada ley es un paquete independiente: agregar una ley nueva no requiere reinstalar la app.

## Instalar la app

1. En el celular Android, abre este enlace y descarga el archivo:
   https://github.com/Artycert/LEY-EN-VOZ/raw/main/apk/LeyEnVoz-0.2.0.apk
2. Ábrelo desde las descargas. Android pedirá permitir instalar apps de este origen (del navegador o del administrador de archivos): acéptalo una vez.
3. Abre **Ley en Voz**. La primera vez necesita internet para bajar la lista de leyes.

Para escuchar sin internet, en la lista de leyes (botón con el nombre de la ley, arriba) oprime **Descargar para escuchar sin internet**.

## Leyes disponibles

| Ley | Fuente | Temas | Audio |
| --- | --- | --- | --- |
| Ley de Instituciones y Procedimientos Electorales del Estado de Campeche | Compendio Jurídico del Congreso del Estado de Campeche (documento para consulta, sin validez legal). Última reforma: Decreto 70, P.O. 28/mar/2025 | 72 | ≈ 12 h + 1 h 40 min de explicaciones |

Las explicaciones de cada tema se prepararon con Claude a partir del texto de la ley. Son una guía de estudio y no sustituyen la lectura de los artículos.

## Cómo está organizado

- `catalog.json`: lista de leyes que lee la app al abrirse, y la versión vigente de la app.
- `packs/<ley>/pack.json`: texto de la ley, temas, explicaciones y tiempos de cada frase del audio.
- `packs/<ley>/audio/`: `tNN.mp3` (lectura de cada tema) y `eNN.mp3` (explicación de cada tema).
- `apk/`: instaladores de la app.
- `app/`: proyecto de la app (Capacitor 6). La página está en `app/www/index.html`.
- `fuente/`: lo que genera todo lo anterior: el lector (`app.html`, `core.js`), los textos, las explicaciones y los programas de audio (voz Piper `es_MX-claude-high`).

## Agregar una ley

1. Limpiar el texto de la ley y dividirla en temas (`fuente/build/ranges.js`).
2. Escribir la explicación de cada tema (`fuente/build/expl.json`).
3. Grabar el audio (`gen_audio.py` y `gen_expl.py`).
4. Generar `packs/<ley>/` y agregar la ley a `catalog.json`. Al subir el cambio, la ley aparece en la app.

Si se corrige una ley ya publicada, se sube su paquete y se aumenta su número `v` en `catalog.json`: la app descarga la versión nueva.

## Compilar la app

Requiere Node, JDK 17 o superior y el SDK de Android (plataforma 34).

```
cd app
npm install
npx cap sync android
cd android
./gradlew assembleRelease
```

La llave de firma no está en el repositorio. Para firmar, crea `app/android/keystore.properties` con `storeFile`, `storePassword`, `keyAlias` y `keyPassword`. Las actualizaciones de la app deben firmarse con la misma llave.
