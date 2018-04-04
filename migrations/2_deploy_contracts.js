var LibraToken = artifacts.require("./LibraToken.sol");
var LibraTokenVault = artifacts.require("./LibraTokenVault.sol");

module.exports = function (deployer) {
    deployer.deploy(LibraToken).then(function () {
        return deployer.deploy(LibraTokenVault, LibraToken.address);
    });
};
