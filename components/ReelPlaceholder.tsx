/*
 * Stands in wherever a real video will live (hero showreel, featured
 * work) until assets are delivered. Ambient, slow brand-color glows on
 * near-black: motion without pretending to be footage. Purely
 * decorative, so it is hidden from assistive tech. Swapping in a real
 * <video> changes nothing around it.
 */
export function ReelPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden bg-[#05060A] ${className}`}
    >
      <div className="drift-a absolute left-[10%] top-[2%] h-[75%] w-[55%] rounded-full bg-gold opacity-[0.13] blur-[110px]" />
      <div className="drift-b absolute -right-[5%] top-[10%] h-[85%] w-[60%] rounded-full bg-green opacity-[0.15] blur-[110px]" />
      <div className="drift-c absolute bottom-[-15%] right-[18%] h-[65%] w-[45%] rounded-full bg-blue opacity-[0.09] blur-[100px]" />
    </div>
  );
}
