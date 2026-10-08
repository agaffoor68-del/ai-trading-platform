/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy all API/WS calls to FastAPI backend (avoids CORS in dev).
    const api = process.env.API_URL || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/auth/:path*", destination: `${api}/auth/:path*` },
      { source: "/ws/:path*", destination: `${api}/ws/:path*` },
    ];
  },
};

export default nextConfig;
