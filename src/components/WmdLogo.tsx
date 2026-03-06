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
            {/* Cloud icon with webmydrive text inside */}
            <svg
                width={w}
                height={h}
                viewBox="0 0 240 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                {/* Main Left Cloud Body */}
                {/* D raw a nice tall bubble for "web" & "my" to stay clear of the bottom line */}
                <path
                    d="M 140 45 A 25 25 0 0 0 100 25 A 35 35 0 0 0 40 40 A 25 25 0 0 0 40 85 L 140 85"
                    fill="none"
                    stroke="#1abbed"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                />

                {/* Right Sync Arrows enveloping "drive" */}
                {/* Top Arrow arc (left to right) */}
                <path d="M 135 60 A 30 30 0 0 1 215 60" fill="none" stroke="#1abbed" strokeWidth="2.5" />
                <path d="M 205 52 L 215 60 L 222 52" fill="none" stroke="#1abbed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Bottom Arrow arc (right to left) */}
                <path d="M 215 70 A 30 30 0 0 1 135 70" fill="none" stroke="#1abbed" strokeWidth="2.5" />
                <path d="M 145 78 L 135 70 L 128 78" fill="none" stroke="#1abbed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Text inside the logo — nicely bounded above the Y=85 bottom line, avoiding the arrow paths */}
                <text x="35" y="75" fontFamily="Century Gothic, Tw Cen MT, Arial, sans-serif" fontWeight="400" fontSize="36" fill="#d3297a" letterSpacing="-1">web</text>
                <text x="96" y="75" fontFamily="Century Gothic, Tw Cen MT, Arial, sans-serif" fontWeight="400" fontSize="36" fill="#f79c1e" letterSpacing="-1">my</text>
                <text x="145" y="75" fontFamily="Century Gothic, Tw Cen MT, Arial, sans-serif" fontWeight="400" fontSize="36" fill="#1abbed" letterSpacing="-1">drive</text>

                {/* Tagline below the main body */}
                <text x="40" y="96" fontFamily="Arial, sans-serif" fontWeight="400" fontSize="9" fill="#c41262" letterSpacing="0">Carry your data where you go!!</text>
            </svg>

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
