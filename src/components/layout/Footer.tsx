import { Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { WmdLogo } from "@/components/WmdLogo";

export function Footer() {
  return (
    <footer className="bg-gradient-to-t from-slate-950 via-slate-900 to-blue-950 pt-20 pb-10 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <WmdLogo size="md" />
            </div>
            <p className="text-slate-400 max-w-sm mb-6 leading-relaxed">
              Enterprise-grade cloud storage solutions built for modern teams. Secure, fast, and remarkably easy to use.
            </p>
            <div className="flex gap-4">
              <a href="https://x.com/webmydrive" target="_blank" rel="noopener noreferrer" aria-label="WebMyDrive on X (Twitter)" className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center hover:scale-110 hover:from-blue-500 hover:to-sky-400 hover:text-white transition-all duration-200 shadow-md">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://www.facebook.com/webmydrive" target="_blank" rel="noopener noreferrer" aria-label="WebMyDrive on Facebook" className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-700 to-blue-400 flex items-center justify-center hover:scale-110 hover:from-sky-500 hover:to-blue-400 hover:text-white transition-all duration-200 shadow-md">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://www.linkedin.com/company/webmydrive" target="_blank" rel="noopener noreferrer" aria-label="WebMyDrive on LinkedIn" className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-400 flex items-center justify-center hover:scale-110 hover:from-sky-400 hover:to-blue-400 hover:text-white transition-all duration-200 shadow-md">
                <Linkedin className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/webmydrive" target="_blank" rel="noopener noreferrer" aria-label="WebMyDrive on Instagram" className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center hover:scale-110 hover:from-sky-400 hover:to-blue-500 hover:text-white transition-all duration-200 shadow-md">
                <Instagram className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Company</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="#" className="hover:text-sky-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">Careers</a></li>
              <li><Link to="/resell" className="hover:text-emerald-400 transition-colors">Resell WebMyDrive</Link></li>
              <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-6">Resources</h4>
            <ul className="flex flex-col gap-4">
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-sky-400 transition-colors">API Documentation</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">System Status</a></li>
              <li><a href="#contact" className="hover:text-indigo-400 transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} WebMyDrive. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-sky-300 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-300 transition-colors">Terms</a>
            <a href="#" className="hover:text-indigo-300 transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
