import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Hiragino Kaku Gothic ProN',
          'Hiragino Sans',
          'Noto Sans JP',
          'Meiryo',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        // ブランドカラー（落ち着いた信頼感のあるインディゴブルー）
        brand: {
          50:  '#eef3ff',
          100: '#dce5ff',
          200: '#c0d0ff',
          300: '#97b0ff',
          400: '#6b85fb',
          500: '#475ef0',
          600: '#3344db',
          700: '#2a36b8',
          800: '#262f94',
          900: '#252e75',
        },
        // ニュートラル（わずかに青みのあるスレートグレー）
        ink: {
          50:  '#f7f8fa',
          100: '#eef0f4',
          200: '#dde1e9',
          300: '#c3cad6',
          400: '#9aa3b5',
          500: '#6f7891',
          600: '#535b73',
          700: '#3d4459',
          800: '#272c3d',
          900: '#181c29',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(24,28,41,0.04), 0 1px 8px rgba(24,28,41,0.04)',
        'card-hover': '0 2px 4px rgba(24,28,41,0.06), 0 6px 20px rgba(24,28,41,0.08)',
        panel: '0 1px 3px rgba(24,28,41,0.05)',
      },
    },
  },
  plugins: [],
}
export default config
