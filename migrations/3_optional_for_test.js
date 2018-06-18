/* global artifacts */

const DLL = artifacts.require('dll/DLL.sol');
const AttributeStore = artifacts.require('attrstore/AttributeStore.sol');
const PLCRFactory = artifacts.require('plcr-revival/PLCRFactory.sol');
const ParameterizerFactory = artifacts.require('tcr/ParameterizerFactory.sol');
const RegistryFactory = artifacts.require('tcr/RegistryFactory.sol');

module.exports = function (deployer, network) {
  if (network === 'test' || network === 'coverage') {
    deployer.deploy(DLL);
    deployer.deploy(AttributeStore);

    deployer.link(DLL, PLCRFactory);
    deployer.link(AttributeStore, PLCRFactory);

    return deployer.deploy(PLCRFactory)
      .then(() => deployer.deploy(ParameterizerFactory, PLCRFactory.address))
      .then(() => deployer.deploy(RegistryFactory, ParameterizerFactory.address));
  }

  return deployer;
};

