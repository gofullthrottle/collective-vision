# Contributing to Collective Vision

Thank you for your interest in contributing to Collective Vision!

## Development Setup

### Prerequisites

- Node.js 18+ or Bun
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account
- Pre-commit: `pip install pre-commit`

### Getting Started

```bash
# Clone the repository
git clone https://github.com/gofullthrottle/collective-vision.git
cd collective-vision

# Install pre-commit hooks
pre-commit install

# Create D1 database
wrangler d1 create collective-vision-feedback

# Update wrangler.toml with the database_id from above

# Apply schema
wrangler d1 execute collective-vision-feedback --file=schema.sql

# Start development server
wrangler dev
```

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

### Manual Testing

```bash
# Start dev server
wrangler dev

# Embed widget in test HTML
cat > test.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
  <h1>Feedback Test</h1>
  <script
    src="http://localhost:8787/widget.js"
    data-workspace="test"
    data-board="main"
  ></script>
</body>
</html>
EOF

# Open test.html in browser
open test.html
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
