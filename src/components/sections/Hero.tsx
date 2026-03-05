import { ArrowRight, ShieldCheck, Zap, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden bg-gradient-to-b from-white via-white to-purple-50">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-gradient-to-br from-purple-200/40 to-transparent rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-gradient-to-bl from-orange-200/30 to-transparent rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-gradient-to-tr from-teal-200/20 to-transparent rounded-full blur-3xl -z-10" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 shadow-sm mb-8"
          >
            <span className="flex h-2 w-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse" />
            <span className="text-sm font-medium bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent">New enterprise features available</span>
          </div>

          <h1
            className="text-5xl md:text-7xl font-display font-extrabold text-foreground leading-tight mb-6"
          >
            Secure Cloud Storage for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500">Modern Teams</span>
          </h1>

          <p
            className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            Store, share, and collaborate on files and folders from any mobile device, tablet, or computer. Bank-grade security included standard.
          </p>

          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button 
              size="lg" 
              className="w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-purple-400/30 hover:shadow-xl hover:shadow-purple-400/40 transition-all hover:-translate-y-0.5"
              onClick={() => document.getElementById('pricing')?.scrollIntoView()}
            >
              View Plans <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto text-lg h-14 px-8 rounded-full bg-white/50 backdrop-blur-sm border-2 border-purple-200 hover:bg-white hover:border-purple-300 text-purple-700 hover:text-purple-800"
              onClick={() => document.getElementById('contact')?.scrollIntoView()}
            >
              Contact Sales
            </Button>
          </div>

          <div
            className="mt-16 pt-10 border-t border-border/60 flex flex-wrap justify-center gap-8 md:gap-16"
          >
            <div className="flex items-center gap-2 font-display font-bold text-xl"><ShieldCheck className="h-6 w-6 text-purple-600"/> SOC2 Compliant</div>
            <div className="flex items-center gap-2 font-display font-bold text-xl"><Zap className="h-6 w-6 text-orange-500"/> 99.9% Uptime</div>
            <div className="flex items-center gap-2 font-display font-bold text-xl"><HardDrive className="h-6 w-6 text-teal-500"/> End-to-End Encryption</div>
          </div>
        </div>
      </div>
    </section>
  );
}
