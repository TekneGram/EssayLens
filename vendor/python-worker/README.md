Place PyInstaller worker bundles here for packaging.

Expected layout:

- `vendor/python-worker/darwin-arm64/essaylens-llm-worker`
- `vendor/python-worker/darwin-arm64/_internal/...`
- `vendor/python-worker/darwin-x64/...`
- `vendor/python-worker/win32-x64/essaylens-llm-worker.exe`
- `vendor/python-worker/linux-x64/essaylens-llm-worker`

`electron-builder` copies `vendor/python-worker/**` to app resources at
`python-worker/**`, and the main process launches:

`Resources/python-worker/<platform>-<arch>/essaylens-llm-worker[.exe]`
