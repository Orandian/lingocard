# Git workflow

**Never push directly to `main`.** Always:
1. Create a feature branch: `git checkout -b fix/<short-slug>` or `feat/<short-slug>`
2. Commit changes on the branch
3. Open a PR with `gh pr create --fill`
4. Wait for review before merging

This allows `/code-review` to run on every change.
