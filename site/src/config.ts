// Things to change for every new release of the app.
export const VERSION = '0.4.0'
export const SIZE_MB = 107

// The .exe files are too big for the site itself, so they live on GitHub Releases.
const RELEASES = 'https://github.com/pashok3345u-netizen/ice-boost/releases'
export const DOWNLOAD_URL = `${RELEASES}/download/v${VERSION}/IceBoost-Setup-${VERSION}.exe`
export const PORTABLE_URL = `${RELEASES}/download/v${VERSION}/IceBoost-${VERSION}-portable.exe`
export const RELEASES_URL = RELEASES

// Where the site lives (e.g. "/" on Vercel, "/ice-boost/" on GitHub Pages) — set by vite.config.ts.
export const BASE = import.meta.env.BASE_URL
export const asset = (path: string): string => BASE + path
