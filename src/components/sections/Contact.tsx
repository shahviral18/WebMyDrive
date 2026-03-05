import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Contact() {
  return (
    <section
      id="contact"
      className="py-24 bg-gradient-to-br from-white via-pink-50/40 to-purple-50/40 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-pink-300/20 to-transparent rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tl from-purple-300/20 to-transparent rounded-full blur-3xl -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">
            Support
          </h2>
          <h3 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6 leading-tight">
            Need help? Reach us directly.
          </h3>
          <p className="text-lg text-slate-600">
            Fast onboarding support and guidance for plan setup, migration, and account assistance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-7 rounded-3xl border border-purple-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <Mail className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Email</h4>
            <a
              href="mailto:support@technodoc.in"
              className="text-purple-700 font-semibold hover:text-purple-900 hover:underline break-all"
            >
              support@technodoc.in
            </a>
          </div>

          <div className="bg-gradient-to-br from-orange-100 to-yellow-100 p-7 rounded-3xl border border-orange-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-orange-600 to-yellow-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <Phone className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Phone</h4>
            <a
              href="tel:+919825027360"
              className="text-orange-700 font-semibold hover:text-orange-900 hover:underline"
            >
              +91-9825027360
            </a>
          </div>

          <div className="bg-gradient-to-br from-teal-100 to-cyan-100 p-7 rounded-3xl border border-teal-200/50 shadow-lg">
            <div className="bg-gradient-to-br from-teal-600 to-cyan-600 p-3 rounded-full text-white w-fit mb-5 shadow-lg">
              <MapPin className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 mb-2 text-lg">Location</h4>
            <p className="text-teal-800 font-medium">Ahmedabad, Gujarat, India</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white/80 backdrop-blur-sm border border-purple-200/50 p-8 md:p-10 shadow-xl">
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
