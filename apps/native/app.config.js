// A versão do app vem só do package.json. O runtimeVersion do EAS Update acompanha,
// então aumente a versão sempre que mudar algo nativo.
const { version } = require("./package.json");

module.exports = ({ config }) => ({ ...config, version });
