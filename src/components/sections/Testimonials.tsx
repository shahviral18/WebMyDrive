import { Star, Quote } from "lucide-react";

const testimonials = [
    {
        name: "Rahul Sharma",
        role: "CTO, TechNova Pvt. Ltd.",
        initials: "RS",
        color: "from-blue-500 to-indigo-600",
        rating: 5,
        text: "Switched from Google Drive to WebMyDrive 8 months ago. The speed is noticeably better and our compliance team loves the audit logs. Highly recommended for any serious business.",
    },
    {
        name: "Priya Mehta",
        role: "Founder, DesignLab Studio",
        initials: "PM",
        color: "from-sky-500 to-blue-600",
        rating: 5,
        text: "We manage large design files daily — Photoshop, Illustrator, video exports. WebMyDrive handles all of it flawlessly. Upload speeds are incredible even on our office connection.",
    },
    {
        name: "Aakash Gupta",
        role: "Operations Head, RetailPro",
        initials: "AG",
        color: "from-indigo-500 to-slate-700",
        rating: 5,
        text: "The referral program is fantastic — we've saved over ₹12,000 in wallet credits just by referring colleagues. The platform itself is rock solid. Zero downtime in 6 months.",
    },
    {
        name: "Sneha Kapoor",
        role: "Lead Developer, Finserv.io",
        initials: "SK",
        color: "from-blue-600 to-sky-500",
        rating: 5,
        text: "End-to-end encryption and the ransomware rollback feature are what sold us. Our security auditor was impressed. Great value for what you get compared to enterprise alternatives.",
    },
    {
        name: "Vikram Nair",
        role: "Managing Director, LegalEdge",
        initials: "VN",
        color: "from-slate-600 to-blue-700",
        rating: 5,
        text: "As a law firm, data confidentiality is non-negotiable. WebMyDrive ticks every box — data residency, audit trails, granular access controls. Support team is very responsive too.",
    },
    {
        name: "Anjali Singh",
        role: "CEO, EduVision Technologies",
        initials: "AS",
        color: "from-blue-500 to-cyan-600",
        rating: 5,
        text: "We host all our course videos and student materials on WebMyDrive. The collaboration features let our content team work together seamlessly. Best decision we made this year.",
    },
];

function StarRow({ count }: { count: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: count }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
        </div>
    );
}

export function Testimonials() {
    return (
        <section id="testimonials" className="py-24 bg-gradient-to-b from-blue-50/40 via-white to-blue-50/20 relative overflow-hidden">
            <div className="absolute -top-20 right-0 w-72 h-72 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-indigo-100/30 to-transparent rounded-full blur-3xl" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">
                        Customer Stories
                    </h2>
                    <h3 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
                        Trusted by{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                            thousands of teams
                        </span>{" "}
                        across India
                    </h3>
                    <p className="text-lg text-muted-foreground">
                        Don't just take our word for it — here's what our customers have to say.
                    </p>

                    {/* Rating badge */}
                    <div className="inline-flex items-center gap-3 mt-6 px-6 py-3 bg-white rounded-full border border-blue-100 shadow-md">
                        <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
                        </div>
                        <span className="text-sm font-semibold text-foreground">4.9/5</span>
                        <span className="text-sm text-muted-foreground">from 2,400+ reviews</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {testimonials.map((t, i) => (
                        <div
                            key={i}
                            className="bg-white rounded-3xl p-8 border border-blue-100/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-50 to-transparent rounded-bl-full opacity-60" />
                            <Quote className="h-8 w-8 text-blue-200 mb-4" />
                            <p className="text-foreground leading-relaxed mb-6 text-sm">{t.text}</p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                                <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                                    {t.initials}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-foreground truncate">{t.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{t.role}</p>
                                </div>
                                <div className="ml-auto shrink-0">
                                    <StarRow count={t.rating} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
