// Tailwind v4 through PostCSS. Production builds use webpack (see the build
// script), which runs PostCSS in-process; Turbopack (dev) reads this too.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
