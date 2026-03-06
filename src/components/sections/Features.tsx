import { Shield, Zap, Globe2, RefreshCw, Lock, Users } from "lucide-react";

const features = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Military-Grade Security",
    description: "Your data is protected with AES-256 encryption at rest and TLS 1.2+ in transit. We take your privacy seriously.",
    bgColor: "from-blue-100 to-indigo-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Lightning Fast Speeds",
    description: "Global edge network ensures your files upload and download at maximum bandwidth, wherever you are.",
    bgColor: "from-sky-100 to-cyan-100",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-700",
  },
  {
    icon: <Globe2 className="h-6 w-6" />,
    title: "Access Anywhere",
    description: "Seamlessly sync across all your devices. Access your work from your phone, tablet, or web browser.",
    bgColor: "from-indigo-100 to-violet-100",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-700",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Team Collaboration",
    description: "Granular permissions, shared folders, and audit logs make teamwork secure and effortless.",
    bgColor: "from-sky-100 to-blue-100",
    iconBg: "bg-sky-100",
    iconColor: "text-blue-700",
  },
  {
    icon: <RefreshCw className="h-6 w-6" />,
    title: "Automated Backups",
    description: "Never lose a file again. Continuous backup with 30-day file version history recovery.",
    bgColor: "from-teal-50 to-emerald-100",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: "Ransomware Protection",
    description: "Advanced machine learning detects malicious activity and allows one-click folder rollback.",
    bgColor: "from-rose-50 to-pink-100",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 relative scroll-mt-24" style={{ background: "#ffffff" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-semibold tracking-wider uppercase text-sm mb-3"
            style={{ background: "linear-gradient(90deg,#2563eb,#4f46e5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Why WebMyDrive
          </h2>
          <h3 className="text-3xl md:text-5xl font-bold mb-6" style={{ color: "#0f172a" }}>
            Everything you need in a modern cloud storage platform.
          </h3>
          <p className="text-lg" style={{ color: "#475569" }}>
            We've built a platform that balances enterprise-grade security with consumer-grade ease of use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-8 rounded-3xl bg-gradient-to-br ${feature.bgColor} hover:shadow-xl transition-all duration-300 group cursor-pointer hover:-translate-y-1`}
              style={{ border: "1px solid #e2e8f0" }}
            >
              <div className={`h-12 w-12 rounded-2xl ${feature.iconBg} ${feature.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-all duration-300`}>
                {feature.icon}
              </div>
              <h4 className="text-xl font-bold mb-3" style={{ color: "#1e293b" }}>{feature.title}</h4>
              <p className="leading-relaxed" style={{ color: "#475569" }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
