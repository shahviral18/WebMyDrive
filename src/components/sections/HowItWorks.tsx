import { UserPlus, CreditCard, FolderOpen, Share2 } from "lucide-react";

const steps = [
    {
        icon: <UserPlus className="h-7 w-7" />,
        step: "01",
        title: "Create Your Account",
        description: "Sign up in seconds with your email address. No credit card required to get started.",
        color: "from-blue-500 to-indigo-600",
        bg: "from-blue-50 to-indigo-50",
        border: "border-blue-200",
    },
    {
        icon: <CreditCard className="h-7 w-7" />,
        step: "02",
        title: "Choose Your Plan",
        description: "Pick the storage plan that fits your team. Upgrade or downgrade at any time with zero hassle.",
        color: "from-sky-500 to-blue-600",
        bg: "from-sky-50 to-blue-50",
        border: "border-sky-200",
    },
    {
        icon: <FolderOpen className="h-7 w-7" />,
        step: "03",
        title: "Upload & Organise",
        description: "Drag & drop any file type — documents, photos, videos, code. Organise with smart folders and tags.",
        color: "from-indigo-500 to-blue-600",
        bg: "from-indigo-50 to-slate-50",
        border: "border-indigo-200",
    },
    {
        icon: <Share2 className="h-7 w-7" />,
        step: "04",
        title: "Share & Collaborate",
        description: "Share secure links with teammates or clients. Set expiry dates, passwords and access permissions.",
        color: "from-blue-600 to-sky-500",
        bg: "from-blue-50 to-cyan-50",
        border: "border-blue-200",
    },
];

export function HowItWorks() {
    return (
        <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-blue-50/40 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-100/30 to-transparent rounded-full blur-3xl -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">
                        Getting Started
                    </h2>
                    <h3 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
                        Up and running in{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">4 simple steps</span>
                    </h3>
                    <p className="text-lg text-muted-foreground">
                        WebMyDrive is designed to be simple. No technical knowledge required — just sign up and go.
                    </p>
                </div>

                {/* Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                    {/* Connecting line */}
                    <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-blue-200 z-0" />

                    {steps.map((s, i) => (
                        <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                            {/* Step number circle */}
                            <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${s.bg} border-2 ${s.border} flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-300`}>
                                <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-md`}>
                                    {s.icon}
                                </div>
                                <span className={`absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-br ${s.color} text-white text-xs font-bold flex items-center justify-center shadow`}>
                                    {s.step}
                                </span>
                            </div>
                            <h4 className="text-lg font-bold text-foreground mb-3">{s.title}</h4>
                            <p className="text-muted-foreground text-sm leading-relaxed max-w-[200px]">{s.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
