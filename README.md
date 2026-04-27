# Daftar

Daftar is an internal operations platform for IT Support teams in MSP workflows.  
It combines ticket tracking, reminders, calendar planning, KB documentation, boilerplates, and team account management in one dashboard.

## Highlights

- Email-only login with JWT in HttpOnly cookies
- Role model: **Manager** (`ADMIN`) and **Agent** (`AGENT`)
- Client-based ticket workspace with notes and worked-time tracking
- Dedicated Timer flow (`Start / Pause / Resume / Stop + Save`)
- Reminders + weekly hourly Calendar + monthly event view
- KB Docs (TipTap editor, reader mode, PDF print/download, snapshots)
- Boilerplate canned messages grouped by client
- Tools menu for ticket **CSV/PDF export** and **CSV import**

## Current Module Status

- Completed:
  - Auth + Profile
  - Dashboard
  - Clients
  - Tickets
  - Timer
  - Agents
  - Reminders
  - Calendar
  - Boilerplate
  - KB Docs
  - Tools (Import/Export)
- In progress:
  - Schedule page UX (route exists, currently placeholder)

## Tech Stack

- Backend: Python 3.12+, Django 5.1, DRF, SimpleJWT, Celery, Redis, Channels
- Frontend: React 19 + Vite + TypeScript + Tailwind + TanStack Query + Zustand + TipTap
- Infra: Docker Compose, PostgreSQL 15, Redis 7

## Requirements

- Python 3.12+
- Node.js 20+ and npm 10+
- Git
- Docker Desktop (recommended for full stack)

## Installation

### Option A: Docker (Windows/Linux) - Recommended

```bash
git clone <your-repo-url>
cd Daftar
cp .env.example .env
docker compose up --build
```

Services:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/api/docs/`

### Option B: Local Dev (Windows/Linux)

1) Clone + env

```bash
git clone <your-repo-url>
cd Daftar
cp .env.example .env
```

2) Backend

Windows (PowerShell):

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements\development.txt
python manage.py migrate
python manage.py runserver
```

Linux:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
python manage.py migrate
python manage.py runserver
```

3) Frontend

Windows/Linux:

```bash
cd frontend
npm install
npm run dev
```

## First Manager Account Setup

Manager actions (create/delete users, reset others' passwords) require `role=ADMIN`.

1. Create a superuser:

```bash
cd backend
python manage.py createsuperuser
```

2. Open Django admin (`/admin`) and ensure this user has:

- `role = ADMIN`
- `display_name` set (used across Tickets and UI)

Then log in from the app login page with email + password.

## API Notes

- Base URL: `/api/v1/`
- Auth:
  - `POST /api/v1/auth/login/`
  - `POST /api/v1/auth/refresh/`
  - `POST /api/v1/auth/logout/`
  - `GET/PATCH /api/v1/auth/me/`
- Tools:
  - `GET /api/v1/tickets/tools/export/`
  - `POST /api/v1/tickets/tools/import/`

## CSV Import Headers (Tools -> Import)

Required (case-insensitive):

- `date`
- `ticket` (format: `TICKET_NUMBER - Subject`)
- `agent`
- `level` (`L1`, `L2`, `L3`)
- `status`
- `worked` (HH:MM or hour value)

Optional:

- `detail`

## Useful URLs

- Frontend: `http://127.0.0.1:5173`
- Health: `http://127.0.0.1:8000/health/`
- Swagger: `http://127.0.0.1:8000/api/docs/`
- OpenAPI Schema: `http://127.0.0.1:8000/api/schema/`

## Roadmap

- Schedule module completion (weekly/monthly staffing UX)
- Reminder push channels (web push / external channels)
- Notification center enhancements
- Analytics dashboards (SLA, workload trends)
- More Tools modules beyond import/export

---

Built for real operational support workflows with a clean, high-density UI and role-aware controls.
