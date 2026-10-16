/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
        pathname: "/**",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      // Athlete order forms: /order/<slug> serves the shared engine page, which
      // loads public/order-forms/<slug>/campaign.json. No login — middleware doesn't match these.
      { source: "/order/:slug", destination: "/order-forms/_engine/index.html" },
    ];
  },
};

module.exports = nextConfig;
