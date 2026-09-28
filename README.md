# Spielplätze Glücksburg

Eine kleine, statische Übersicht von Spielplätzen in Glücksburg.

## Spielplatz hinzufügen oder ändern

1. Fotos (PNG oder JPG) in `assets/images/<id>/` legen, z. B. `assets/images/spielplatz-019/`.
   Das Branding (`assets/images/branding.png`) wird beim Aktualisieren automatisch unten rechts eingefügt.
2. In `assets/data/playgrounds.json` einen Eintrag ergänzen – VS Code schlägt die Felder automatisch vor:

   ```json
   {
     "id": "spielplatz-019",
     "name": "Beispielweg",
     "area": "Wohngebiet",
     "latitude": 54.8322,
     "longitude": 9.5609,
     "description": "Kurze Beschreibung.",
     "additional": "Optionaler Hinweis.",
     "photo": "spielplatz.png",
     "equipment": [
       { "name": "Rutsche", "photo": "rutsche.png" },
       { "name": "Hinweisschild", "photo": "schild.png", "showInList": false }
     ]
   }
   ```

3. `Strg+Umschalt+B` (Task „Website aktualisieren“) bzw. `python tools/build.py` ausführen.
   Das erzeugt die WebP-Bilder, prüft die Daten auf Fehler und aktualisiert Suchmaschinen-Daten und Cache.
4. Optional ansehen: Task „Vorschau starten“, dann http://localhost:8765 öffnen.
5. Committen und pushen.

Benötigt Python mit Pillow (`pip install pillow`).
