/*
 * Applies the reader's saved theme and text size before first paint, so
 * neither flashes.
 *
 * An external file rather than an inline <script> so the site's
 * Content-Security-Policy can stay at `script-src 'self'` — no
 * 'unsafe-inline', and no hash to keep in step with the file.
 *
 * Wrapped in try/catch because a browser with site data blocked throws on
 * the very first read, and a reader who has blocked cookies should still
 * get a working page.
 */
try {
  var theme = localStorage.getItem("hrc-theme");
  if (theme === "dark" || theme === "light") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  var scale = localStorage.getItem("hrc-text-scale");
  if (scale) {
    document.documentElement.style.setProperty("--text-scale", scale);
  }
} catch (error) {
  /* No stored preferences available. The defaults are a good page. */
}
