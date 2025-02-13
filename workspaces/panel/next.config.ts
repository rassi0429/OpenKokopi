import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    'rc-util',
    "rc-motion",
    "rc-picker"
  ]
};

export default nextConfig;
