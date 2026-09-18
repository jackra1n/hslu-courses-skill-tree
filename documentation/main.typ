#import "template.typ": weblab-doc, adr, callout, primary-color, secondary-color, border-color, muted-color
#import "arbeitsjournal.typ": journal-table, journal-summary, journal-entries

#show: doc => weblab-doc(
  title: "HSLU Courses Skill Tree - Course Browser",
  subtitle: "WEBLAB Architektur-Dokumentation (arc42) & Modulbericht",
  author: "jackra1n",
  course: "WEBLAB - Web Programming Lab",
  institution: "Hochschule Luzern - Departement Informatik",
  semester: "Herbstsemester 2026",
  doc
)

= 1. Einführung & Ziele

== 1.1 Kontext & Hintergrund
Die vorliegende Dokumentation begleitet das Semesterprojekt im Modul *WEBLAB (Web Programming Lab)* an der *Hochschule Luzern (HSLU)*.

Das Vorhaben baut auf einem bereits existierenden Projekt auf, dem *HSLU Courses Skill Tree*, welches im Haupt-Repository gepflegt wird. Die Modulleitung hat die Weiternutzung und Erweiterung dieser bestehenden Codebasis explizit genehmigt, unter der zentralen Auflage, dass alle im Rahmen von WEBLAB erbrachten Leistungen eindeutig vom Vorzustand abgrenzbar und nachvollziehbar sind.

#callout(title: "Arbeitsentwurf, kein Implementierungsnachweis", fill-color: rgb("#eff6ff"), stroke-color: secondary-color)[
  Dieses Dokument enthält neben bestehenden Bausteinen auch die geplante Zielarchitektur. Review-Schema, Review-API und Review-Oberfläche sind implementiert; Playwright-E2E-Tests fehlen noch. Die Review-Abläufe wurden lokal im Browser gegen Worker und D1 mit synthetischen Benutzersitzungen geprüft. Der vollständige GitHub-OAuth-Ablauf wurde dabei nicht durchlaufen. Performance- und Barrierefreiheitsangaben sind Ziele, keine Messresultate oder Konformitätsnachweise. Die vollständige Überarbeitung und Reflexion erfolgen nach Abschluss der Implementierung.
]

Der Git-Tag:
#align(center)[
  #box(
    fill: rgb("#f1f5f9"),
    stroke: 1pt + border-color,
    radius: 4pt,
    inset: (x: 12pt, y: 6pt),
    text(font: "Liberation Mono", weight: "bold", size: 1.05em, fill: primary-color)[pre-weblab]
  )
]
markiert den verbindlichen Ausgangszustand vor Beginn der WEBLAB-Arbeiten. Sämtliche für die Leistungsbeurteilung relevanten Änderungen lassen sich als Differenz zwischen `pre-weblab` und dem finalen Abgabestand ableiten.

== 1.2 Kernziele & Projektumfang
Der funktionale Kern der WEBLAB-Erweiterung ist ein neuer, interaktiver *Course Browser*, der als entdeckungsorientierte Alternative zur bestehenden graphischen Skill-Tree-Ansicht fungiert.

Der geplante Projektumfang umfasst folgende Schwerpunkte:
- *Dedizierte Course-Browser-Ansicht (`/courses`):* Eine performante, filterbare Katalogansicht zum schnellen Auffinden und Vergleichen von HSLU-Modulen.
- *Mehrkriterien-Filterung & Volltextsuche:* Kombinierbare Filter nach Studiengang bzw. Major, Semestertyp (Herbstsemester / Frühlingssemester), Modulkategorie, ECTS-Umfang sowie Schlagwortsuche.
- *Zwei substanziell unterschiedliche Datendarstellungen:*
  + *Skill Tree:* Graphische, abhängigkeitsorientierte Visualisierung mit Fokus auf Studienverlauf, Semesterzuteilung und Modulvoraussetzungen.
  + *Course Browser:* Listen- bzw. kartenbasierte Katalogdarstellung, optimiert für exploratives Suchen, Filtern und Sortieren.
- *Kursbewertungen als vollständige CRUD-Ressource:* Authentifizierte Studierende können eigene Rezensionen und Bewertungen für Module erfassen (*Create*), ansehen (*Read*), bearbeiten (*Update*) und löschen (*Delete*).
- *Persistente Datenspeicherung:* Persistierung aller dynamischen Daten (Benutzerkonten, Sitzungen, Kursbewertungen) in Cloudflare D1.
- *Responsives Design & Barrierefreiheit:* Ergonomische Bedienbarkeit auf Desktop, Tablet und Smartphones bei durchgehend hohen Lighthouse-Werten ($>= 90$ Punkte in allen Kategorien).

= 4. Lösungsstrategie

Die Systemarchitektur verbindet maximale Reaktionsgeschwindigkeit für Endanwender mit geringer Betriebskomplexität durch den Einsatz moderner Edge-Infrastruktur:

1. *Client-seitiger Katalog & lokale Filterung:* Der Modulkatalog wird während der Datenaufbereitung in ein statisches JSON-Bündel transformiert. Such- und Filteroperationen laufen reaktiv im Browser, ohne pro Filteränderung eine Netzwerkanfrage auszulösen.
2. *Edge-API & persistente Datenspeicherung:* Dynamische Anforderungen (Authentifizierung, Rezensionen, Synchronisation) werden über eine leichtgewichtige Cloudflare-Worker-API verarbeitet. Als persistente Datenbank dient Cloudflare D1 (serverloses SQLite am Edge), was weltweite Verfügbarkeit mit minimalen Latenzen und voller ACID-Integrität verbindet.
3. *Authentifizierung via Better Auth:* Die Benutzerverwaltung basiert auf Better Auth innerhalb des Cloudflare Workers. Unterstützt werden GitHub OAuth sowie abgesicherte, HTTP-only Session-Cookies.
4. *Progressive Enhancement:* Modulsuche, Filter und der Skill Tree stehen anonymen Nutzern ohne Anmeldung uneingeschränkt zur Verfügung. Eine Authentifizierung ist ausschliesslich für schreibende Operationen erforderlich (Erstellen/Bearbeiten von Bewertungen, Cloud-Synchronisation des Studienplans).

= 5. Bausteinsicht

== 5.1 Level 1: Whitebox Gesamtsystem

#align(center)[
  #block(
    width: 90%,
    stroke: 1pt + border-color,
    radius: 4pt,
    inset: 12pt,
    fill: rgb("#f8fafc"),
    [
      #grid(
        columns: (1fr, 1fr, 1fr),
        gutter: 1em,
        align: center + horizon,
        [
          #box(fill: rgb("#e0f2fe"), stroke: 1pt + secondary-color, radius: 4pt, inset: 10pt, width: 100%)[
            *Frontend SPA* \
            #text(size: 0.85em, fill: muted-color)[SvelteKit, Vite, UnoCSS \ Desktop & Mobile UI]
          ]
        ],
        [
          #text(size: 1.5em)[$arrow.r.l$] \
          #text(size: 0.8em, fill: muted-color)[HTTPS / JSON]
        ],
        [
          #box(fill: rgb("#fef3c7"), stroke: 1pt + rgb("#d97706"), radius: 4pt, inset: 10pt, width: 100%)[
            *Cloudflare Worker* \
            #text(size: 0.85em, fill: muted-color)[Fetch-Handler \ Auth-, Progress- & Review-API]
          ]
        ]
      )
      #v(0.8em)
      #grid(
        columns: (1fr, 1fr, 1fr),
        gutter: 1em,
        align: center + horizon,
        [],
        [
          #text(size: 1.5em)[$arrow.t.b$] \
          #text(size: 0.8em, fill: muted-color)[D1-Binding]
        ],
        []
      )
      #v(0.4em)
      #box(fill: rgb("#dcfce7"), stroke: 1pt + rgb("#16a34a"), radius: 4pt, inset: 10pt, width: 60%)[
        *Cloudflare D1 (SQLite)* \
        #text(size: 0.85em, fill: muted-color)[Bestand: `user`, `session`, `account`, `verification`, `user_data` \ Erweiterung: `reviews`]
      ]
    ]
  )
]

== 5.2 Level 2: Frontend-Bausteine
Die Frontend-Architektur gliedert sich in folgende Hauptkomponenten:
- *Course-Browser-Ansicht (`/courses`):* Durchsuchbare Modulliste mit integrierter Mehrkriterien-Filterleiste (Semester, Studiengang, Modultyp, ECTS) und responsivem Kartenraster.
- *Skill-Tree-Ansicht (`/`):* Interaktiver Abhängigkeitsgraph, der Modulabfolgen und Semesterplanungen visualisiert.
- *Modul-Detailansicht (Panel / Dialog):* Präsentiert vertiefte Modulbeschreibungen, ECTS-Angaben, Vorbedingungen sowie die Liste der Rezensionen.
- *Bewertungs-Komponenten (Review UI):* Formular zur Erfassung und Bearbeitung mit vier Pflichtskalen und optionalem Text. Weiterempfehlung und Inhaltsinteresse verwenden Sterne, Schwierigkeit und Aufwand beschriftete Zahlenskalen. Separate Durchschnittswerte, eigene Bearbeitungsaktionen und ein nativer Lösch-Bestätigungsdialog ergänzen die öffentliche Rezensionenliste. Fehlgeschlagene Speicherungen behalten den Entwurf; Modul- und Benutzerwechsel setzen ihn zurück.
- *Zustandsverwaltung (Svelte Stores):* Reaktive Stores für Filterzustände, gecachten Modulkatalog, aktive Benutzersitzung und Synchronisationsstatus.
- *API-Client:* Typsicherer Fetch-Client für die Kommunikation mit den Endpunkten des Workers (`/api/reviews`, `/api/auth`).

== 5.3 Level 2: Backend-Bausteine
Das Backend wird durch einen einzelnen Cloudflare Worker bereitgestellt, welcher modulare Controller umfasst:
- *Authentifizierungs-Middleware:* Prüft Session-Tokens auf geschützten Routen mittels Better Auth.
- *Review-Controller:* Stellt folgende CRUD-Endpunkte bereit:
  - `GET /api/courses/:courseId/reviews`: Liefert alle Bewertungen sowie die berechneten Durchschnittswerte je Bewertungsdimension eines Moduls.
  - `POST /api/courses/:courseId/reviews`: Erstellt eine neue Bewertung (Authentifizierung vorausgesetzt, maximal eine Rezension pro Benutzer und Modul).
  - `PUT /api/reviews/:id`: Aktualisiert eine bestehende Bewertung (nur durch den Autor).
  - `DELETE /api/reviews/:id`: Entfernt eine Bewertung unwiderruflich (nur durch den Autor).
- *Datenbankschema (D1):* Relationale Tabellen mit Fremdschlüsseln und Integritätsregeln:
  - `user` / `session`: Durch Better Auth verwaltete Identitäten und Sitzungen.
  - `reviews`: Enthält `id`, `course_id`, `user_id`, `recommendation`, `content_interest`, `difficulty`, `workload`, `text`, `created_at` und `updated_at`. Text ist optional und wird bei reinen Bewertungen als leerer String gespeichert. Alle vier Skalen verwenden Ganzzahlen von 1 bis 5. Schwierigkeit und Aufwand sind beschreibend, nicht positiv oder negativ zu werten; es gibt keinen Gesamtdurchschnitt über alle Dimensionen. Ein Unique-Constraint auf `(course_id, user_id)` begrenzt die Anzahl auf eine Rezension pro Nutzer und Modul.

= 6. Laufzeitsicht

== 6.1 Szenario 1: Kurse durchsuchen und filtern
1. Der Benutzer navigiert zur Route `/courses`.
2. Das Frontend lädt das statische Katalog-Bündel (gecacht über HTTP-Header).
3. Der Benutzer verändert Filterkriterien (z. B. Studiengang = "Information & Cyber Security", Semester = "Herbstsemester", Kategorie = "Kernfach"):
   - Der Svelte-Store aktualisiert die aktiven Kriterien.
   - Die Filterung wird synchron im Browser-Speicher ausgeführt.
   - Das DOM aktualisiert die Modulkarten flüssig ohne jegliche Netzwerkanfrage.

== 6.2 Szenario: Kursbewertung erfassen (CRUD - Create)
1. Ein angemeldeter Benutzer öffnet die Detailansicht eines Moduls.
2. Der Client ruft `GET /api/courses/:courseId/reviews` ab, um existierende Rezensionen darzustellen.
3. Der Benutzer bewertet Weiterempfehlung und Inhaltsinteresse mit je 1–5 Sternen sowie Schwierigkeit (sehr leicht bis sehr schwer) und Aufwand (sehr niedrig bis sehr hoch) auf getrennten Skalen von 1–5. Optional verfasst er einen Kommentar.
4. Der Client sendet einen `POST /api/courses/:courseId/reviews`-Request inklusive Authentifizierungs-Cookie.
5. Der Worker validiert die Sitzung, prüft das Payload-Schema und kontrolliert, ob für dieses Modul bereits ein Eintrag des Benutzers vorliegt.
6. Der Worker fügt die Rezension in Cloudflare D1 ein und antwortet mit dem Status `201 Created`.
7. Der Client zeigt die neue Rezension und die aktualisierten Durchschnittswerte je Bewertungsdimension an.

== 6.3 Szenario: Bewertung anpassen und löschen (CRUD - Update & Delete)
1. Der Benutzer betrachtet seine eigene Rezension in der Modulansicht.
2. Die Oberfläche erkennt `review.userId === currentSession.user.id` und blendet Aktionen zum Bearbeiten und Löschen ein.
3. *Bearbeitung (Update):* Der Benutzer passt den Text oder die Bewertung an. Ein `PUT /api/reviews/:id`-Request wird ausgelöst. Der Worker verifiziert die Autorenschaft und aktualisiert den Datensatz in D1.
4. *Löschung (Delete):* Der Benutzer klickt auf "Löschen" und bestätigt den Dialog. Ein `DELETE /api/reviews/:id`-Request wird an den Worker gesendet. Nach erfolgreicher Autorisierungsprüfung entfernt D1 die Zeile und gibt `204 No Content` zurück.

= 7. Verteilungssicht

== 7.1 Infrastruktur-Komponenten
- *Statische Assets & Frontend-Hosting:* Auslieferung des statischen SvelteKit-Builds über GitHub Pages.
- *Serverlose Ausführung:* Cloudflare Workers führen die API-Logik unmittelbar an weltweiten Edge-Knoten mit minimaler Kaltstartzeit aus.
- *Relationaler Speicher:* Cloudflare D1 stellt eine verteilte SQLite-Instanz am Edge bereit.
- *Identitätsanbieter:* GitHub OAuth zur Authentifizierung von Studierenden und Entwicklern.

== 7.2 Continuous Integration & Continuous Deployment (CI/CD)
- GitHub Actions führt bei Pushes auf `master` und bei Pull Requests automatische Prüfschritte durch:
  1. *Übersetzungen, Linting & Typen:* Prüfung der Sprachkataloge, Biome, Svelte Check und TypeScript für den Worker.
  2. *Automatisierte Unit- & Integrationstests:* `bun run web:test` führt alle Frontend-Tests aus; `bun run worker:test` führt Vitest-Integrationstests in der lokalen Workers-/D1-Laufzeit aus.
  3. *Build:* Erstellung des Produktionsbundles.
- *Deployment:* Nach erfolgreicher CI auf `master` oder manueller Auslösung werden das Frontend auf GitHub Pages sowie D1-Migrationen und der API-Worker auf Cloudflare veröffentlicht. Automatische Preview-Deployments sind nicht eingerichtet.
- *End-to-End-Tests:* Playwright ist geplant und noch nicht in CI integriert.

= 8. Querschnittliche Konzepte

== 8.1 Authentifizierung und Autorisierung
Die Authentifizierung erfolgt über Better Auth mit D1-Backend. Sitzungstokens werden ausschliesslich in geschützten `HttpOnly`-, `SameSite=Lax`-Cookies übertragen. Autorisierungen folgen einem strikten Besitzmodell: Alle Besucher dürfen Bewertungen lesen; authentifizierte Nutzer dürfen maximal eine Bewertung pro Modul erstellen. Eine Bearbeitung oder Löschung ist ausschliesslich dem ursprünglichen Verfasser gestattet.

== 8.2 Persistenz und relationale Datenintegrität
Zur Gewährleistung der Konsistenz gelten folgende Massnahmen:
- Fremdschlüssel verknüpfen Bewertungen zwingend mit gültigen Benutzereinträgen (`ON DELETE CASCADE`).
- Ein zusammengesetzter Unique-Index `UNIQUE(course_id, user_id)` verhindert auf Datenbankebene zuverlässig doppelte Bewertungen.
- Parametrisierte Abfragen (Prepared Statements) in Cloudflare D1 schliessen SQL-Injection-Angriffe systematisch aus.

== 8.3 Responsives Design und Barrierefreiheit
- *Fluid Layout:* Responsive Breakpoints differenzieren zwischen Mobile (\<640px), Tablet (640px–1024px) und Desktop (>1024px).
- *Mobile Ergonomie:* Der Course Browser verwendet einklappbare Filter. Kursdetails erscheinen auf kleineren Bildschirmen als Overlay.
- *Barrierefreiheit:* Tastaturbedienbarkeit, Fokusführung und semantische Beschriftungen sind Entwicklungsziele. Eine vollständige WCAG-Konformitätsprüfung liegt noch nicht vor.

== 8.4 Teststrategie
- *Unit-Tests (Bun):* Prüfen Katalogaufbereitung, Katalogzugriff, kombinierte Filter und die Belegbarkeit von Kursen.
- *Integrationstests (Vitest + Cloudflare Workers Pool):* Prüfen Authentifizierung, Migrationen, die Progress-API und Review-CRUD mit einer lokalen D1-Instanz. Review-Tests verwenden echte Better-Auth-Sitzungen und prüfen unter anderem Besitzrechte, Origin-Prüfung, Eingabevalidierung und konkurrierende doppelte Bewertungen.
- *End-to-End-Tests (Playwright, geplant):* Sollen Katalogsuche, Filterkombinationen, Rezensions-CRUD und mobile Ansichten abdecken.

= 9. Architekturentscheidungen (ADRs)

#adr(
  id: "ADR-01",
  title: "Integration des Course Browsers in bestehendes Projekt",
  status: "Akzeptiert",
  ctx: [
    Die Aufgabenstellung verlangt ein substanzielles neues Feature sowie zwei unterschiedliche Datendarstellungen. Es musste entschieden werden, ob hierfür eine komplett neue Web-Applikation aufgesetzt oder das existierende HSLU-Skill-Tree-Projekt erweitert wird.
  ],
  decision: [
    Erweiterung des bestehenden Projekts um die neue Route `/courses` unter Wiederverwendung der gemeinsamen Infrastruktur (Authentifizierung, Datenmodelle, UI-Basiskomponenten).
  ],
  consequences: [
    Vermeidet redundanten Aufwand für Deployment, Scraper-Pipelines und Styling. Ergibt ein geschlossenes, praxisnahes Gesamtprodukt, in welchem Module direkt aus dem Browser in den persönlichen Studienplan übernommen werden können.
  ]
)

#adr(
  id: "ADR-02",
  title: "Cloudflare D1 als persistente relationale Datenbank",
  status: "Akzeptiert",
  ctx: [
    Für dynamische Anwendungsdaten (Bewertungen, Notenschnitte) wird eine persistente relationale Datenbank gefordert. Das Projekt nutzt bereits Cloudflare Workers.
  ],
  decision: [
    Einsatz von Cloudflare D1 (serverloses SQLite am Edge) zur Speicherung aller dynamischen Daten.
  ],
  consequences: [
    Nahtlose Integration in Cloudflare Workers ohne Netzwerk-Overhead. Vollwertige SQL-Unterstützung mit Foreign Keys und Unique-Constraints. Das Free-Tier deckt alle Anforderungen vollständig ab.
  ]
)

#adr(
  id: "ADR-03",
  title: "Client-seitiges Mehrkriterien-Filtern über statischen Katalog",
  status: "Akzeptiert",
  ctx: [
    Die HSLU-Moduldaten ändern sich pro Semester nur punktuell (~500 Module). Filterabfragen könnten via Backend-SQL oder client-seitig im Speicher gelöst werden.
  ],
  decision: [
    Bündelung des normalisierten Kurskatalogs als statische JSON-Datei (~120 KB gzip) und Ausführung aller Filter-, Sortier- und Suchoperationen direkt im Browser.
  ],
  consequences: [
    Unmittelbare Filterergebnisse ohne Server-Latenz (0 ms Netzwerkzeit). Massive Entlastung des Backends. Offline-Fähigkeit für das Durchsuchen des Modulkatalogs.
  ]
)

#adr(
  id: "ADR-04",
  title: "Einzelne Rezension pro Benutzer-Kurs-Paar",
  status: "Akzeptiert",
  ctx: [
    Kursbewertungen sollen studentische Erfahrungen abbilden. Mehrfachabgaben desselben Nutzers könnten Notenschnitte verzerren.
  ],
  decision: [
    Durchsetzung von maximal einer Bewertung pro Benutzer und Kurs über einen datenbankseitigen `UNIQUE(course_id, user_id)`-Constraint. Nutzer können ihren Eintrag jederzeit anpassen oder löschen.
  ],
  consequences: [
    Verhindert Duplikate, vereinfacht die Aggregation von Notenschnitten und sorgt für eine intuitive Benutzeroberfläche: Ein Nutzer sieht entweder den Button "Bewertung abgeben" oder seine eigene bestehende Rezension mit Optionen zum Bearbeiten und Löschen.
  ]
)

= 10. Qualitätsanforderungen

#table(
  columns: (2.8cm, 3.5cm, 1fr),
  align: (center + horizon, left + horizon, left + horizon),
  table.header([*Qualitätsziel*], [*Metrik / Anforderung*], [*Architektonische Massnahme*]),
  [Performance], [Lighthouse-Score $>= 90$ auf Desktop & Mobile], [Client-seitiges Filtern, statisches Asset-Caching, schlanke Bundle-Grösse, Vermeidung unnötiger Re-Renders.],
  [Usability], [Responsiv & touch-optimiert], [Touch-Ziele mit mindestens 48px, responsives Grid, ausklappbare Filterleiste auf mobilen Bildschirmen.],
  [Zuverlässigkeit], [Fehlerfreie Datenpersistenz], [Strikte TypeScript-Typisierung, Schemavalidierung auf Worker-Endpunkten, relationale D1-Constraints.],
  [Wartbarkeit], [Hohe Testabdeckung & Code-Qualität], [Biome-Linter, automatisierte Unit-Tests, Worker-Integrationstests und Playwright-E2E-Suiten.]
)

= Reflexion & Fazit

#callout(title: "Status: In Bearbeitung", fill-color: rgb("#eff6ff"), stroke-color: secondary-color)[
  Dieser Abschnitt wird gegen Ende des Projekts auf Basis der realen Entwicklungserfahrungen und Erkenntnisse finalisiert und ergänzt.
]

== Was lief gut?
- *Infrastruktur-Wiederverwendung:* Die Weiternutzung von Cloudflare Workers und D1 verhinderte Doppelspurigkeiten und ermöglichte eine unmittelbare Konzentration auf den fachlichen Mehrwert.
- *Filter-Performance:* Das client-seitige Durchsuchen des vorab generierten Katalogs liefert spürbar verzögerungsfreie Interaktionen im Browser.

== Was waren die grössten Herausforderungen?
- *Saubere Projekt-Abgrenzung:* Klare Trennung zwischen den vorbestehenden Funktionen (markiert durch den Git-Tag `pre-weblab`) und den neu entwickelten WEBLAB-Features.
- *Responsives Layout-Konzept:* Harmonische Integration einer dichten Katalogansicht neben dem komplexen Skill-Tree-Graphen unter Wahrung hoher Usability auf Mobilgeräten.

== Was würde ich das nächste Mal anders machen?
- *Frühzeitige API-Mocks:* Noch früheres Bereitstellen lokaler D1-Mocks, um Frontend-Entwicklung und Datenbankmigrationen noch unabhängiger parallelisieren zu können.

#pagebreak()

= Anhang: Arbeitsjournal (Work Journal)

Das folgende Arbeitsjournal dokumentiert sämtliche geleisteten Arbeitsstunden für die Konzeption, Implementierung, Tests und Dokumentation des WEBLAB-Projekts. Der Richtwert für den Gesamtaufwand beträgt rund 60 Stunden.

#v(1em)
#journal-summary()
#v(1.2em)
#journal-table()
