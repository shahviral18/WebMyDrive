import { Settings } from "lucide-react";

export default function Controls() {
  return (
    <div className="p-6 h-[80vh] flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Settings className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">System Controls</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Advanced feature flags, gateway routing, and rate limits will be available in the upcoming System Controls update.
      </p>
      <div className="mt-8 px-4 py-1.5 bg-surface-2 border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Coming Soon
      </div>
    </div>
  );
}
