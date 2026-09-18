# HSLU Courses Skill Tree

Have you ever wanted to register for courses but found it annoying how time consuming it is to check all the requirements for them? With HSLU Skill Tree it takes only a second!

<div align="center">
  <a href="https://hsluskilltree.com/">
    DEMO
  </a>
</div>

![Preview](docs/imgs/preview.png)

An interactive skill tree visualization tool for university courses. Track your progress through course prerequisites and see which courses become available as you complete the requirements.

> [!WARNING]
> This project is not affiliated with, endorsed by, or supported by HSLU. It's a private initiative run by students.

## Features

- **Visual Course Graph**: See all courses and their prerequisites in an interactive flow diagram
- **Progress Tracking**: Mark courses as completed, which automatically shows dependent courses as available
- **Smart Status Indicators**: 
  - **Completed** (green): Courses you've finished
  - **Available** (blue): Courses you can take now (prerequisites met)
  - **Locked** (gray): Courses still requiring prerequisites
- **Course Details**: Click any course to view details in the sidebar (ECTS credits, prerequisites)
- **Animated Transitions**: Visual feedback when courses become available
- **Local Storage**: Your progress is automatically saved in your browser
- **Cloud Sync**: Sign in with GitHub to sync your progress across devices, with conflict resolution when edits overlap
- **Dark/Light Theme**: Switch between themes to match your preference
- **Curriculum Templates**: Pre-configured study plans for different programs

## Roadmap

- [ ] **More Templates**: Add curriculum templates for other HSLU programs (Wirtschaftsinformatik, Digital Ideation, etc.)
- [x] **Expanded Course Database**: Include more courses and detailed prerequisite information
- [x] **Custom Study Plans**: Allow users to create and save their own personalized curriculum plans
- [ ] **Course Links**: Direct links to HSLU course pages and registration systems
- [x] **Progress Analytics**: Visualize your academic progress and credit accumulation
- [x] **Cloud Sync**: Sign in with GitHub to back up and sync your progress across devices
- [x] **Internationalization (i18n)**: English and German interface with a language switcher and bilingual course names

## Tech Stack

- **Bun**
- **SvelteKit**
- **Svelte 5 and TypeScript**
- **UnoCSS** (Tailwindcss4, icons, webfonts)
- **Iconify icons** (lucide)
- **Paraglide JS** (type-safe i18n, compile-time messages)

## Development

Install dependencies:

```sh
bun install
```

Start the development server:

```sh
bun run dev --open
```

### Tests

From `frontend/`, run `bun run web:test` for all frontend tests in `test/`, including catalog, filtering, and course-readiness behavior. Run `bun run worker:test` for Worker/D1 integration tests. CI runs both suites.

### Course review storage

Migration `0004_course_reviews.sql` adds one review per user/course to D1. All four dimensions are required integers from 1 to 5: `recommendation` and `content_interest` are star ratings; `difficulty` ranges from very easy to very hard, and `workload` from very low to very high. Keep averages separate: high difficulty or workload does not imply poor quality.

Written `text` is optional and stored as an empty string for rating-only reviews. Timestamps use Unix milliseconds. Reviews reference existing users and are deleted with their account; course IDs come from the static catalog. The review API and UI are not implemented yet, including catalog validation and owner-only write authorization.

### Translations

UI strings live in `frontend/messages/{en,de}.json` ([Paraglide JS](https://paraglidejs.com) message format). The compiled output in `frontend/src/lib/paraglide/` is gitignored and generated when needed: automatically by `bun run dev` / `bun run build`, and explicitly via `bun run i18n:compile` before `bun run check` / `bun run web:test`. Course names come from the generated catalog, which stores both the German and English module names.

Run `bun run i18n:check` from `frontend/` to verify that all configured catalogs have matching keys and placeholders and that source code only references existing message keys. CI runs this check automatically.
