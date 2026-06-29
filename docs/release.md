# Release

flowbar publishes to npm and creates a GitHub Release when a version tag is pushed.

## Prerequisites

- `package.json` version must match the release tag without the leading `v`.
- Repository secret `NPM_TOKEN` must contain an npm automation token with publish access.
- The package name and version must not already exist on npm.

## Release Flow

1. Update `package.json` and `package-lock.json`.
2. Run local checks:

```sh
npm run lint
npm test
npm run format --if-present
npm pack --dry-run
```

3. Commit and push to `main`.
4. Create and push a version tag:

```sh
git tag v0.1.2
git push origin v0.1.2
```

5. The `Release` workflow validates Node.js 20.x, 22.x, and 24.x.
6. If validation passes, the workflow publishes to npm using `NPM_TOKEN`.
7. After npm succeeds, GitHub creates the matching Release with generated notes.

## Version Rule

The workflow rejects a release when the tag and package version do not match:

```text
v0.1.1 -> package.json version must be 0.1.1
```
