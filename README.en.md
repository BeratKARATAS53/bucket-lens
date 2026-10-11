# bucket-lens

[Türkçe](README.md) · **English**

A desktop app for the files in a Backblaze B2, Wasabi, or Amazon S3 bucket. It opens folders, lists files, searches by name, filters by type, and downloads them. A file’s details open in a window. The interface runs in Turkish and English, with a light and a dark appearance.

Your key is not stored on this page. It stays in the app on your computer.

## Interface

Welcome. The bucket opens from here when there is no key yet.

![Welcome screen](docs/en/welcome.png)

With a bucket open, folders, search, the subfolder scan, and the type filters stay on the same screen.

![File list](docs/en/list.png)

Clicking a file shows its size, date, storage class, and content type in a window. The path is copied together with the endpoint. Download starts from this window.

![File details](docs/en/detail.png)

Keys live in the panel that opens from the right. A new key starts by choosing a provider; the region and endpoint fill in from that choice. Leave the secret field empty when a stored secret should stay as it is.

![Connection settings](docs/en/connection.png)

## Download

Installers are on [GitHub Releases](https://github.com/BeratKARATAS53/BucketLens/releases).

- Windows: a one-click exe
- Debian and Ubuntu: a deb package
- Other Linux: an AppImage, with no install step

On Linux, GNOME Keyring or KWallet must be unlocked in the session so the key is still there after a restart. Before a key is saved, it needs permission to list and read objects.
