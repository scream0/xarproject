"use client";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { useEffect, useState } from "react";

export const ThemeProvider = ({ children }) => {
    return (
        <NextThemesProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
            {children}
        </NextThemesProvider>
    );
};

export const useTheme = () => {
    const { theme, setTheme, resolvedTheme } = useNextTheme();
    const [isThemeReady, setIsThemeReady] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsThemeReady(true);
    }, []);

    const toggleTheme = () => {
        setTheme(resolvedTheme === "light" ? "dark" : "light");
    };

    return {
        theme: resolvedTheme || theme,
        setTheme,
        toggleTheme,
        isThemeReady,
    };
};