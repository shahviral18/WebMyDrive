/**
 * WmdLogo — Accurate SVG replica of the WebMyDrive logo
 */
export function WmdLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
    const iconHeights = { sm: 44, md: 54, lg: 72 };
    const textSizes = { sm: "text-2xl", md: "text-3xl", lg: "text-5xl" };
    const h = iconHeights[size];
    const w = h * 2.3; // Proportion

    return (
        <div className="flex items-center gap-2 select-none">
            <img src={`${import.meta.env.BASE_URL}Logo-2.png`} alt="WebMyDrive" style={{ height: h }} />

            {/* "WebMyDrive" brand name beside the icon */}
            <span
                className={`font-bold ${textSizes[size]}`}
                style={{ color: "#12b5e5", letterSpacing: "-0.5px", fontFamily: "Arial, Helvetica, sans-serif" }}
            >
                WebMyDrive
            </span>
        </div>
    );
}
