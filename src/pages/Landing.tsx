import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Stats } from "@/components/sections/Stats";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Pricing } from "@/components/sections/Pricing";
import { FAQ } from "@/components/sections/FAQ";
import { Contact } from "@/components/sections/Contact";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Stats />
        <Features />
        <HowItWorks />
        <Pricing />

        {/* ── Ready to get started CTA ── mirrors webmydrive.com below plans ── */}
        <section className="py-16 bg-[#f8f9fc] border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-2xl font-normal text-[#475569] mb-4">
              Ready to get started with Google Workspace?
            </p>
            <p className="text-xl text-[#64748b] mb-6">
              Choose a plan above to subscribe and activate your account
            </p>
            <button
              onClick={() => navigate("/activate")}
              className="text-[#1fb6ff] font-semibold text-xl hover:text-[#0ea5e9] hover:underline transition-colors"
            >
              Already purchased, click here to Activate the account
            </button>
          </div>
        </section>

        <FAQ />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
