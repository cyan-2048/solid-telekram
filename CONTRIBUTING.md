## Updating mtcute

This project uses a custom fork of [mtcute](https://github.com/cyan-2048/mtcute/) for KaiOS compatibility.

The fork includes several changes required to support older KaiOS devices and their browser environments:

1. **IndexedDB driver compatibility fixes**
   - Adjusted the IDB driver to work with older Firefox versions used by some KaiOS releases.

2. **BigInt compatibility**
   - Replaced native `BigInt` usage with `jsbn` to support KaiOS versions that do not provide native BigInt support.

3. **WASM fallback**
   - Replaced WebAssembly usage with an asm.js implementation to support older KaiOS versions that lack proper WASM support.

### Using `bun mtcute`

The `bun mtcute` script synchronizes the local `@mtcute/*` sources with the upstream-compatible fork.

The command must be run from the project root, where `package.json` is located:

```bash
bun mtcute
```

The script expects the forked `mtcute` repository to be cloned alongside this project:

```text
parent-directory/
├── mtcute/            # cyan-2048/mtcute fork
└── solid-telekram/    # this repository
```

The script will:

1. Update selected `@mtcute/*` dependencies to their latest npm versions.
2. Pull the latest changes from the local `../mtcute` fork.
3. Install dependencies in the fork.
4. Regenerate TL files.
5. Copy the required `core` and `web` sources into this project while preserving the local structure.

> **Note:** This workflow is intended for maintainers. A local clone of the forked `mtcute` repository is required, and the command should be executed from this repository's root directory.
