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
  experimental: {
    // The recap cover picker shells out to the bundled ffmpeg binary, which
    // Next's file tracing can't see through @ffmpeg-installer's dynamic require.
    outputFileTracingIncludes: {
      "/api/slack/recap/build": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    },
  },
  async rewrites() {
    return [
      // Athlete order forms: /order/<slug> serves the static page in
      // public/order-forms/<slug>/. No login — middleware doesn't match these.
      { source: "/order/:slug", destination: "/order-forms/:slug/index.html" },
    ];
  },
};

module.exports = nextConfig;
