/*
 * Re-export shim. The catalogue mapping layer moved to components/library,
 * a shared part, when the library became a portal-surface page and the
 * portal needed the same card the site uses. Site code keeps importing from
 * here; the part boundary rules stop the portal importing THIS path.
 */
export * from "@/components/library/catalog";
