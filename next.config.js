/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
      serverComponentsExternalPackages: ["dockerode", "@prisma/client", "prisma"],
    },
  };
  
  module.exports = nextConfig;