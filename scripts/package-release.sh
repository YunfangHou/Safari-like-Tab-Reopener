#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${1:-${ROOT_DIR}/dist}"
VERSION="$(node -p "require('${ROOT_DIR}/package for Chromium/manifest.json').version")"
CHROMIUM_ARCHIVE="Safari-like-Tab-Reopener-Chromium-v${VERSION}.zip"
FIREFOX_ARCHIVE="Safari-like-Tab-Reopener-Firefox-v${VERSION}.xpi"

mkdir -p "${DIST_DIR}"

package_directory() {
    local source_directory="$1"
    local archive_name="$2"
    local temporary_archive="${DIST_DIR}/.${archive_name}.tmp"
    local final_archive="${DIST_DIR}/${archive_name}"

    rm -f "${temporary_archive}"
    (
        cd "${source_directory}"
        zip -q -r -X "${temporary_archive}" . -x '.DS_Store' '*/.DS_Store' 'Thumbs.db' '*/Thumbs.db'
    )
    unzip -tq "${temporary_archive}"
    unzip -Z1 "${temporary_archive}" | grep -qx 'manifest.json'
    mv -f "${temporary_archive}" "${final_archive}"
}

package_directory "${ROOT_DIR}/package for Chromium" "${CHROMIUM_ARCHIVE}"
package_directory "${ROOT_DIR}/package for Firefox" "${FIREFOX_ARCHIVE}"

if command -v shasum >/dev/null 2>&1; then
    (
        cd "${DIST_DIR}"
        shasum -a 256 "${CHROMIUM_ARCHIVE}" "${FIREFOX_ARCHIVE}" > SHA256SUMS.txt
    )
else
    (
        cd "${DIST_DIR}"
        sha256sum "${CHROMIUM_ARCHIVE}" "${FIREFOX_ARCHIVE}" > SHA256SUMS.txt
    )
fi

echo "Created release artifacts in ${DIST_DIR}:"
echo "  ${CHROMIUM_ARCHIVE}"
echo "  ${FIREFOX_ARCHIVE}"
echo "  SHA256SUMS.txt"
