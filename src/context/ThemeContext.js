"use client";
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(undefined);

export const ThemeProvider = ({ children }) => {
    // PENTING: initializer ini HARUS menghasilkan nilai yang sama persis
    // di server maupun di client saat render pertama. Jangan baca
    // window/localStorage/matchMedia di sini — function ini ikut jalan
    // lagi saat React hydrate di client, jadi kalau isinya beda dari
    // yang dipakai server, itu penyebab hydration mismatch.
    const [theme, setTheme] = useState('dark');

    // isThemeReady: true setelah kita sempat baca preferensi asli user
    // di client. Komponen yang render sesuatu berdasarkan `theme` (icon,
    // warna kondisional, dll) sebaiknya tunggu flag ini true dulu sebelum
    // menampilkan versi yang "sadar tema" — sama seperti pola isClient
    // yang sudah dipakai di Navbar.
    const [isThemeReady, setIsThemeReady] = useState(false);

    // Baca preferensi asli HANYA setelah mount di client (post-hydration).
    // Perubahan di sini terjadi lewat setState biasa, jadi React akan
    // re-render dengan aman — bukan lagi menyamakan HTML server vs client.
    useEffect(() => {
        const savedTheme = window.localStorage.getItem('theme');
        const prefersDark =
            window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolvedTheme = savedTheme || (prefersDark ? 'dark' : 'light');

        setTheme(resolvedTheme);
        setIsThemeReady(true);
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isThemeReady }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};