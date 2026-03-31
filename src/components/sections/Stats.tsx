import { Users2, HardDrive, Server, Award } from "lucide-react";

const stats = [
    { icon: <Users2 className="h-7 w-7" />, value: "Up To 300", label: "Active Users", color: "text-blue-600" },
    { icon: <HardDrive className="h-7 w-7" />, value: "1.32 PB", label: "Data Stored", color: "text-indigo-600" },
    { icon: <Server className="h-7 w-7" />, value: "99.99%", label: "Uptime SLA", color: "text-sky-600" },
    { icon: <Award className="h-7 w-7" />, value: "ISO 27001", label: "Certified", color: "text-blue-700" },
];

export function Stats() {
    return (
        <section className="py-16 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 relative overflow-hidden">
            {/* Decorations */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-white/5 rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((s, i) => (
                        <div key={i} className="text-center group">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/15 text-white mb-4 group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
                                {s.icon}
                            </div>
                            <p className="text-3xl md:text-4xl font-extrabold text-white mb-1">{s.value}</p>
                            <p className="text-blue-200 text-sm font-medium">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
