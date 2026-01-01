# Contributing to Collective Vision

Thank you for your interest in contributing to Collective Vision!

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account
- Pre-commit: `pip install pre-commit`

### Quick Start (< 15 minutes)

```bash
# 1. Clone the repository
git clone https://github.com/gofullthrottle/collective-vision.git
cd collective-vision

# 2. Install dependencies
npm install

# 3. Install pre-commit hooks
pre-commit install

# 4. Copy environment example
cp .env.example .env

# 5. Create D1 database (first time only)
wrangler d1 create collective-vision-feedback-dev
# Copy the database_id to wrangler.toml line 13

# 6. Set up local database
npm run db:migrate:local

# 7. Seed with test data (optional)
npm run db:seed

# 8. Start development server
npm run dev
```

The widget is now available at `http://localhost:8787/widget.js`

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start local development server |
| `npm run test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run db:migrate` | Apply schema to remote D1 |
| `npm run db:migrate:local` | Apply schema to local D1 |
| `npm run db:seed` | Seed local database with test data |

## Development Workflow

### Making Changes

1. Create a feature branch from `master`
2. Make your changes
3. Run pre-commit checks: `pre-commit run --all-files`
4. Test your changes locally with `wrangler dev`
5. Commit with conventional commit format (see below)
6. Push your branch
7. Create a pull request

### Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test additions or updates
- `style:` - Code style changes (formatting)

**Examples:**

```
feat(api): add endpoint for listing comments

Add GET /api/v1/:workspace/:board/feedback/:id/comments endpoint
to retrieve all comments for a feedback item.
```

```
fix(widget): correct vote count display after voting
```

## Code Style

- **TypeScript**: Use strict mode, proper types
- **Formatting**: Enforced by pre-commit hooks
- **SQL**: Use parameterized queries (never string concatenation)
- **CORS**: All API endpoints must support CORS for widget embedding

## Testing

### Automated Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Manual Widget Testing

```bash
# Start dev server
npm run dev

# Open the test page in browser
open tests/widget-test.html
```

Or embed in any HTML page:

```html
<script
  src="http://localhost:8787/widget.js"
  data-workspace="test-workspace"
  data-board="main"
></script>
```

### Pre-Commit Checks

Pre-commit hooks run automatically on `git commit`. To run manually:

```bash
# Run all hooks
pre-commit run --all-files

# Run specific hook
pre-commit run trailing-whitespace --all-files
```

## Pull Request Process

1. Update documentation if you're adding features
2. Ensure all pre-commit hooks pass
3. Test your changes with `wrangler dev`
4. Request review from maintainers
5. Address review feedback
6. Once approved, maintainers will merge

## Database Migrations

When modifying `schema.sql`:

1. Test locally: `wrangler d1 execute collective-vision-feedback --file=schema.sql --local`
2. Document changes in commit message
3. Consider backward compatibility
4. Update CLAUDE.md if data model changes significantly

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Assume good faith
- Follow GitHub's Community Guidelines

## Questions?

- Check [CLAUDE.md](CLAUDE.md) for architecture details
- Review [GAMEPLAN.md](GAMEPLAN.md) for roadmap
- Open an issue for questions or suggestions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see LICENSE file).
