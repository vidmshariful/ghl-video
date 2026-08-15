/*
 * Portal theme constants, in a server-safe module (no "use client") so the
 * portal LAYOUTS (server components) can inline the init script string.
 * The script applies the saved theme before first paint, so a light-mode
 * user never sees a dark flash. Only [data-surface="portal"] styles react
 * to the attribute, so the marketing site and checkout are untouched.
 */
export const THEME_KEY = "ghlv-portal-theme";

export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();`;
