# Daftar 🛠️

**Daftar** is an internal operations platform for IT support teams (MSP-style workflow).  
It combines ticketing, client tracking, documentation, reminders, and team operations in one place.

## ✨ Highlights

- 🔐 JWT + HttpOnly cookie authentication
- 🎫 Client-centered ticket workflow with notes and time entries
- 📚 Premium documentation workspace (client libraries + rich editor)
- 📊 Dashboard and operational structure ready for scaling
- 🐳 Docker-first development setup (PostgreSQL + Redis + Django + React + Celery)

## 🧱 Tech Stack

- **Backend:** Django 5, DRF, SimpleJWT, Allauth, Celery, Channels, PostgreSQL/SQLite
- **Frontend:** React + Vite + TypeScript + Tailwind + TipTap + React Query + Zustand
- **Infra:** Docker Compose, Redis, PostgreSQL

## ✅ Current Features

- Auth: Login / refresh / logout / current user profile
- Clients: list, create, update, delete-with-password confirmation
- Tickets: create, update, delete, notes, manual time entries, timer endpoints
- Docs:
  - client-based documentation library
  - search/sort and view modes
  - rich text editing (headings, lists, task lists, tables, links, images, formatting)
  - autosave + manual save + version snapshot endpoint
  - markdown export/copy + print
- API Docs: OpenAPI schema and Swagger UI

## 🚧 Module Status

- ✅ Auth + Client + Ticket core
- ✅ Documentation module (rich editor)
- 🟡 Dashboard (basic structure, needs richer data widgets)
- 🟡 Schedule / Agents / Reminders / Settings (base backend exists, frontend pages still in progress)

## 🗺️ Roadmap (Planned)

- Real-time notifications and activity streams
- Global command palette and faster keyboard workflows
- Full reminders UI + snooze UX + in-app notification center
- Shift scheduler UI (weekly/monthly operations view)
- Expanded analytics (SLA, workload, trend reports)
- Hardened role-based admin UX and team management

## 📋 Requirements

- **Python:** 3.12+ (recommended)
- **Node.js:** 20+ (recommended)
- **npm:** 10+
- **Docker Desktop** (if using Docker setup)
- **Git**

For full production-like local stack:
- PostgreSQL 15
- Redis 7

## 🚀 Installation

### Option A: Docker (Recommended)

Works on both Windows and Linux.

```bash
git clone <your-repo-url>
cd Daftar
cp .env.example .env
docker compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Swagger: `http://localhost:8000/api/docs/`

### Option B: Local Development (Windows / Linux)

#### 1) Clone and configure env

```bash
git clone <your-repo-url>
cd Daftar
cp .env.example .env
```

#### 2) Backend setup

##### Windows (PowerShell)

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements\development.txt
python manage.py migrate
python manage.py runserver
```

##### Linux

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements/development.txt
python manage.py migrate
python manage.py runserver
```

#### 3) Frontend setup

##### Windows (PowerShell)

```powershell
cd frontend
npm install
npm run dev
```

##### Linux

```bash
cd frontend
npm install
npm run dev
```

## ⚙️ Environment Notes

- `USE_SQLITE=1` in `.env` gives a quick local setup.
- Set `USE_SQLITE=0` to use PostgreSQL.
- Update `CORS_ALLOWED_ORIGINS` for your frontend host/port.

## 🔎 Useful URLs

- Frontend: `http://127.0.0.1:5173`
- Health check: `http://127.0.0.1:8000/health/`
- Swagger: `http://127.0.0.1:8000/api/docs/`
- OpenAPI schema: `http://127.0.0.1:8000/api/schema/`

## 🧪 Helpful Commands

```bash
# Frontend
npm run build
npm run lint

# Backend
python manage.py check
python manage.py makemigrations
python manage.py migrate
```

## 🤝 Contributing

PRs and issue reports are welcome.  
If you plan a major feature, open an issue first so we can align on scope and architecture.

## 📄 License

Add your preferred license here (MIT, Apache-2.0, Proprietary, etc.).

