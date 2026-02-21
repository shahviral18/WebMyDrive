import { Activity } from "lucide-react";

export default function Queues() {
  return (
    <div className="p-6 h-[80vh] flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Activity className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">System Queues</h1>
      <p className="text-muted-foreground text-center max-w-md">
        Background job monitoring and dead-letter queue management will be available in the upcoming Operations update.
      </p>
      <div className="mt-8 px-4 py-1.5 bg-surface-2 border border-border rounded-full text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Coming Soon
      </div>
    </div>
  );
}
