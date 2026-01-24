/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Signature Shades Brand Colors
                brand: {
                    gold: '#C9A961',
                    'gold-light': '#D4B979',
                    'gold-dark': '#B89548',
                    navy: '#1B2B3A',
                    'navy-light': '#2A3F52',
                    'navy-dark': '#0F1A24',
                },
                // Status colors
                status: {
                    success: '#10B981',
                    warning: '#F59E0B',
                    error: '#EF4444',
                    info: '#3B82F6',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'brand': '0 4px 6px -1px rgba(201, 169, 97, 0.1), 0 2px 4px -1px rgba(201, 169, 97, 0.06)',
                'brand-lg': '0 10px 15px -3px rgba(201, 169, 97, 0.1), 0 4px 6px -2px rgba(201, 169, 97, 0.05)',
            },
        },
    },
    plugins: [],
}
