/* global artifacts */

const DemocraticParameterizerFactory = artifacts.require('./DemocraticParameterizerFactory.sol');

module.exports = function (deployer) {
  deployer.deploy(DemocraticParameterizerFactory);
};

