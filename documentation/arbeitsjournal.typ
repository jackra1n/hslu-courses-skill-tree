#import "template.typ": primary-color, secondary-color, border-color, muted-color, callout

#let target-hours = 60.0

// Liste aller Arbeitsjournal-Einträge
// Neue Einträge werden am Ende des Arrays hinzugefügt
#let journal-entries = (
  (
    date: "2026-09-04",
    hours: 1.5,
    activity: "Projekt-Kickoff: Analyse der Modulanforderungen für WEBLAB, Konzeption der Repository- und Worktree-Struktur, Planung der Architektur-Dokumentation sowie Aufsetzen der Typst-Umgebung."
  ),
  (
    date: "2026-09-05",
    hours: 1.0,
    activity: "Course-Browser Grundgerüst: neue Route /courses als einfache Katalogliste auf Basis des bestehenden statischen Kurskatalogs angelegt, Styling an das App-Theme (Light/Dark-Tokens, Kartenlayout) angeglichen, Typcheck/Lint/Build verifiziert."
  ),
  (
    date: "2026-09-05",
    hours: 0.5,
    activity: "Theme-Fix: Darkmode galt nur auf der Startseite, da themeStore nur dort initialisiert wurde. Initialisierung von Theme und Locale ins Root-Layout (+layout.svelte) verlagert, redundante Aufrufe aus den Seiten entfernt."
  ),
  (
    date: "2026-09-06",
    hours: 1.0,
    activity: "Course-Browser Header und Kurszeilen: schlanken Seiten-Header mit Skill-Tree-Rücklink, Login und Einstellungen statt vollem App-Header umgesetzt, mobile Warnung auf den Skill Tree begrenzt, Kurse als einspaltige Zeilen mit Modultyp- und Semester-Badges sowie Voraussetzungs- und Assessment-Hinweisen in neuer CourseRow-Komponente dargestellt, auf Desktop und Mobil verifiziert."
  ),
  (
    date: "2026-09-06",
    hours: 1.0,
    activity: "Course-Browser Suche: bilinguale Volltextsuche über Modul-ID sowie deutsche und englische Titel umgesetzt, Trefferzähler (x von y Kursen) und Empty-State mit Zurücksetzen sowie Clear-Button im Suchfeld hinzugefügt, auf Desktop und Mobil verifiziert."
  ),
  (
    date: "2026-09-08",
    hours: 3.0,
    activity: "Mehrkriterien-Filter und Filter-Sidebar: reine filterCourses-Funktion (Suche, Semester, Modultyp, ECTS-Bereich) mit Unit-Tests angelegt, ECTS-Auswahl von Buckets auf inklusiven Bereich umgestellt, Filter in linke Sidebar verlegt (Desktop sticky mit Überschrift, mobil einklappbar mit Zähler-Badge), Dual-Thumb-ECTS-Slider über reale Katalogwerte ohne Dead-Zones umgesetzt, Darkmode-Popup-Fix für native Selects in Theme-CSS ergänzt, Layout-Iterationen per Screenshot verifiziert, Typcheck/Lint/Tests/Build verifiziert."
  ),
  (
    date: "2026-09-15",
    hours: 0.5,
    activity: "Course-Browser Feinschliff und Fehlerbehebungen: Seitenlayout auf Viewporthöhe begrenzt und Kursliste als eigenständig scrollbar umgesetzt, Dual-Thumb-ECTS-Slider so geklemmt, dass Unter- und Obergrenze nicht überkreuzt werden können, sowie Tutorial aus dem globalen Layout in die Skill-Tree-Seite verschoben und Tutorial-Aktion in den Course-Browser-Einstellungen ausgeblendet. Scrollverhalten auf Desktop und Mobil sowie Slider- und Tutorialverhalten im Browser und Typcheck/Lint verifiziert."
  ),
  (
    date: "2026-09-15",
    hours: 2.0,
    activity: "Responsive Kursdetailansicht: auswählbare Kurszeilen mit dauerhaftem Detailbereich auf grossen Bildschirmen sowie zugänglichem Overlay auf Tablet und Mobil umgesetzt. Modul-ID, lokalisierter Titel, ECTS, Modultyp, Angebotssemester und strukturierte Voraussetzungen inklusive UND-/ODER-Verknüpfungen, Bestehensanforderungen und Zusatzhinweisen dargestellt. Fokusführung, Escape-Schliessen, Scrollverhalten und Layoutbreite auf Desktop und Mobil iterativ im Browser verifiziert."
  ),
  (
    date: "2026-09-15",
    hours: 1.5,
    activity: "Personalisierter Kursfilter: Option «Nur Module anzeigen, die ich als Nächstes belegen kann» in die Filter-Sidebar integriert und mit dem reaktiven Fortschritt des Skill Trees verbunden. Bereits besuchte oder bestandene Module, nicht erfüllte Voraussetzungen und die Assessment-Stufe berücksichtigt, Kombination mit allen bestehenden Filtern und Zurücksetzen umgesetzt sowie die Fachlogik mit Regressionstests und den vollständigen UI-Ablauf auf Desktop und Mobil verifiziert."
  ),
  (
    date: "2026-09-15",
    hours: 2.0,
    activity: "Lokalisierung und Prüfungsformen: verbliebene fest codierte Texte des Course Browsers in die deutsch-englischen Übersetzungskataloge verschoben. ModeOfAssessments aus zehn HSLU-Semesterständen mit 591 aktuellen Modulen analysiert, neun Rohwerte auf vier stabile Kategorien für Semesterarbeit, schriftliche, mündliche und elektronische Prüfung normalisiert und im Kursdetail als lokalisierte Badges angezeigt. Mehrfachwerte im Katalog erhalten, in der UI zusammengefasst und unbekannte zukünftige Werte durch strikte Generatorvalidierung abgesichert. Unit-Tests, Internationalisierungsprüfung, Typcheck, Build und beide Sprachvarianten im Browser verifiziert."
  ),
  (
    date: "2026-09-16",
    hours: 2.0,
    activity: "Design-Konsistenz zwischen Course Browser und Skill Tree: Desktop-Positionierung des Browser-Detailpanels korrigiert, gemeinsame Modultyp-Badges mit einheitlichen Farben eingeführt und lokalisierte Prüfungsformen auch in regulären und Wahlmodul-Details des Skill Trees ergänzt. Informationshierarchie und Voraussetzungsdarstellung angeglichen. Nach Nutzerfeedback die zunächst zu grosszügigen Metadatenkarten wieder entfernt und beide Detailansichten auf kleinere Titel, Inline-Metadaten und kompaktere Abstände umgestellt; Verfügbarkeit durch eine hervorgehobene Beschriftung klarer gegliedert. Skill-Tree-Drawer mit einheitlichem Breakpoint, Fokusführung, Escape-Schliessen, Scroll-Reset und korrigierter Überlagerung des Headers verbessert. Desktop- und Mobilansichten sowie deutsche und englische Prüfungslabels im Browser geprüft; Typchecks, Tests und Build durchgeführt. Aufwand geschätzt."
  ),
  (
    date: "2026-09-16",
    hours: 1.0,
    activity: "Voraussetzungen im Course Browser iterativ überarbeitet: zunächst Textkontrast und Gruppierung verbessert, anschliessend die weiterhin schwer unterscheidbaren Einträge durch kompakte, anklickbare Kurskarten ersetzt. Wiederholte Buch-Icons und linke Trennlinien entfernt; Modul-ID, Kurstitel und Modultyp-Badge rechts oben geben jeder Voraussetzung eine klare visuelle Einheit. Klick und Tastaturaktivierung öffnen den referenzierten Kurs im selben Detailpanel, ohne die Filter zu verändern; Scrollposition und Fokus werden beim Wechsel zurückgesetzt, beim Schliessen kehrt der Fokus zum ursprünglichen Listeneintrag zurück. Fehlende Katalogreferenzen bleiben nicht interaktiv. Navigation, Filtererhalt und Darstellung auf Desktop und Mobil sowie Typcheck verifiziert. Aufwand geschätzt."
  ),
  (
    date: "2026-09-16",
    hours: 0.75,
    activity: "Mehrfachauswahl für Modultyp und Prüfungsformen: Modultyp-Dropdown durch eine Checkbox-Liste ersetzt und eine gleich gestaltete Liste für Semesterarbeit, schriftliche, mündliche und elektronische Prüfung ergänzt. Ausgewählte Werte innerhalb einer Gruppe werden mit ODER, unterschiedliche Filtergruppen mit UND verknüpft; leere Auswahl bedeutet keine Einschränkung. Filterzustand, Aktivitätszähler, Zurücksetzen und bestehende Tests auf den neuen Vertrag umgestellt, gemeinsame Übersetzungsfunktion für Prüfungsformen extrahiert und obsolete Texte entfernt. Filterbereich für kleine Viewports scrollbar gemacht, damit die Trefferliste erreichbar bleibt. Mehrfachauswahl und Zurücksetzen auf Desktop und Mobil geprüft; 13 Filter- und Belegbarkeitstests, Typcheck und Produktionsbuild erfolgreich. Aufwand geschätzt."
  ),
)

// Berechnung der Statistiken
#let compute-journal-stats(entries) = {
  let total = 0.0
  for e in entries {
    total += e.hours
  }
  let pct = calc.round((total / target-hours) * 100, digits: 1)
  (total: total, remaining: calc.max(0.0, target-hours - total), percentage: pct)
}

#let journal-summary(entries: journal-entries) = {
  let stats = compute-journal-stats(entries)
  block(
    width: 100%,
    stroke: 1pt + border-color,
    radius: 4pt,
    fill: rgb("#f8fafc"),
    inset: 12pt,
    [
      #grid(
        columns: (1fr, 1fr, 1fr),
        align: center,
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[GESAMTER ARBEITSAUFWAND] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: primary-color)[#str(stats.total) h]
        ],
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[SOLL-AUFWAND] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: primary-color)[#str(target-hours) h]
        ],
        [
          #text(size: 0.82em, fill: muted-color, weight: "bold")[FORTSCHRITT] \
          #v(0.2em)
          #text(size: 1.35em, weight: "bold", fill: if stats.percentage >= 100 { rgb("#166534") } else { secondary-color })[#str(stats.percentage)%]
        ]
      )
    ]
  )
}

#let journal-table(entries: journal-entries) = {
  let running = 0.0
  let rows = ()
  let idx = 0
  for entry in entries {
    running += entry.hours
    let bg = if calc.even(idx) { rgb("#ffffff") } else { rgb("#f8fafc") }
    rows.push(table.cell(fill: bg)[#entry.date])
    rows.push(table.cell(fill: bg)[#str(entry.hours) h])
    rows.push(table.cell(fill: bg)[#entry.activity])
    rows.push(table.cell(fill: bg)[#str(running) h])
    idx += 1
  }

  table(
    columns: (2.5cm, 1.8cm, 1fr, 2.2cm),
    align: (center + horizon, right + horizon, left + horizon, right + horizon),
    stroke: (x, y) => if y == 0 {
      (bottom: 1.5pt + primary-color)
    } else {
      (bottom: 0.5pt + border-color)
    },
    table.header(
      table.cell(fill: rgb("#f1f5f9"))[*Datum*],
      table.cell(fill: rgb("#f1f5f9"))[*Aufwand*],
      table.cell(fill: rgb("#f1f5f9"))[*Aktivität / Beschreibung*],
      table.cell(fill: rgb("#f1f5f9"))[*Kumuliert*]
    ),
    ..rows,
    table.cell(colspan: 3, fill: rgb("#f1f5f9"), align: right + horizon)[*Gesamtaufwand:*],
    table.cell(fill: rgb("#f1f5f9"), align: right + horizon)[*#str(running) h*]
  )
}

// Eigenständige Ansicht (Standalone Compilation)
#let is-standalone = sys.inputs.at("standalone", default: "true") == "true"

#if is-standalone [
  #set page(
    paper: "a4",
    margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
    header: [
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 8.5pt, fill: muted-color)[HSLU Courses Skill Tree - Arbeitsjournal],
        text(size: 8.5pt, fill: muted-color)[WEBLAB]
      )
      #line(length: 100%, stroke: 0.5pt + border-color)
    ],
    footer: context [
      #line(length: 100%, stroke: 0.5pt + border-color)
      #grid(
        columns: (1fr, auto),
        align: (left, right),
        text(size: 8.5pt, fill: muted-color)[jackra1n - HSLU Informatik],
        text(size: 8.5pt, fill: muted-color)[Seite #counter(page).display("1")]
      )
    ]
  )
  #set text(
    font: ("Liberation Sans", "Noto Sans", "Cantarell"),
    size: 10pt,
    lang: "de",
    spacing: 120%
  )

  = Arbeitsjournal - WEBLAB

  #v(0.5em)
  Dieses Arbeitsjournal dokumentiert den kontinuierlichen Arbeitsaufwand für das Projekt *HSLU Courses Skill Tree - Course Browser* im Rahmen des Moduls *WEBLAB* an der Hochschule Luzern (HSLU). Der Richtwert für den Gesamtaufwand beträgt rund 60 Stunden über das gesamte Semester.

  #v(0.8em)
  #journal-summary()
  #v(1em)

  #journal-table()
]
