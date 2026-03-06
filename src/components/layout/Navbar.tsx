import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WmdLogo } from "@/components/WmdLogo";
import { useNavigate, useLocation } from "react-router-dom";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const location = useLocation();

  const scrollToPricing = () => {
    const base = import.meta.env.BASE_URL;
    if (location.pathname === "/") {
      window.history.replaceState(null, "", `${base}pricing`);
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => {
        window.history.replaceState(null, "", `${base}pricing`);
        document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      }, 350);
    }
  };

  const scrollToSection = (id: string) => {
    const base = import.meta.env.BASE_URL;
    if (location.pathname === "/" || location.pathname === `/${id}`) {
      window.history.replaceState(null, "", `${base}${id}`);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/");
      setTimeout(() => {
        window.history.replaceState(null, "", `${base}${id}`);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 350);
    }
  };

  const navLinks = [
    { name: "Features", onClick: () => scrollToSection("features") },
    { name: "Pricing", onClick: scrollToPricing },
    { name: "FAQ", onClick: () => scrollToSection("faq") },
    { name: "Contact", onClick: () => scrollToSection("contact") },
  ];

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm py-3 border-b border-blue-100" : "bg-transparent py-4"
        }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <WmdLogo size="sm" />
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <div className="flex gap-8 items-center">
              {navLinks.map((link) => (
                <button
                  key={link.name}
                  onClick={link.onClick}
                  className="text-slate-600 hover:text-[#1fb6ff] font-semibold transition-colors bg-transparent border-0 cursor-pointer"
                >
                  {link.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                className="rounded-full px-7 font-semibold border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all duration-200"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>

              <Button
                className="bg-[#1fb6ff] text-white hover:bg-[#0ea5e9] hover:shadow-[0_0_15px_rgba(31,182,255,0.4)] rounded-full px-7 font-bold shadow-md transition-all duration-300 hover:scale-105"
                onClick={scrollToPricing}
              >
                Get Started
              </Button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-foreground p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-background border-b border-border shadow-lg p-4 flex flex-col gap-4 animate-in slide-in-from-top-2 duration-200">
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => { setMobileMenuOpen(false); link.onClick?.(); }}
              className="text-foreground font-medium p-2 hover:bg-muted rounded-lg transition-colors text-left bg-transparent border-0 cursor-pointer w-full"
            >
              {link.name}
            </button>
          ))}

          <Button
            variant="outline"
            className="w-full rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate('/login');
            }}
          >
            Login
          </Button>

          <Button
            className="w-full bg-[#1fb6ff] text-white hover:bg-[#0ea5e9]"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate('/plans');
            }}
          >
            Get Started
          </Button>
        </div>
      )}
    </nav>
  );
}
