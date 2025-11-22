# PFControl v2

PFControl is an open-source, real-time flight strip platform for air traffic controllers and pilots. It focuses on fast, collaborative session management with enterprise-level reliability. This repository contains both the frontend and backend for PFControl v2.

We welcome contributions, bug reports, and feature requests. See the Contributing section below to get started.

## Quick start (for users)

If you just want to try or demo PFControl:

- Visit https://control.pfconnect.online
- Try PFControl by creating a session from the homepage.

## Development — Local setup

The following steps get the project running on your machine for development and testing.

1. Install dependencies

   ```
   npm install --legacy-peer-deps
   ```

2. Create an environment file
   Copy the example and update environment variables into `.env.development`

   Fill in required secrets (API keys, DB URLs). Ask project maintainers if you need values.

3. Start the development environment
   ```
   npm run dev
   ```

Frontend will be available at http://localhost:5173 and Backend API at http://localhost:9901 by default.

## Project structure

- `src/` — frontend application (React + Vite)
- `server/` — backend (Express + TypeScript)
- `public/` — static assets

## License

PFControl v2 is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
You may use, modify, and redistribute this project, but any distributed or networked version must also be released under the same license.
See the [LICENSE](./LICENSE) file for full details.

## Support & Contact

- Open issues on GitHub for bugs or feature requests.
- Join our Discord server for discussions and support. [Invite Link](https://pfconnect.online/discord)
