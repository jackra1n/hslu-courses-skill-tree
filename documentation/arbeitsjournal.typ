#import "template.typ": border-color

#let journal-entries = (
  (date: "2026-09-04", hours: 1.5, activity: "WEBLAB-Anforderungen analysiert, Projektumfang abgegrenzt und Typst-Dokumentation eingerichtet."),
  (date: "2026-09-05", hours: 1, activity: "Course-Browser-Route mit Katalogliste und bestehendem App-Theme aufgebaut."),
  (date: "2026-09-05", hours: 0.5, activity: "Globale Initialisierung von Theme und Sprache korrigiert."),
  (date: "2026-09-06", hours: 1, activity: "Course-Browser-Header und kompakte Kurszeilen für Desktop und Mobil umgesetzt."),
  (date: "2026-09-06", hours: 1, activity: "Deutsch-englische Suche nach Modul-ID und Titel mit Trefferzähler und Zurücksetzen ergänzt."),
  (date: "2026-09-08", hours: 3, activity: "Kombinierbare Filter, responsive Filter-Sidebar und ECTS-Bereichsauswahl mit Tests umgesetzt."),
  (date: "2026-09-12", hours: 0.5, activity: "Scrollbereiche und ECTS-Grenzen korrigiert; Tutorial auf den Skill Tree begrenzt."),
  (date: "2026-09-12", hours: 2, activity: "Responsive Kursdetails mit Voraussetzungen, Dialog und Fokusführung umgesetzt."),
  (date: "2026-09-12", hours: 1.5, activity: "Belegbarkeitsfilter anhand von Fortschritt, Voraussetzungen und Assessment-Stufe ergänzt und getestet."),
  (date: "2026-09-13", hours: 2, activity: "Prüfungsformen im Katalog normalisiert, angezeigt und deutsch-englische Übersetzungen vervollständigt."),
  (date: "2026-09-13", hours: 2, activity: "Kursdetails und Metadaten zwischen Course Browser und Skill Tree vereinheitlicht; mobile Bedienung geprüft."),
  (date: "2026-09-14", hours: 1, activity: "Anklickbare Voraussetzungen mit Filtererhalt und korrekter Fokus-Rückkehr umgesetzt."),
  (date: "2026-09-14", hours: 0.75, activity: "Mehrfachauswahl für Modultypen und Prüfungsformen ergänzt und Filterkombinationen getestet."),
  (date: "2026-09-14", hours: 2, activity: "Gemeinsame Dropdowns und Header-Positionierung vereinheitlicht; Tastaturbedienung geprüft."),
  (date: "2026-09-15", hours: 3, activity: "Review-Schema, Migration und CRUD-API mit Validierung, Besitzrechten und Integrationstests umgesetzt."),
  (date: "2026-09-16", hours: 3, activity: "Review-Formular, getrennte Bewertungsdurchschnitte und namenlose Anzeige integriert; Fehlerfälle und mobile Ansicht geprüft."),
  (date: "2026-09-17", hours: 3, activity: "Isolierte Playwright-Umgebung mit echtem Worker und D1 aufgebaut, Browserabläufe getestet und in CI integriert."),
  (date: "2026-09-18", hours: 2.5, activity: "Lighthouse-Messungen durchgeführt, Zugänglichkeitsfehler behoben und Tutorial ohne Dependency-Patch geprüft."),
  (date: "2026-09-19", hours: 2, activity: "Architektur, Reflexion und Arbeitsjournal überarbeitet; Qualitätsnachweis und PDF-Darstellung geprüft."),
  (date: "2026-09-19", hours: 2, activity: "Kursdetails von Course Browser und Skill Tree in gemeinsame Tabs überführt; Unterrichtssprachen und studienplanbezogene Voraussetzungshinweise ergänzt."),
  (date: "2026-09-20", hours: 3, activity: "Filter und Kurssortierung nach Name oder Weiterempfehlung ergänzt; mobile Navigation, Einführung und Panel-Bedienung überarbeitet. UI und UX iterativ verfeinert und zugehörige Tests erweitert."),
)

#let journal-table(entries: journal-entries) = {
  let total = 0.0
  let rows = ()
  for entry in entries {
    total += entry.hours
    rows.push([#entry.date])
    rows.push([#str(entry.hours) h])
    rows.push([#entry.activity])
  }
  table(
    columns: (2.7cm, 1.5cm, 1fr),
    align: (left + horizon, right + horizon, left + horizon),
    stroke: 0.5pt + border-color,
    inset: (x: 7pt, y: 5pt),
    table.header([*Datum*], [*Dauer*], [*Tätigkeit*]),
    ..rows,
    table.cell(colspan: 2)[*Total*],
    [*#str(total) h*],
  )
}

#if sys.inputs.at("standalone", default: "true") == "true" [
  #set page(paper: "a4", margin: 2cm, footer: context align(right)[#counter(page).display("1")])
  #set text(font: ("Liberation Sans", "Noto Sans", "Cantarell"), size: 10pt, lang: "de")
  = Arbeitsjournal - WEBLAB
  #journal-table()
]
