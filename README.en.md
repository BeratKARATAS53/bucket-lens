# bucket-lens

[Türkçe](README.md) · **English**

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![pnpm](https://img.shields.io/badge/pnpm-8.13-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

A single-page interface for browsing Backblaze B2, Wasabi, and Amazon S3 buckets. It walks folders, lists files, searches by name, filters by type, and downloads. A file’s details open in a window. The interface runs in Turkish and English, with a light and a dark appearance.

Signing does not happen in the browser. The key ID and secret entered in settings are written to `data/connection.json`. That file stays on this machine, is kept out of the repository, and the secret is not sent back to the browser. Requests go through the local API.

## Interface

Welcome. The bucket opens from here when there is no key yet.

![Welcome screen](docs/en/welcome.png)

With a bucket open, folders, search, the subfolder scan, and the type filters stay on the same screen.

![File list](docs/en/list.png)

Clicking a file shows its size, date, storage class, and content type in a window. The path is copied together with the endpoint. Download starts from this window.

![File details](docs/en/detail.png)

Keys live in the panel that opens from the right. A new key starts by choosing a provider; the region and endpoint fill in from that choice. On Backblaze, the region can be suggested from the first three digits of the key ID. Leave the secret field empty when a stored secret should stay as it is.

![Connection settings](docs/en/connection.png)

## Setup

[Node.js](https://nodejs.org) and [pnpm](https://pnpm.io) are required.

```bash
pnpm install
pnpm start
```

The interface opens at `http://localhost:4205`. `pnpm start` starts the local API along with the interface. The API listens only on `127.0.0.1`. The key file is created on the first successful save.

Before a key is saved, it needs permission to list and read objects. The app lists the bucket once before writing the file. The endpoint is filled from the selected region: `s3.<region>.backblazeb2.com` for Backblaze, `s3.<region>.wasabisys.com` for Wasabi, and `s3.<region>.amazonaws.com` for Amazon S3.

| Command      | What it does                         |
| ------------ | ------------------------------------ |
| `pnpm start` | Opens the interface and the local API |
| `pnpm build` | Builds the interface                 |
| `pnpm lint`  | Runs ESLint                          |
