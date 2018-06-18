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
  describe('Function: finalizeProposal', () => {
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

    it('should not allow unlisted voters to finalize proposals', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });

      try {
        await dp.finalizeProposal(propID, { from: alice });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'an unlisted voter was able to finalize a proposal');
    });

    it('should allow listed voters to finalize proposals', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });
      await dp.finalizeProposal(propID, { from: bob });
    });

    it('should not finalize a proposal which does not exist', async () => {
      try {
        await dp.finalizeProposal(2666, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'a proposal was finalized which does not exist');
    });

    it('should not finalize a proposal whose voting period has not ended', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      try {
        await dp.finalizeProposal(propID, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'a proposal was finalized before its voting period ended');
    });

    it('should properly set state if a proposal is finalized which was accepted', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });
      await dp.finalizeProposal(propID, { from: bob });

      const storedX = await dp.get.call('x');
      assert.strictEqual(storedX.toString(10), '420', 'a finalized proposal which was ' +
        'accepted did not seem to update contract state');
    });

    it('should not alter state if a proposal is finalized which was rejected', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await dp.vote(propID, 0, { from: bob });
      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });
      await dp.finalizeProposal(propID, { from: bob });

      const storedX = await dp.get.call('x');
      assert.strictEqual(storedX.toString(10), '0', 'a finalized proposal which was ' +
        'rejected somehow altered contract state');
    });

    it('should not alter state if a proposal is finalized after its processBy date', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await rpc.sendAsync({ method: 'evm_increaseTime', params: [2001] });
      await dp.finalizeProposal(propID, { from: bob });

      const storedX = await dp.get.call('x');
      assert.strictEqual(storedX.toString(10), '0', 'a finalized proposal which was ' +
        'processed after its processBy date somehow altered contract state');
    });
  });
});

