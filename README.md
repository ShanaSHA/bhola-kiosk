# Dr. Ashish Bhola Kiosk — React / Django / PostgreSQL

## Technology

| Layer | Implementation |
| --- | --- |
| Frontend | React 19 + TypeScript, built with Vite |
| Backend | Python 3.12 + Django 5.2 |
| Database | PostgreSQL 17 |
| Local production server | Nginx serving React and proxying Django |

This edition replaces the Next.js frontend with a standalone React application. It implements the approved black-and-maroon visitor kiosk with large image tiles, original logo colours integrated into a curved light header, white tile headings, treatment categories and details, doctor profiles, packages and clinic information. The existing staff content studio is retained. No Next.js packages or runtime are required.

No appointment booking, patient registration or payment features are included.

## Visitor flow

Every fresh visit or reload starts at **Welcome → Language Selection → Home**. Tap Touch to begin, tap the welcome video, or wait for that video to finish to reach language selection. Selecting English or Arabic opens Home. Previous browser language/session values cannot skip these screens.

Home opens treatment categories, the medical team, clinic information, packages and contact. Lists show up to three items per page. Next and Back paginate longer lists and information; Back returns through the navigation history. Home returns to the home menu after entry. The language button opens language selection. Empty sections show a reception contact prompt.

Use browser kiosk/full-screen mode on the touch display. Layout follows both viewport width and orientation. Navigation stays visible; unusually short displays or enlarged text may allow internal scrolling to preserve access to content. The logo image colours are unchanged; CSS blends its white image background into the shaped light logo panel.

Home banners rotate every eight seconds, with pause and previous/next controls. Reduced-motion preferences disable automatic rotation. The original welcome and language video files are included and remain editable in the existing admin interface.

## Start with Docker

1. Install Docker Desktop or Docker Engine with Compose.
2. Copy `.env.example` to `.env` in this folder.
3. Replace both secret placeholders. Generate a Django secret using `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
4. Run:

```bash
docker compose up --build -d
docker compose exec backend python manage.py createsuperuser
```

| Screen | URL |
| --- | --- |
| Visitor kiosk | http://localhost:3000/ |
| Staff sign-in | http://localhost:3000/login |
| Content studio | http://localhost:3000/admin |
| Django account management | http://localhost:8000/django-admin/ |

The backend applies migrations, seeds initial content only once and collects Django admin static assets. PostgreSQL and uploaded images use persistent Docker volumes. `docker compose down` retains data; `docker compose down -v` deletes it.

The React build is served by Nginx, which forwards `/api/` to Django. Its fallback to `index.html` supports directly opening or refreshing `/login` and `/admin`.

## Code layout

- `frontend/src/Visitor.tsx`: redesigned visitor kiosk and ordered entry flow.
- `frontend/src/kiosk.css`: isolated visitor design and portrait/landscape layouts.
- `frontend/src/Portal.tsx`: retained staff content studio (legacy visitor markup is not routed).
- `frontend/src/pages/`: staff login and admin session check.
- `frontend/src/main.tsx`: entry point and page selection.
- `frontend/src/styles.css`: original visual design and responsive styles.
- `frontend/src/lib/api.ts`: same-origin API requests with Django CSRF tokens.
- `frontend/public/media/`: supplied clinic and treatment images.
- `frontend/vite.config.ts`: build and local API proxy.
- `frontend/nginx.conf`: static production hosting and API proxy.
- `backend/clinic/`: models, validation, API endpoints, tests and migrations.
- `backend/seed_content.json`: original demonstration content.
- `backend/config/settings.py`: Django and PostgreSQL configuration.
- `compose.yaml`: PostgreSQL, Django and React/Nginx services.

## Content management

Create a superuser first. Additional users require active status and `is_staff` to access the content studio. Every staff account can edit all clinic content. Use Django's administration screen to manage accounts; the content snapshot there is read-only.

Select a content section, add/edit items, apply dialog changes, then click **Publish changes**. Reload the kiosk to see the new content. Category order uses the `Order` field. Services must reference an existing category. Conflicting saves are rejected; preserve any unsaved text before reloading the latest version.

Django uses session cookies and CSRF checks for writes. Five failed sign-ins per username within 15 minutes trigger a temporary limit. Uploads accept JPG/PNG/WebP up to 5 MB, decode the image and re-encode JPEG. Transparency and animation are not preserved.

PostgreSQL stores the content snapshot in a JSONB column with its version, last editor and timestamp. Content items are validated arrays inside this snapshot, not separate relational tables. Users and sessions use normal Django tables.

## Development without Docker

Use Node.js 22.13+ and Python 3.12. Run PostgreSQL and create the database/user. Export the variables from `.env.example` with real values into your shell and set `POSTGRES_HOST=127.0.0.1`. Django does not automatically load dotenv files.

From `backend/`:

```bash
python -m venv .venv
# Linux/macOS:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_clinic
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

From `frontend/`, in another terminal:

```bash
npm ci
npm run dev
```

Open http://localhost:3000. Vite proxies `/api/` to port 8000. To change that backend address, copy `frontend/.env.example` to `frontend/.env.local` and update `DJANGO_INTERNAL_URL`.

Build with `npm run build`; output is `frontend/dist`. `npm run preview` previews static output only and does not proxy Django. For the complete production stack, use Docker/Nginx.

## API

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/content` | Public; returns data and version |
| PUT | `/api/content` | Staff + CSRF; publishes data with version check |
| GET | `/api/auth/session` | Public; session state and CSRF token |
| POST | `/api/auth/login` | CSRF; username/password |
| POST | `/api/auth/logout` | CSRF |
| POST | `/api/upload` | Staff + CSRF; multipart `file` |
| GET | `/api/media/<uuid>.jpg` | Public clinic images |
| GET | `/api/health` | Database health |

## GitHub upload

Extract this ZIP and upload its contents so `frontend/`, `backend/`, `compose.yaml` and this README are directly at the repository root. Include `.gitignore`, `.env.example`, source code, migrations and `package-lock.json`. Do not upload `.env`, `.env.local`, passwords, `node_modules`, virtual environments or generated build output.

## Vercel frontend settings

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

These settings build **only React**. They do not deploy Django, provision PostgreSQL or replace the `/api/` connection. Vercel does not run this Docker Compose file. Before a complete deployment, host Django with PostgreSQL and persistent image storage, then configure same-origin `/api/:path*` forwarding to that backend plus SPA fallback routing. An example is in `frontend/vercel.example.json`; replace its backend placeholder and save as `frontend/vercel.json` only when the real backend is available.

The example forwards both content and authentication endpoints. Set Django's `CSRF_TRUSTED_ORIGINS` to the exact frontend HTTPS origin and allow the backend hostname. Use secure session/CSRF cookies over HTTPS. Keep secret keys and database credentials server-side, never in a `VITE_` variable. A React-only deployment without the backend displays the content-loading error.

This regeneration does not deploy or alter the existing Vercel project. Supabase can provide PostgreSQL, but no Supabase project or credentials are bundled. Supabase/object-storage configuration and complete hosted deployment remain separate work.

## Production handover

Configure a domain, HTTPS, allowed hosts, trusted CSRF origins, strong credentials, secure cookies and private database access. Trust forwarded HTTPS headers only behind a controlled proxy that removes untrusted forwarded headers. Back up both PostgreSQL and uploaded images. The included filesystem media storage suits persistent Docker volumes; use object storage on ephemeral/serverless hosting. Run migrations as a controlled deployment step when scaling beyond one backend container.

Review sample treatment content and supply approved packages, email and hours before visitor use. Assets are from the original supplied presentation; confirm usage rights. Seed data does not include subsequent live admin edits or patient records.

## Tests

From `frontend/`: `npm run build` (includes TypeScript checking).

Against PostgreSQL: `docker compose exec backend python manage.py test clinic`. The database role needs permission to create the separate test database.

Without PostgreSQL: `python manage.py test clinic --settings=config.test_settings`, with required environment variables set. This isolated configuration uses in-memory SQLite only for tests; application settings always use PostgreSQL.

See `VALIDATION.md` for checks performed. Vite reference: https://vite.dev/guide/.
