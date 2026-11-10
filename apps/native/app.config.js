// A versão do app vem só do package.json. O runtimeVersion do EAS Update acompanha,
// então aumente a versão sempre que mudar algo nativo.
const { version } = require("./package.json");

// OTA_RUNTIME publica para builds já instalados de uma versão anterior.
module.exports = ({ config }) => ({
  ...config,
  version,
  ...(process.env.OTA_RUNTIME ? { runtimeVersion: process.env.OTA_RUNTIME } : {}),
});
