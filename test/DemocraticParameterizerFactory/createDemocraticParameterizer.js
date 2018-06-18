/* eslint-env mocha */
/* global contract assert artifacts */

const DemocraticParameterizerFactory = artifacts.require('./DemocraticParameterizerFactory.sol');
const DemocraticParameterizer = artifacts.require('./DemocraticParameterizer.sol');

const web3 = require('web3');

const solkeccak = web3.utils.soliditySha3;

contract('DemocraticParameterizerFactory', () => {
  describe('Function: createDemocraticParameterizer', () => {
    let dpf;

    beforeEach(async () => {
      dpf = await DemocraticParameterizerFactory.deployed();
    });

    it('should deploy and initialize a new DemocraticParameterizer contract', async () => {
      const voterList = '2666';
      const parameterizerVotingPeriod = '420';

      const receipt =
        await dpf.createDemocraticParameterizer(voterList, parameterizerVotingPeriod, [0], [0]);

      const dp = DemocraticParameterizer.at(receipt.logs[0].args.democraticParameterizer);

      assert.strictEqual(
        parseInt((await dp.voterList.call()), 16).toString(10),
        voterList,
        'The parameterizer voterList was not initialized properly',
      );

      assert.strictEqual(
        (await dp.get.call('parameterizerVotingPeriod')).toString(10),
        parameterizerVotingPeriod,
        'The parameterizerVotingPeriod was not initialized properly',
      );
    });

    it(
      'should correctly initialize the DemocraticParameterizer when param arrays are provided',
      async () => {
        const happyNumber = solkeccak('happyNumber');
        const devilNumber = solkeccak('devilNumber');

        const receipt =
          await dpf.createDemocraticParameterizer(1, 1, [happyNumber, devilNumber], [420, 666]);

        const dp = DemocraticParameterizer.at(receipt.logs[0].args.democraticParameterizer);

        assert.strictEqual(
          (await dp.get.call('happyNumber')).toString(10),
          '420',
          'A parameter in a param array was not initialized properly',
        );

        assert.strictEqual(
          (await dp.get.call('devilNumber')).toString(10),
          '666',
          'A parameter in a param array was not initialized properly',
        );
      },
    );
  });
});

