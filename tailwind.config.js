/** @type {import('tailwindcss').Config} */
module.exports = {
  // Update content paths to scan inside your src folder
  content: ["./src/app/**/*.{js,jsx,ts,tsx}", "./src/components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}
