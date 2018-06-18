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
  describe('Function: vote', () => {
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
        await dpFactory.createDemocraticParameterizer(
          registry.address,
          [solkeccak('parameterizerVotingPeriod')], [1000],
        );

      // Get the newly deployed democratic parameterizer instance
      dp = DemocraticParameterizer.at(dpFactoryReceipt.logs[0].args.democraticParameterizer);
    });

    it('should not allow listed voters to vote on reparameterizations', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;
      try {
        await dp.vote(propID, 1, { from: alice });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert.fail();
    });

    it('should allow listed voters to vote on reparameterizations', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      await dp.vote(propID, 1, { from: bob });
      await dp.vote(propID, 1, { from: charlie });
      const voteReceipt = await dp.vote(propID, 0, { from: dale });

      const votesFor = voteReceipt.logs[0].args.votesFor.toString(10);
      const votesAgainst = voteReceipt.logs[0].args.votesAgainst.toString(10);

      assert.strictEqual(votesFor, '2');
      assert.strictEqual(votesAgainst, '1');
    });

    it('should revert the proposal does not exist', async () => {
      try {
        await dp.vote(2666, 1, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'an vote was able to be cast for a proposal which does not exist');
    });

    it('should revert if the proposal voting period has ended', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      // Increase time past voting stage
      await rpc.sendAsync({ method: 'evm_increaseTime', params: [1001] });

      try {
        await dp.vote(propID, 1, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'a voter was able to vote after the voting period ended');
    });

    it('should revert if the user faction is neither 0 nor 1', async () => {
      const receipt = await dp.proposeReparameterization('x', 420, { from: bob });
      const { propID } = receipt.logs[0].args;

      try {
        await dp.vote(propID, 80, { from: bob });
      } catch (err) {
        assert(err.toString().includes('revert'), err.toString());

        return;
      }

      assert(false, 'a voter was able to vote in a non-existent faction');
    });
  });
});

