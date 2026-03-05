import { Shield, Zap, Globe2, RefreshCw, Lock, Users } from "lucide-react";

const features = [
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Military-Grade Security",
    description: "Your data is protected with AES-256 encryption at rest and TLS 1.2+ in transit. We take your privacy seriously.",
    bgColor: "from-purple-100 to-pink-100",
    iconBg: "bg-purple-200",
    iconColor: "text-purple-700",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Lightning Fast Speeds",
    description: "Global edge network ensures your files upload and download at maximum bandwidth, wherever you are.",
    bgColor: "from-orange-100 to-yellow-100",
    iconBg: "bg-orange-200",
    iconColor: "text-orange-700",
  },
  {
    icon: <Globe2 className="h-6 w-6" />,
    title: "Access Anywhere",
    description: "Seamlessly sync across all your devices. Access your work from your phone, tablet, or web browser.",
    bgColor: "from-teal-100 to-cyan-100",
    iconBg: "bg-teal-200",
    iconColor: "text-teal-700",
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Team Collaboration",
    description: "Granular permissions, shared folders, and audit logs make teamwork secure and effortless.",
    bgColor: "from-blue-100 to-indigo-100",
    iconBg: "bg-blue-200",
    iconColor: "text-blue-700",
  },
  {
    icon: <RefreshCw className="h-6 w-6" />,
    title: "Automated Backups",
    description: "Never lose a file again. Continuous backup with 30-day file version history recovery.",
    bgColor: "from-green-100 to-emerald-100",
    iconBg: "bg-green-200",
    iconColor: "text-green-700",
  },
  {
    icon: <Lock className="h-6 w-6" />,
    title: "Ransomware Protection",
    description: "Advanced machine learning detects malicious activity and allows one-click folder rollback.",
    bgColor: "from-pink-100 to-red-100",
    iconBg: "bg-pink-200",
    iconColor: "text-pink-700",
  }
];

export function Features() {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-white via-blue-50/30 to-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">Why WebMyDrive</h2>
          <h3 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
            Everything you need in a modern cloud storage platform.
          </h3>
          <p className="text-lg text-muted-foreground">
            We've built a platform that balances enterprise-grade security with consumer-grade ease of use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`p-8 rounded-3xl bg-gradient-to-br ${feature.bgColor} border border-white/50 hover:shadow-xl hover:border-white transition-all duration-300 group cursor-pointer hover:-translate-y-1`}
            >
              <div className={`h-12 w-12 rounded-2xl ${feature.iconBg} ${feature.iconColor} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                {feature.icon}
              </div>
              <h4 className="text-xl font-bold text-foreground mb-3">{feature.title}</h4>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
