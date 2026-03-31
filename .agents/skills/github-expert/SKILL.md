---
name: github-expert
description: Expert in GitHub CLI for repository operations, issues, pull requests, Actions, releases, and custom API calls.
---

## Core Expertise
- Authentication: gh auth, credential management
- Repositories: clone, create, fork, view, edit
- Issues: create, list, view, edit, close, search, labels
- Pull Requests: create, checkout, review, merge, diff, checks
- GitHub Actions: workflow runs, jobs, logs
- Releases: create, list, view, edit, delete
- Secrets & Variables: repository, organization, environment
- Custom API: gh api (REST and GraphQL)

## Use Context7 for Documentation
```bash
# Resolve and fetch GitHub CLI docs
context7_resolve-library-id({ libraryName: "GitHub CLI" })
context7_query-docs({
  context7CompatibleLibraryID: "/websites/cli_github",
  query: "gh issue create pr checkout run view"
})
```

## Essential Patterns

### Authentication
```bash
gh auth login                    # Interactive browser auth
gh auth status                  # Check auth status
gh auth login --git-protocol ssh # SSH instead of HTTPS
```

### Repository Operations
```bash
gh repo clone owner/repo         # Clone repository
gh repo create my-project       # Interactive creation
gh repo view                    # View repository in terminal
gh repo view --web             # Open in browser
```

### Issue Management
```bash
gh issue list                   # List open issues
gh issue list --state all       # All issues
gh issue view 123              # View issue
gh issue create --title "Bug" --body "Description" --label bug --assignee @me
gh issue close 123              # Close issue
gh issue reopen 123            # Reopen issue
gh issue edit 123 --add-label enhancement --assignee username
```

### Pull Requests
```bash
gh pr list                     # List open PRs
gh pr create                   # Interactive creation
gh pr create --title "Fix" --body "Description" --base main --head feature
gh pr checkout 123             # Checkout PR locally
gh pr view 123                # View PR
gh pr review --approve -b "LGTM"
gh pr merge 123               # Merge (default: squash)
gh pr checks 123               # View check status
gh pr diff 123                # View diff
```

### GitHub Actions
```bash
gh run list                    # List workflow runs
gh run view 12345              # View specific run
gh run view 12345 --log       # View logs
gh run watch 12345             # Stream logs live
gh run rerun 12345            # Rerun workflow
gh workflow list               # List workflows
gh workflow run ci.yml         # Run manually
```

### Releases
```bash
gh release create v1.0.0       # Create release
gh release list                # List releases
gh release view v1.0.0         # View release
gh release edit v1.0.0 --title "New Title"
gh release delete v1.0.0
```

### Secrets & Variables
```bash
gh secret set MYSECRET          # Set repository secret
gh secret set MYSECRET --org my-org --visibility all
gh variable set MYVAR --body "value"
gh secret list --env production
```

### Custom API Calls
```bash
gh api repos/{owner}/{repo}/issues
gh api repos/{owner}/{repo}/issues -f title="Issue" -f body="Description"
gh api graphql -F query='query { viewer { login } }'
gh api --paginate repos/{owner}/{repo}/issues
```

### Fix Issue End-to-End
```bash
gh issue view 123              # View issue
git checkout -b fix/issue-123-description
# Make changes, commit
git push origin fix/issue-123-description
gh pr create --title "Fix: description" --body "Closes #123"
```

## Best Practices
- Use `gh auth status` to verify authentication
- Link PRs to issues with `Closes #123` or `Fixes #456`
- Use consistent branch naming: `fix/issue-N`, `feat/description`
- Request specific reviewers based on code changes
- Use labels for categorization
- Use pagination with `--paginate` for large result sets
- Cache responses with `--cache` for stable data
- Respect rate limits
