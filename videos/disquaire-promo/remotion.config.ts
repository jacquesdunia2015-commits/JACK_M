/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);
// Chromium managé par Remotion indisponible au téléchargement dans cet
// environnement (hôte non autorisé) : on réutilise le Chromium préinstallé.
Config.setBrowserExecutable("/opt/pw-browsers/chromium");
Config.setChromiumOpenGlRenderer("angle");
Config.setChromeMode("chrome-for-testing");

