/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,

  // uncomment for development
  async rewrites() {
    return [
      {
        source: '/cgi-bin/:path*',
        destination: 'http://192.168.228.1/cgi-bin/:path*',
        basePath: false,
      },
    ];
  }
};

export default nextConfig;
