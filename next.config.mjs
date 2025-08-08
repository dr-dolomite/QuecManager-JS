/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export",
  // images: { unoptimized: true },
  // trailingSlash: true,
  async rewrites() {
    return [
      {
        source: '/cgi-bin/:path*',
        destination: 'http://192.168.224.1/cgi-bin/:path*',
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
