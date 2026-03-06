import { ArrowRight, ShieldCheck, Zap, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section
      className="relative pt-24 pb-20 md:pt-36 md:pb-28 overflow-hidden"
      style={{ background: "#ffffff" }}
    >
      {/* Vivid blue radial glow — top-left */}
      <div
        className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(31,182,255,0.18) 0%, transparent 70%)",
        }}
      />
      {/* Vivid blue radial glow — top-right */}
      <div
        className="absolute -top-20 -right-40 w-[600px] h-[600px] rounded-full -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center justify-center">
        <div className="text-center max-w-4xl mx-auto flex flex-col items-center">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-300 bg-blue-50 shadow-sm mb-8">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-semibold text-blue-700">
              New enterprise features available
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6 tracking-tight"
            style={{ color: "#0f172a" }}
          >
            Secure Cloud Storage for{" "}
            <br className="hidden md:block" />
            <span
              style={{
                background: "linear-gradient(90deg, #1d4ed8 0%, #0ea5e9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Modern Teams
            </span>
          </h1>

          {/* Sub-text */}
          <p
            className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{ color: "#334155" }}
          >
            Store, share, and collaborate on files and folders from any mobile
            device, tablet, or computer. Bank-grade security included standard.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto text-lg font-bold h-14 px-10 rounded-full text-white transition-all duration-300 hover:scale-[1.04]"
              style={{
                background: "linear-gradient(90deg, #1fb6ff 0%, #0284c7 100%)",
                boxShadow: "0 8px 24px -4px rgba(31,182,255,0.55)",
                border: "none",
              }}
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              View Plans <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto text-lg font-bold h-14 px-10 rounded-full transition-all duration-300 hover:scale-[1.04]"
              style={{
                background: "#ffffff",
                border: "2px solid #cbd5e1",
                color: "#1e293b",
              }}
              onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
            >
              Contact Sales
            </Button>
          </div>

          {/* Trust badges */}
          <div className="mt-16 pt-10 w-full flex flex-wrap justify-center gap-8 md:gap-16"
            style={{ borderTop: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center gap-2 font-bold text-lg" style={{ color: "#1e293b" }}>
              <ShieldCheck className="h-6 w-6" style={{ color: "#2563eb" }} />
              SOC2 Compliant
            </div>
            <div className="flex items-center gap-2 font-bold text-lg" style={{ color: "#1e293b" }}>
              <Zap className="h-6 w-6" style={{ color: "#0ea5e9" }} />
              99.9% Uptime
            </div>
            <div className="flex items-center gap-2 font-bold text-lg" style={{ color: "#1e293b" }}>
              <HardDrive className="h-6 w-6" style={{ color: "#0ea5e9" }} />
              End-to-End Encryption
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
