const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Alias react-dom to a shim — @clerk/clerk-react imports it for web portals
// which aren't needed in React Native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-dom': path.resolve(__dirname, 'shims/react-dom.js'),
};

module.exports = config;
