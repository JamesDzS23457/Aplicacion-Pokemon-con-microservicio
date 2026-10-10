/** @type {import('expo/metro-config').MetroConfig} */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite en web (alpha) necesita wasm
config.resolver.assetExts.push('wasm');

module.exports = config;