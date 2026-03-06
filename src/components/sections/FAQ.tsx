import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
    {
        q: "What file types does WebMyDrive support?",
        a: "WebMyDrive supports all file types — documents (PDF, Word, Excel), images (JPG, PNG, RAW), videos (MP4, MOV, AVI), design files (PSD, AI, Figma), code archives, and more. There's no restriction on file type.",
    },
    {
        q: "Is my data encrypted?",
        a: "Yes. All files are encrypted with AES-256 at rest and transmitted over TLS 1.3. Even WebMyDrive employees cannot access your files. For enterprise customers, we also offer client-managed encryption keys.",
    },
    {
        q: "Can I share files with people who don't have a WebMyDrive account?",
        a: "Absolutely. You can generate a secure shareable link for any file or folder. You can also set expiry dates, download limits, and password-protect share links for extra security.",
    },
    {
        q: "What happens if I exceed my storage limit?",
        a: "You'll receive an email notification when you reach 80% and 95% of your storage limit. Uploads will be paused at 100%. You can upgrade your plan at any time to instantly restore full access.",
    },
    {
        q: "Is there a limit on the number of users per account?",
        a: "Basic plans include 1 user. Professional plans support up to 5 users. Enterprise plans have unlimited user seats. Additional user seats can also be purchased as add-ons.",
    },
    {
        q: "How does the referral program work?",
        a: "Each WebMyDrive user gets a unique referral link. When someone you refer purchases any paid plan, you receive a commission credited to your wallet. Your wallet balance can be used to pay for your own plan renewals.",
    },
    {
        q: "Can I cancel my subscription at any time?",
        a: "Yes. You can cancel your subscription from your dashboard at any time. Your account remains active until the end of your current billing period. We do not pro-rate cancellations, but we also never charge cancellation fees.",
    },
    {
        q: "Do you offer GST invoices?",
        a: "Yes. All purchases generate a GST-compliant tax invoice. You can also add your GSTIN during checkout so it appears on your invoice. Invoices are available for download from your billing dashboard.",
    },
    {
        q: "How is WebMyDrive different from Google Drive or Dropbox?",
        a: "WebMyDrive is built specifically for Indian businesses — INR pricing, GST invoices, local support, and data stored in Indian data centers. We also offer a commission-based referral and distributor program that no other cloud storage provider matches.",
    },
];

export function FAQ() {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section id="faq" className="py-24 bg-gradient-to-b from-white to-blue-50/30 relative overflow-hidden">
            <div className="absolute top-1/3 -right-24 w-72 h-72 bg-gradient-to-bl from-blue-100/40 to-transparent rounded-full blur-3xl" />

            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-semibold tracking-wider uppercase text-sm mb-3">
                        FAQ
                    </h2>
                    <h3 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">
                        Frequently Asked{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Questions</span>
                    </h3>
                    <p className="text-lg text-muted-foreground">
                        Everything you need to know about WebMyDrive. Can't find the answer? Reach out to our support team.
                    </p>
                </div>

                <div className="space-y-3">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className={`border rounded-2xl overflow-hidden transition-all duration-300 ${open === i
                                    ? "border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 shadow-md"
                                    : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-sm"
                                }`}
                        >
                            <button
                                onClick={() => setOpen(open === i ? null : i)}
                                className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
                            >
                                <span className={`font-semibold text-base transition-colors ${open === i ? "text-blue-700" : "text-foreground"}`}>
                                    {faq.q}
                                </span>
                                <ChevronDown
                                    className={`h-5 w-5 shrink-0 text-blue-500 transition-transform duration-300 ${open === i ? "rotate-180" : ""}`}
                                />
                            </button>
                            <div
                                className={`transition-all duration-300 overflow-hidden ${open === i ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
                            >
                                <p className="px-6 pb-5 text-muted-foreground leading-relaxed text-sm">
                                    {faq.a}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-12 text-center p-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-3xl border border-blue-100">
                    <p className="font-semibold text-foreground mb-2">Still have questions?</p>
                    <p className="text-muted-foreground text-sm mb-4">
                        Our support team is available Monday–Saturday, 9am–6pm IST.
                    </p>
                    <a
                        href="#contact"
                        onClick={(e) => { e.preventDefault(); document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" }); }}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-blue-300/40 hover:-translate-y-0.5 transition-all"
                    >
                        Contact Support
                    </a>
                </div>
            </div>
        </section>
    );
}
