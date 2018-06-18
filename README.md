# Democratic Parameterizer

A parameterizer that relies on a whitelist of voters who can make and vote on proposals to the parameterizer. Voting is in the clear and single stage. The only requirement of the voter whitelist is that it implement the interface `isWhitelisted(bytes32) returns (bool)`. A TCR satisfies this interface, for example.

The parameterizer has one self-referential parameter which should not be overwritten for other purposes: `parameterizerVotingPeriod`, which is the period after a proposal is made during which it can be voted on. After the voting period ends, `finalizeProposal` can be called to either set or delete the proposal depending on the result.

## Initialize
The only environmental dependency you need is Node. Presently we can guarantee this all works with Node 8.
```
npm install
npm run compile
```

## Tests
The repo has a comprehensive test suite. You can run it with `npm run test`.

## Composition of the repo
The repo is composed as a Truffle project, and is largely idiomatic to Truffle's conventions. The tests are in the `test` directory, the contracts are in the `contracts` directory and the migrations (deployment scripts) are in the `migrations` directory.

## Deploying your own DemocraticParameterizer 
The `package.json` includes scripts for deploying to rinkeby and mainnet. Modify `truffle.js` and `package.json` if you need other networks. You'll need a `secrets.json` file with a funded mnemonic on the `m/44'/60'/0'/0/0` HD path in the root of the repo to deploy. Your `secrets.json` should look like this:

```json
{
  "mnemonic": "my good mnemonic ..."
}
```

If you prefer to use an environment variable, your `.bashrc` or `.bash_profile` should look something like:

```bash
export MNEMONIC='my good mnemonic ...'
```

You can use [https://iancoleman.io/bip39/](https://iancoleman.io/bip39/) to generate a mnemonic and derive its `m/44'/60'/0'/0/0` address.

