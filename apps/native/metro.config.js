const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Modelos ExecuTorch (.pte) e tokenizers (.bin) empacotados como asset local.
// Só é necessário se um modelo for embutido via require(); modelos remotos (o padrão aqui) não dependem disto.
config.resolver.assetExts.push("pte", "bin");

module.exports = config;
