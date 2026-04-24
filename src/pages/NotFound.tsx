import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

export default function NotFound() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  return (
    <div className={cn("min-h-screen flex flex-col items-center justify-center px-4 gap-6", isDark ? "bg-slate-950 text-white" : "bg-[#f8fbff] text-slate-800")}>
      <div className="text-8xl font-black text-blue-500 leading-none">404</div>
      <h1 className="text-2xl font-bold text-center">Page Not Found</h1>
      <p className={cn("text-center text-sm max-w-sm", isDark ? "text-slate-400" : "text-slate-500")}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={cn("px-5 py-2 rounded-lg text-sm font-semibold border transition-colors", isDark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-100")}
        >
          Go Back
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          Home
        </button>
      </div>
    </div>
  );
}
