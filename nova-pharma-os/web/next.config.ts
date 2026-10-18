import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // L'URL de l'API n'est jamais exposée au navigateur : toutes les
  // requêtes passent par le serveur Next, qui seul détient le jeton.
  env: {},
  poweredByHeader: false,
};

export default config;
