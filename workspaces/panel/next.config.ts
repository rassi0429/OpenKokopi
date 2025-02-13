import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    'rc-util',
    "rc-picker"
  ]
};

export default nextConfig;
