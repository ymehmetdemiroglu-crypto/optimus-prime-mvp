/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                prime: {
                    black: '#080c10',
                    dark: '#0e1419',
                    darker: '#141c24',
                    red: '#c41e3a',
                    blue: '#1a4f8b',
                    silver: '#8a9bae',
                    gunmetal: '#3a4a5c',
                    energon: '#00FBFF',
                    gold: '#d4a843',
                },
                // Keep cyber aliases for any leftover references during migration
                cyber: {
                    black: '#080c10',
                    dark: '#0e1419',
                    darker: '#141c24',
                    cyan: '#00FBFF',
                    blue: '#1a4f8b',
                    lime: '#34d399',
                    purple: '#8b5cf6',
                    red: '#c41e3a',
                },
            },
            boxShadow: {
                'energon': '0 0 20px rgba(0, 251, 255, 0.25)',
                'energon-strong': '0 0 30px rgba(0, 251, 255, 0.4)',
                'autobot-red': '0 0 20px rgba(196, 30, 58, 0.25)',
                'neon-cyan': '0 0 20px rgba(0, 251, 255, 0.25)',
                'neon-blue': '0 0 20px rgba(26, 79, 139, 0.3)',
                'neon-lime': '0 0 20px rgba(52, 211, 153, 0.3)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'energon-pulse': 'energonPulse 2s ease-in-out infinite alternate',
                'scan-line': 'scanLine 3s linear infinite',
            },
            keyframes: {
                energonPulse: {
                    '0%': { boxShadow: '0 0 5px rgba(0, 251, 255, 0.15)' },
                    '100%': { boxShadow: '0 0 25px rgba(0, 251, 255, 0.5)' },
                },
                scanLine: {
                    '0%': { transform: 'translateY(-100%)' },
                    '100%': { transform: 'translateY(100%)' },
                },
            }
        },
    },
    plugins: [],
}
