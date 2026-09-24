/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {
    colors: { brand: { dark: '#0f172a', panel: '#1e293b', accent: '#06b6d4', fraud: '#f43f5e', warning: '#f59e0b', cleared: '#10b981', ai: '#8b5cf6' } },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
  } },
  plugins: [],
}

