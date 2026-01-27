# PFControl v2

PFControl is an open-source, real-time flight strip platform for air traffic controllers and pilots. It focuses on fast, collaborative session management with enterprise-level reliability. This repository contains both the frontend and backend for PFControl v2.

We welcome contributions, bug reports, and feature requests. See the Contributing section below to get started.

## Quick start (for users)

If you just want to try or demo PFControl:

- Visit [control.pfconnect.online](https://control.pfconnect.online)
- Try PFControl by creating a session from the homepage.

## Development — Local setup

Getting started with PFControl development is straightforward. We've set up Docker Compose to handle PostgreSQL and Redis for you, so you don't need to manually configure databases.

### Setup instructions

1. **Install Docker Desktop** (if you don't have it)
   Download from [docker.com](https://www.docker.com/products/docker-desktop) and open it. Make sure it fully starts up.

2. **Clone the repository**
   ```bash
   git clone https://github.com/PFConnect/pfcontrol-2.git
   cd pfcontrol-2
   ```

3. **Start PostgreSQL and Redis**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```
   This starts local PostgreSQL and Redis containers in the background. First-time setup downloads the images and takes about 30 seconds.

4. **Set up your environment file**
   ```bash
   cp .env.example .env.development
   ```
   This creates a `.env.development` file with localhost connection strings that point to the Docker containers.

5. **Install dependencies and start the dev server**
   ```bash
   npm install
   npm run dev
   ```

That's it! The frontend will be at [http://localhost:5173](http://localhost:5173) and the backend API at [http://localhost:9901](http://localhost:9901).

**When you're done**, stop the databases with:
```bash
docker-compose -f docker-compose.dev.yml down
```

To reset your local database (fresh start), run:
```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
```

### Troubleshooting

- **"Cannot connect to the Docker daemon"**: Make sure Docker Desktop is running. Open the Docker Desktop application before running docker-compose commands
- **"Cannot connect to PostgreSQL"**: Make sure Docker Compose is running (`docker ps` should show postgres and redis containers)
- **"Port 5432 already in use"**: You might have PostgreSQL installed locally. Either stop your local PostgreSQL or change the port mapping in `docker-compose.dev.yml`
- **Need help?** Join our [Discord server](https://pfconnect.online/discord), create a ticket, and we'll help you out

## Project structure

- `src/` — frontend application (React + Vite + Tailwind CSS)
- `server/` — backend (Express + TypeScript + Kysely)
- `public/` — static assets

## Code of Conduct

We are committed to a welcoming, inclusive, and harassment-free community for everyone. All participants are expected to be respectful, considerate, and constructive. Unacceptable behavior such as harassment, discrimination, or personal attacks will not be tolerated. Community leaders enforce these standards and may take corrective action when necessary. Reports of misconduct can be sent to [support@pfconnect.online](mailto:support@pfconnect.online). See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for full details.

## License

PFControl v2 is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
You may use, modify, and redistribute this project, but any distributed or networked version must also be released under the same license.
See the [LICENSE](./LICENSE) file for full details.

## Support & Contact

- Open issues on GitHub for bugs or feature requests.
- Join our Discord server for discussions and support. [Invite Link](https://pfconnect.online/discord)
