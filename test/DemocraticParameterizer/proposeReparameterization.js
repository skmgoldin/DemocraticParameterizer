/* eslint-env mocha */
/* global contract assert artifacts */

const DemocraticParameterizerFactory = artifacts.require('./DemocraticParameterizerFactory.sol');
const DemocraticParameterizer = artifacts.require('./DemocraticParameterizer.sol');
const RegistryFactory = artifacts.require('tcr/RegistryFactory.sol');
const Registry = artifacts.require('tcr/Registry.sol');
const EIP20 = artifacts.require('tokens/eip20/EIP20.sol');

const HttpProvider = require('ethjs-provider-http');
const EthRPC = require('ethjs-rpc');
const web3 = require('web3');

const rpc = new EthRPC(new HttpProvider('http://localhost:7545'));
const solkeccak = web3.utils.soliditySha3;

contract('DemocraticParameterizer', (accounts) => {
  describe('Function: proposeReparameterization', () => {
    const [alice, bob, charlie, dale] = accounts;

    let dpFactory;
    let registryFactory;
    let registry;
    let dp;
    let token;

    beforeEach(async () => {
      // Get the deployed dp and registry factories
      dpFactory = await DemocraticParameterizerFactory.deployed();
      registryFactory = await RegistryFactory.deployed();

      // Create a new registry and token
      const registryFactoryReceipt = await registryFactory.newRegistryWithToken(
        '1000000',
        'TestCoin',
        '0',
        'TEST',
        [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 60, 60, 50, 50],
        'The TestChain Registry',
      );

      // Get instances of the newly deployed registry and token
      token = EIP20.at(registryFactoryReceipt.logs[0].args.token);
      registry = Registry.at(registryFactoryReceipt.logs[0].args.registry);

      // Give tokens to all accounts, and have all accounts pre-approve the registry for
      // transfers
      await Promise.all(accounts.map(async (account) => {
        await token.transfer(account, 100000);
        await token.approve(registry.address, 100000);
      }));

      // Apply bob, charlie, and dale as voters
      await registry.apply(solkeccak(bob), 1000, '');
      await registry.apply(solkeccak(charlie), 1000, '');
      await registry.apply(solkeccak(dale), 1000, '');

      // Increase time past the apply stage
      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });

      // Bump the applicants into the registry
      await registry.updateStatus(solkeccak(bob));
      await registry.updateStatus(solkeccak(charlie));
      await registry.updateStatus(solkeccak(dale));

      // deploy a democratic parameterizer
      const dpFactoryReceipt =
        await dpFactory.createDemocraticParameterizer(registry.address, 1000, [0], [0]);

      // Get the newly deployed democratic parameterizer instance
      dp = DemocraticParameterizer.at(dpFactoryReceipt.logs[0].args.democraticParameterizer);
    });

    it('should not allow unlisted voters to propose reparameterizations', async () => {
      try {
        await dp.proposeReparameterization('x', 420, { from: alice });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert.fail();
    });

    it('should allow listed voters to propose reparameterizations', async () => {
      const receipt = await dp.proposeReparameterization('y', 840, { from: bob });
      const eventData = receipt.logs[0].args;

      assert.strictEqual(eventData.param, 'y');
      assert.strictEqual(eventData.value.toString(10), '840');

      const parameterizerVotingPeriod = await dp.get.call('parameterizerVotingPeriod');
      assert(eventData.processBy.eq(eventData.votingEndTime.plus(parameterizerVotingPeriod)));

      assert.strictEqual(eventData.propID, solkeccak('y', 840));
    });

    it('should not allow a proposal to overwrite an open proposal', async () => {
      await dp.proposeReparameterization('z', 29, { from: bob });
      try {
        await dp.proposeReparameterization('z', 29, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert.fail();
    });

    it('should not allow NOOP reparameterizations', async () => {
      const parameterizerVotingPeriod = await dp.get.call('parameterizerVotingPeriod');
      try {
        await dp.proposeReparameterization(
          'parameterizerVotingPeriod',
          parameterizerVotingPeriod, { from: bob },
        );
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert.fail();
    });
  });
});

