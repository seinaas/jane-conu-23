/** @type {import('next').NextConfig} */
const removeImports = require('next-remove-imports')();

const nextConfig = removeImports({
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
  },
});

module.exports = nextConfig;
