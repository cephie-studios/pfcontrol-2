# Contributing to PFControl

Contributions are welcome!

## How to Contribute

- **Fork the repo** and open a pull request (to the `preview` branch so it can be tested on [canary.pfconnect.online](https://canary.pfconnect.online)).
- **Follow the existing code style** and conventions.
- **Run checks before submitting:**
  - `npm run lint` to check for lint errors.
  - `npm run format` to auto-format your code.
  - `npm run type-check` to ensure type safety.
- **For larger changes**, open an issue first to discuss your proposal.
- **Keep pull requests focused**: One feature or fix per PR is preferred.

## Commit Messages

- Use clear, descriptive commit messages.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) if possible (e.g., `fix: correct typo in login page`).

## Code Style

- Use Prettier for formatting (`npm run format`).
- Use ESLint for linting (`npm run lint`).
- Prefer TypeScript for all new code.
- Keep functions and files small and focused.

## Testing

- Add or update tests for new features or bug fixes.
- Ensure all tests pass before submitting a PR.
- If possible, add unit tests for backend and frontend changes.

## Environment Variables

- If you're adding features that require environment variables, update `.env.example` and document them in this README.
- Never commit secrets or real credentials.

## Documentation

- Update documentation and comments as needed.
- If you add a new feature, update the relevant docs or README sections.

## Pull Request Checklist

Before submitting a PR, please ensure:

- [ ] Code compiles and builds (`npm run build`).
- [ ] Lint and format checks pass.
- [ ] Type checks pass.
- [ ] PR description explains the change and references any related issues.

## Reporting Issues

- Search existing issues before opening a new one.
- Provide clear steps to reproduce, expected vs. actual behavior, and screenshots/logs if possible.

## Code of Conduct

- Be respectful and inclusive.
- No harassment, discrimination, or inappropriate behavior.

Thank you for helping to make PFControl better!
