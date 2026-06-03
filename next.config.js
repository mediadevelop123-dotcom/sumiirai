/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Bedrock SDK は Node.js ランタイム専用モジュールを含むため外部化 (Next.js 14)
    serverComponentsExternalPackages: ['@aws-sdk/client-bedrock-runtime'],
  },
}

module.exports = nextConfig
