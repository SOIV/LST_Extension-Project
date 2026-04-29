import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 로컬 네트워크에서 개발 서버 접근 허용
  allowedDevOrigins: ["175.124.37.211"],
};

export default withNextIntl(nextConfig);
