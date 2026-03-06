import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Contact() {
  return (
    <section
      id="contact"
      className="py-24 bg-gradient-to-b from-blue-50/30 to-white relative overflow-hidden scroll-mt-24"
    >
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-b from-blue-100/40 to-transparent rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tl from-sky-300/20 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="font-semibold tracking-wider uppercase text-sm mb-3"
            style={{ background: "linear-gradient(90deg,#2563eb,#4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Support
          </h2>
          <h3 className="text-3xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: "#0f172a" }}>
            Need help? Reach us directly.
          </h3>
          <p className="text-lg" style={{ color: "#475569" }}>
            Fast onboarding support and guidance for plan setup, migration, and account assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-blue-100 to-indigo-100 p-7 rounded-3xl border border-blue-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <Mail className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Email</h4>
            <a
              href="mailto:support@technodoc.in"
              className="text-blue-700 font-semibold hover:text-blue-900 hover:underline break-all"
            >
              support@technodoc.in
            </a>
          </div>

          <div className="bg-gradient-to-br from-sky-100 to-blue-100 p-7 rounded-3xl border border-sky-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-sky-600 to-blue-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <Phone className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Phone</h4>
            <a
              href="tel:+919825027360"
              className="text-sky-700 font-semibold hover:text-sky-900 hover:underline"
            >
              +91-9825027360
            </a>
          </div>

          <div className="bg-gradient-to-br from-indigo-100 to-slate-100 p-7 rounded-3xl border border-indigo-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-indigo-600 to-slate-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Location</h4>
            <p className="text-indigo-800 font-medium">Ahmedabad, Gujarat, India</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-blue-200/50 p-8 md:p-10 shadow-xl">
          <h4 className="font-display font-bold text-2xl text-slate-900 mb-5">Business Hours</h4>
          <div className="space-y-3 text-slate-700 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-semibold text-slate-800">Monday - Friday</span>
              <span>9:30 AM - 6:30 PM</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span className="font-semibold text-slate-800">Saturday & Sunday</span>
              <span className="text-slate-500 italic">Closed</span>
            </div>
          </div>

          <Button
            className="h-11 px-8 rounded-xl text-base font-semibold"
            onClick={() => window.location.href = "mailto:support@technodoc.in"}
          >
            Contact Support
          </Button>
        </div>
      </div>
    </section>
  );
}
