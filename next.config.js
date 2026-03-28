/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["dockerode", "@prisma/client", "prisma"],
    instrumentationHook: true,
  },
};
  
  module.exports = nextConfig;