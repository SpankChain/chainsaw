var StubPaymentChannel = artifacts.require("./StubPaymentChannel.sol");

module.exports = function(deployer) {
  deployer.deploy(StubPaymentChannel);
};
