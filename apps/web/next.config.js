/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["127.0.0.1"],
  logging: {
    incomingRequests: {
      // Confirmation links carry a single-use token in the query string.
      // Next logs request URLs in development, so this path must never be logged.
      ignore: [/^\/auth\/confirm(?:\?|$)/],
    },
  },
};

export default nextConfig;
