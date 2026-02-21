import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface ThemeContextType {
    isDark: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("wmd_theme");
        if (stored === "light") {
            setIsDark(false);
            document.documentElement.classList.remove("dark");
        } else {
            setIsDark(true);
            document.documentElement.classList.add("dark");
            localStorage.setItem("wmd_theme", "dark");
        }
    }, []);

    const toggleTheme = () => {
        setIsDark(prev => {
            const next = !prev;
            if (next) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("wmd_theme", "dark");
            } else {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("wmd_theme", "light");
            }
            return next;
        });
    };

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
    return ctx;
}
