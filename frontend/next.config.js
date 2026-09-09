/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Proxies /api/* to the backend so cookies (session) work same-origin
    // in dev without fiddling with CORS/SameSite settings.
    return [
      { source: "/api/:path*", destination: "http://localhost:4000/api/:path*" },
    ];
  },
};
module.exports = nextConfig;