#!/bin/bash
set -eu
APP=bucket-lens
PIXMAP="/usr/share/pixmaps/$APP.png"
mkdir -p /usr/share/pixmaps

SRC=""
for size in 512 256 128 64 48 32; do
	candidate="/usr/share/icons/hicolor/$size"x"$size/apps/$APP.png"
	if [ -f "$candidate" ]; then
		SRC="$candidate"
		break
	fi
done

if [ -z "$SRC" ]; then
	for dir in "/opt/$APP" "/opt/Bucket Lens" /opt/BucketLens; do
		if [ -f "$dir/icon.png" ]; then
			SRC="$dir/icon.png"
			break
		fi
	done
fi

if [ -n "$SRC" ]; then
	cp "$SRC" "$PIXMAP"
	chmod 644 "$PIXMAP"
fi

shopt -s nullglob
for desktop in /usr/share/applications/$APP.desktop /usr/share/applications/*ucket*.desktop; do
	if [ -f "$desktop" ] && [ -f "$PIXMAP" ]; then
		sed -i "s|^Icon=.*|Icon=$PIXMAP|" "$desktop"
		if grep -q '^StartupWMClass=' "$desktop"; then
			sed -i "s|^StartupWMClass=.*|StartupWMClass=$APP|" "$desktop"
		else
			printf 'StartupWMClass=%s\n' "$APP" >> "$desktop"
		fi
	fi
done

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
	gtk-update-icon-cache -f /usr/share/icons/hicolor || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
	update-desktop-database -q /usr/share/applications || true
fi
