#import "template.typ": weblab-doc
#import "arbeitsjournal.typ": journal-table

#show: doc => weblab-doc(
  title: "HSLU Courses Skill Tree - Course Browser",
  subtitle: "WEBLAB Architektur-Dokumentation & Reflexion",
  doc
)

= 1. Projektumfang und Ausgangslage

Der *Course Browser* erweitert den HSLU Courses Skill Tree um eine such- und filterbare Katalogansicht mit Kursdetails und persistenten Rezensionen. Die Dokumentation konzentriert sich auf diese WEBLAB-Erweiterung; die Architekturabschnitte orientieren sich an arc42.

*Bereits vorhanden:* Der graphische Skill Tree, die Aufbereitung der HSLU-Katalogdaten, Studienplan und Fortschritt, GitHub-Anmeldung über Better Auth sowie das Hosting mit GitHub Pages, Cloudflare Workers und D1. Der Git-Tag `pre-weblab` markiert diesen Ausgangszustand.

*Nachweis der Umsetzung:* #link("https://github.com/jackra1n/hslu-courses-skill-tree/pull/16")[PR \#16: feat: add course browser] enthält die WEBLAB-Erweiterung. Der abgeschlossene Produktstand ist der Merge-Commit #link("https://github.com/jackra1n/hslu-courses-skill-tree/commit/1cc856d1a0225f9a390eabe8f7b2c0564d1fa087")[`1cc856d`]. Der #link("https://github.com/jackra1n/hslu-courses-skill-tree/compare/970711bfbd387fce4d2d11f98e871e0a0cca998e...1cc856d1a0225f9a390eabe8f7b2c0564d1fa087")[Vergleich mit dem Ausgangsstand `pre-weblab` (`970711b`)] zeigt den gesamten Produktbeitrag.

*Im Rahmen von WEBLAB ergänzt:*
- Course Browser unter `/courses` mit deutsch-englischer Suche nach Modul-ID und Titel.
- Kombinierbare Filter für Semester, Modultyp, Prüfungsform, ECTS und als Nächstes belegbare Module.
- Sortierung nach lokalisiertem Kursnamen oder durchschnittlicher Weiterempfehlung, jeweils auf- oder absteigend.
- Gemeinsame Kursdetails mit Tabs für Übersicht, Voraussetzungen und Rezensionen sowie Navigation zu Voraussetzungen ohne Filterverlust.
- Rezensionen mit vier Bewertungsdimensionen, optionalem Text und vollständigem CRUD für die eigene Rezension.
- Zugehörige Katalogerweiterungen, UI-Anpassungen sowie Unit-, Integrations- und E2E-Tests.

Skill Tree und Course Browser zeigen denselben Katalog in zwei unterschiedlichen Formen: als Abhängigkeitsgraph für die Studienplanung und als Liste für die Kurssuche.

= 2. Lösungsstrategie

Statische Katalogdaten und dynamische Rezensionen bleiben getrennt. Der Course Browser filtert den bereits geladenen Katalog lokal; eine Filteränderung benötigt keine Serveranfrage. Der Belegbarkeitsfilter verwendet den bestehenden Studienfortschritt und die Modulvoraussetzungen. Für die bewertungsbasierte Sortierung lädt die Oberfläche aggregierte Weiterempfehlungen über die API; ohne diese Daten bleibt die Namenssortierung verfügbar.

Rezensionen werden über den bestehenden API-Worker in D1 gespeichert. Die vorhandene Better-Auth-Sitzung identifiziert den Benutzer. Lesen ist öffentlich; Erstellen, Bearbeiten und Löschen erfordern eine Anmeldung. Damit benötigt die Erweiterung weder einen zusätzlichen Backend-Dienst noch eine zweite Anmeldung.

= 3. Bausteinsicht

#block(breakable: false)[
  #set par(justify: false)
  #table(
    columns: (3.4cm, 1fr),
    table.header([*Baustein*], [*Verantwortung und Herkunft*]),
    [Course Browser\ *Neu*], [SvelteKit-Route `/courses`: verbindet Suche, Filter, Trefferliste und ausgewähltes Modul. Lokale Svelte-Runes halten den Ansichtsstatus; reine Filterfunktionen berechnen die Treffer.],
    [Kursdetails und Reviews\ *Neu*], [Gemeinsame Tabs für Übersicht, Voraussetzungen und Rezensionen in Course Browser und Skill Tree. Das Formular unterstützt Erstellen, Bearbeiten und bestätigtes Löschen; Speicherfehler erhalten den Entwurf.],
    [Katalog und Fortschritt\ *Bestand, erweitert*], [Gemeinsame Datenbasis beider Ansichten. WEBLAB ergänzt Prüfungsformen, Unterrichtssprachen und die Verwendung des Studienfortschritts für Belegbarkeit und Voraussetzungshinweise.],
    [API-Worker und Auth\ *Bestand, erweitert*], [Better Auth verwaltet GitHub-Anmeldung und Sitzungen. Das neue Review-Modul validiert Anfragen und setzt Besitzrechte durch.],
    [Cloudflare D1\ *Bestand, erweitert*], [Bestehende Benutzer-, Sitzungs- und Fortschrittsdaten; neue Tabelle `reviews` mit Migration und Integritätsregeln.],
  )
]

== Review-Ressource und Schnittstellen

Eine Rezension enthält Kurs- und Benutzerzuordnung, vier Ganzzahlbewertungen von 1 bis 5, optionalen Text sowie Erstellungs- und Änderungszeitpunkt. *Weiterempfehlung* und *Inhaltsinteresse* sind Wertungen; *Schwierigkeit* und *Aufwand* sind beschreibende Skalen. Durchschnittswerte werden pro Dimension berechnet, nicht zu einem Gesamtscore vermischt.

#block(breakable: false)[
  #set par(justify: false)
  #table(
    columns: (auto, 1fr),
    table.header([*Route*], [*Vertrag*]),
    [`GET /api/course-review-scores`], [Öffentliche Weiterempfehlungsdurchschnitte und Anzahl Rezensionen je bewertetem Kurs für die Sortierung.],
    [`GET /api/courses/:courseId/reviews`], [Öffentliche Rezensionen und getrennte Durchschnittswerte; `ownReviewId` kennzeichnet die eigene Rezension bei angemeldeten Benutzern.],
    [`POST /api/courses/:courseId/reviews`], [Erstellt eine Rezension für den angemeldeten Benutzer.],
    [`PUT /api/reviews/:id`], [Bearbeitet ausschliesslich die eigene Rezension.],
    [`DELETE /api/reviews/:id`], [Löscht ausschliesslich die eigene Rezension.],
  )
]

Die öffentliche Ausgabe enthält keine Namen oder Benutzer-IDs. Intern bleibt die Kontozuordnung für Besitzprüfungen erhalten; namenlose Anzeige bedeutet keine anonyme Speicherung.

= 4. Laufzeitsicht

== Kurse finden und Voraussetzungen öffnen

1. `/courses` lädt den statischen Katalog.
2. Suche und Filter werden lokal ausgewertet: verschiedene Filtergruppen mit UND, mehrere Werte derselben Gruppe mit ODER.
   Die Treffer werden nach Name oder durchschnittlicher Weiterempfehlung sortiert. Unbewertete Kurse stehen bei Bewertungssortierung zuletzt; gleiche Bewertungen werden alphabetisch geordnet.
3. Eine Kursauswahl öffnet die Details neben der Liste oder auf kleinen Bildschirmen als Dialog.
4. Ein Klick auf eine Voraussetzung wechselt zum referenzierten Modul, auch ausserhalb der aktuellen Treffer. Filter bleiben erhalten; beim Schliessen kehrt der Fokus zur ursprünglichen Kurszeile zurück.

== Rezension erstellen, bearbeiten und löschen

1. Die Detailansicht lädt Rezensionen und gegebenenfalls `ownReviewId`.
2. Der angemeldete Benutzer übermittelt vier Bewertungen und optionalen Text. Die Sitzung wird über das bestehende Cookie mitgesendet.
3. Der Worker prüft Origin, Sitzung, Kurs-ID und Eingaben. Text ist auf 5'000 Zeichen begrenzt; Bewertungen müssen Ganzzahlen von 1 bis 5 sein.
4. D1 speichert die Rezension. Ein Unique-Constraint verhindert eine zweite Rezension desselben Benutzers zum selben Kurs, auch bei konkurrierenden Anfragen.
5. Bearbeitung und Löschung prüfen erneut den Besitzer. Erfolgreiches Erstellen liefert `201`, Löschen `204`. Die Oberfläche aktualisiert Rezensionen und Durchschnittswerte; fehlgeschlagene Speicherung erhält den Entwurf.

= 5. Verteilungssicht

Die Anwendung ist unter #link("https://hsluskilltree.com")[hsluskilltree.com] veröffentlicht; der Course Browser ist über #link("https://hsluskilltree.com/courses")[/courses] erreichbar. GitHub Pages liefert den statischen SvelteKit-Build aus. Anfragen an `hsluskilltree.com/api/*` verarbeitet der Cloudflare Worker. Dieser greift über ein Binding auf D1 zu; der Browser hat keinen direkten Datenbankzugang. GitHub ist zugleich der externe OAuth-Anbieter.

GitHub Actions prüft Übersetzungen, Typen, Linting und alle drei Testebenen. Das Deployment veröffentlicht Frontend und Worker und führt die versionierten D1-Migrationen aus. WEBLAB ergänzt diese Pipeline um die Browserprüfungen, statt eine separate Deployment-Infrastruktur einzuführen.

= 6. Querschnittliche Konzepte

*Zugriffsschutz:* Die bestehende Authentifizierung verwendet geschützte `HttpOnly`- und `SameSite=Lax`-Sitzungscookies. Der neue Review-Code übernimmt die Benutzer-ID ausschliesslich aus der Sitzung und prüft bei Schreibzugriffen zusätzlich den Origin und die Besitzrechte.

*Datenintegrität:* Parametrisierte SQL-Anweisungen, Fremdschlüssel mit `ON DELETE CASCADE`, Wertebereichsprüfungen und `UNIQUE(course_id, user_id)` sichern die Review-Ressource serverseitig ab.

*Responsive Bedienung:* Mobile Filter sind einklappbar. Der Kursdetaildialog begrenzt den Tastaturfokus, unterstützt Escape und stellt den ursprünglichen Fokus wieder her. Suche und Fachtexte sind deutsch und englisch verfügbar.

*Tests:* Frontend-Tests prüfen Katalog, Filterlogik und Voraussetzungsauswertung. Worker-Integrationstests decken bestehende APIs, Review-CRUD und Bewertungsaggregate ab. Playwright prüft Desktop- und Mobilabläufe für Filter, Sortierung, gemeinsame Kursdetails, Fokusführung, persistentes Review-CRUD, Zugriffsrechte sowie Navigation und Einführung.

Die E2E-Tests verwenden das Produktionsbundle, den echten Worker, isolierte migrierte D1-Datenbanken und echte Testsitzungen. Der externe GitHub-OAuth-Ablauf ist nicht automatisiert. Ausführung unter `frontend/`: `bun run web:test`, `bun run worker:test` und `bun run e2e:test`; Playwright benötigt einmalig `bunx playwright install chromium`.

= 7. Architekturentscheidungen

- *Erweiterung statt zweiter Anwendung:* Gemeinsamer Katalog, Anmeldung und Fortschritt verbinden die beiden Ansichten. Eine separate Anwendung würde Daten und Infrastruktur duplizieren.
- *Lokale statt serverseitiger Filterung:* Der semesterweise aktualisierte Katalog ist kompakt genug für den Browser. Das vermeidet Netzwerkanfragen beim Filtern; Katalogänderungen benötigen dafür einen neuen Build.
- *Bestehendes D1 statt zusätzlicher Datenbank:* Relationale Constraints passen zur Besitzerzuordnung und Eindeutigkeit von Rezensionen. Die Erweiterung bleibt damit an die vorhandene Cloudflare-Infrastruktur gebunden.
- *Eine Rezension pro Benutzer und Kurs:* Aktualisieren statt mehrfach bewerten verhindert verzerrte Durchschnittswerte. Die vier Dimensionen bleiben fachlich getrennt.

= 8. Qualitätsnachweis

#let quality = json("quality/summary.json")
#let category-keys = ("performance", "accessibility", "best-practices", "seo")

Lighthouse #quality.lighthouseVersion, gemessen am 20. September 2026 an der veröffentlichten Anwendung auf #link(quality.deployment.url)[hsluskilltree.com], Produktstand #raw(quality.productRevision). Nach erfolgreichem Deployment wurde je Ansicht ein mobiler und ein Desktop-Erstaufruf ohne gespeicherte Einstellungen gemessen, nacheinander und mit den jeweiligen Lighthouse-Standardprofilen. Umgebung, Deployment-Nachweis und Befehle stehen in `quality/summary.json`.

#block(breakable: false, table(
  columns: (2.9cm, 1fr, 1fr, 1fr, 1fr, 1fr),
  align: (left + horizon, center + horizon, center + horizon, center + horizon, center + horizon, center + horizon),
  table.header([*Ansicht / Profil*], [*Perf.*], [*A11y*], [*Best Pr.*], [*SEO*], [*Ø*]),
  ..quality.runs.map(run => (
    [#text(hyphenate: false)[#run.label] \ #run.profile],
    ..category-keys.map(key => [#str(run.scores.at(key))]),
    [*#str(run.average)*],
  )).flatten(),
))

Die Bewertung konzentriert sich auf die Nutzung durch Menschen. Agentic Browsing wird nicht einbezogen. Der Mittelwert der vier ausgewerteten Kategorien liegt auf Desktop und Mobil jeweils über 90.

*Grenzen:* Der mobile Course Browser erreicht 89 Performance-Punkte bei einem LCP von 3.17 s und 154 ms Total Blocking Time. Beim Skill Tree meldet Lighthouse ein ungültiges ARIA-Attribut im Driver.js-Willkommensdialog sowie auf Desktop zusätzlich eine übersprungene Überschriftenebene bei der Statuslegende; die Accessibility-Werte betragen 94 mobil und 92 auf Desktop. Die Einzelmessungen erfassen den Erstaufruf, nicht alle Dialoge oder Tutorial-Schritte. Es sind Labordaten der produktiven Website, keine Felddaten oder vollständige WCAG-Prüfung. Sie sind wegen der anderen Auslieferungsumgebung nicht direkt mit den früheren lokalen Messungen vergleichbar.

= 9. Reflexion und Fazit

*Gut gelungen:* Die Wiederverwendung von Katalog, Anmeldung und D1 ermöglicht eine zusammenhängende Erweiterung statt einer zweiten Anwendung. Die reine Filterlogik und die Review-Constraints lassen sich unabhängig von der Oberfläche prüfen; E2E-Tests ergänzen die tatsächlichen Benutzerabläufe.

*Herausforderungen:* Kursdetails mussten auf kleinen Bildschirmen kompakt bleiben. Gemeinsame Tabs für Übersicht, Voraussetzungen und Rezensionen vereinheitlichen nun beide Ansichten. Die Navigation zu Voraussetzungen ausserhalb der Trefferliste erfordert weiterhin getrennte Zustände für Filter, Auswahl und Fokus. Mobile Navigation und Einführung wurden iterativ vereinfacht; bei Rezensionen bleiben namenlose Anzeige und interne Besitzerzuordnung klar getrennt.

*Für ein nächstes Projekt:* Die isolierte Worker-/D1-Testumgebung sollte früher verfügbar sein. Damit können Persistenz, Authentifizierung und Fehlerzustände bereits während der Oberflächenentwicklung gemeinsam geprüft werden. Kurze Layout-Iterationen mit realen Kursdaten helfen, unnötige Detailfülle früh zu erkennen.


#pagebreak()
= 10. Arbeitsjournal
#journal-table()
