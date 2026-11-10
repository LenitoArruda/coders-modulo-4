/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  logging: {
    incomingRequests: {
      // Confirmation and reset links carry a single-use token in the query
      // string. Next logs request URLs in development, so these paths must
      // never be logged.
      ignore: [/^\/auth\/(?:confirm|reset-password)(?:\?|$)/],
    },
  },
  async headers() {
    return [
      {
        // The reset link carries a single-use token: never send it in `Referer`.
        source: "/auth/reset-password",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
