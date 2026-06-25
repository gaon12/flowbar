# Release

flowbar publishes to npm from GitHub Releases.

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
4. Create a GitHub Release tag such as `v0.1.1`.
5. The `Release` workflow validates Node.js 20.x, 22.x, and 24.x.
6. If validation passes, the workflow runs `npm publish --access public --provenance`.

## Version Rule

The workflow rejects a release when the tag and package version do not match:

```text
v0.1.1 -> package.json version must be 0.1.1
```
