// WEBLAB Dokumentations-Template fuer Typst 0.15+ (Schweizer Rechtschreibung: nur ss)

#let primary-color = rgb("#1e3a5f")
#let secondary-color = rgb("#2b6cb0")
#let accent-color = rgb("#dbeafe")
#let text-color = rgb("#1a202c")
#let muted-color = rgb("#718096")
#let border-color = rgb("#e2e8f0")

#let adr(id: "", title: "", status: "Akzeptiert", ctx: [], decision: [], consequences: []) = {
  v(0.6em)
  block(
    width: 100%,
    stroke: 1pt + border-color,
    radius: 4pt,
    inset: 12pt,
    fill: rgb("#f8fafc"),
    [
      #grid(
        columns: (1fr, auto),
        align: (left + horizon, right + horizon),
        [
          #text(weight: "bold", size: 1.1em, fill: primary-color)[#id: #title]
        ],
        [
          #box(
            fill: if status == "Akzeptiert" or status == "Accepted" { rgb("#dcfce7") } else { rgb("#fef3c7") },
            radius: 3pt,
            inset: (x: 6pt, y: 3pt),
            text(
              weight: "bold",
              size: 0.85em,
              fill: if status == "Akzeptiert" or status == "Accepted" { rgb("#166534") } else { rgb("#92400e") },
              status
            )
          )
        ]
      )
      #line(length: 100%, stroke: 0.5pt + border-color)
      #v(0.3em)
      #grid(
        columns: (8em, 1fr),
        row-gutter: 0.8em,
        [*Kontext:*], ctx,
        [*Entscheidung:*], decision,
        [*Konsequenzen:*], consequences,
      )
    ]
  )
  v(0.6em)
}

#let callout(title: "Hinweis", body, fill-color: rgb("#f0fdf4"), stroke-color: rgb("#86efac")) = {
  v(0.4em)
  block(
    width: 100%,
    stroke: (left: 3pt + stroke-color, rest: 0.5pt + border-color),
    radius: (right: 4pt),
    inset: (x: 12pt, y: 10pt),
    fill: fill-color,
    [
      #if title != "" [
        #text(weight: "bold", size: 0.95em, fill: primary-color)[#title]
        #v(0.2em)
      ]
      #body
    ]
  )
  v(0.4em)
}

#let weblab-doc(
  title: "HSLU Courses Skill Tree - Course Browser",
  subtitle: "WEBLAB Architektur-Dokumentation (arc42) & Modulbericht",
  author: "jackra1n",
  course: "WEBLAB - Web Programming Lab",
  institution: "Hochschule Luzern - Departement Informatik",
  semester: "Herbstsemester 2026",
  date: datetime.today().display("[day].[month].[year]"),
  abstract: none,
  doc
) = {
  set document(title: title, author: author)

  set page(
    paper: "a4",
    margin: (top: 3cm, bottom: 2.5cm, left: 2.8cm, right: 2.8cm),
    header: context {
      let page-num = counter(page).get().first()
      if page-num > 1 [
        #grid(
          columns: (1fr, auto),
          align: (left, right),
          text(size: 8.5pt, fill: muted-color)[#title],
          text(size: 8.5pt, fill: muted-color)[#course]
        )
        #line(length: 100%, stroke: 0.5pt + border-color)
      ]
    },
    footer: context {
      let page-num = counter(page).get().first()
      if page-num > 1 [
        #line(length: 100%, stroke: 0.5pt + border-color)
        #grid(
          columns: (1fr, auto),
          align: (left, right),
          text(size: 8.5pt, fill: muted-color)[#author - #institution],
          text(size: 8.5pt, fill: muted-color)[Seite #counter(page).display("1")]
        )
      ]
    }
  )

  set text(
    font: ("Liberation Sans", "Noto Sans", "Cantarell"),
    size: 10.5pt,
    fill: text-color,
    lang: "de",
    spacing: 120%
  )

  set par(
    justify: true,
    leading: 0.75em,
  )

  show heading: it => [
    #v(0.8em)
    #text(fill: primary-color)[#it]
    #v(0.4em)
  ]

  show heading.where(level: 1): it => [
    #v(1.2em)
    #text(size: 1.5em, weight: "bold", fill: primary-color)[#it.body]
    #v(0.6em)
    #line(length: 100%, stroke: 1.5pt + secondary-color)
    #v(0.6em)
  ]

  show heading.where(level: 2): it => [
    #v(1.0em)
    #text(size: 1.25em, weight: "bold", fill: primary-color)[#it.body]
    #v(0.4em)
  ]

  show heading.where(level: 3): it => [
    #v(0.8em)
    #text(size: 1.08em, weight: "bold", fill: secondary-color)[#it.body]
    #v(0.3em)
  ]

  show link: set text(fill: secondary-color)

  // Titelseite
  align(center + horizon)[
    #text(size: 1.1em, fill: muted-color, weight: "medium")[#institution]
    #v(0.5em)
    #text(size: 1.2em, fill: secondary-color, weight: "bold")[#course]
    #v(1.5em)
    #text(size: 2.2em, weight: "bold", fill: primary-color)[#title]
    #v(0.8em)
    #text(size: 1.25em, fill: muted-color)[#subtitle]
    #v(2.5em)
    #rect(width: 4cm, height: 2pt, fill: secondary-color)
    #v(2.5em)
    #grid(
      columns: (auto, auto),
      gutter: 1.2em,
      align: (right, left),
      [*Autor:*], [#author],
      [*Semester:*], [#semester],
      [*Datum:*], [#date],
    )
  ]

  pagebreak()

  // Inhaltsverzeichnis
  outline(indent: auto, depth: 3)

  pagebreak()

  doc
}
