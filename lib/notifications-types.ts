/* The one type both sides of the bell share. Lives apart from
 * lib/notifications.ts because that module is server-only and the admin
 * screen (a client component) needs the audience names too. */
export type Audience = "admin" | "customer" | "partner";
