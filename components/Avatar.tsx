/*
 * Face slot. Renders the headshot when a photo path is set in
 * lib/site.ts; until then, a tasteful initials circle on a subtle
 * brand-tinted ground. Never stock photos.
 */

const sizes = {
  md: "h-10 w-10 text-[0.8125rem]",
  lg: "h-14 w-14 text-base",
} as const;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  photo,
  size = "md",
}: {
  name: string;
  photo: string | null;
  size?: keyof typeof sizes;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized images
      <img
        src={photo}
        alt={name}
        className={`shrink-0 rounded-full border border-hair object-cover ${sizes[size]}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-hair bg-card font-display font-semibold text-muted ${sizes[size]}`}
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(252,192,0,0.12), rgba(0,204,0,0.12))",
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
