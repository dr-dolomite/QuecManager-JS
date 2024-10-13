/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://192.168.224.1/cgi-bin/:path*'
      }
    ]
  }
};

export default nextConfig;
