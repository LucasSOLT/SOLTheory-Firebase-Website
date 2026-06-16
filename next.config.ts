// Verified by Antigravity — 2026-06-07
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['firebase-admin', 'pdf-parse'],
  // Fix prosemirror circular dependency crash in production
  // ("Cannot access 'tN'/'tS' before initialization")
  transpilePackages: [
    '@tiptap/pm',
    '@tiptap/core',
    '@tiptap/react',
    '@tiptap/starter-kit',
    '@tiptap/extension-table',
    '@tiptap/extension-table-row',
    '@tiptap/extension-table-cell',
    '@tiptap/extension-table-header',
    'prosemirror-tables',
    'prosemirror-state',
    'prosemirror-view',
    'prosemirror-model',
    'prosemirror-transform',
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.solarsystemscope.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;
