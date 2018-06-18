pragma solidity ^0.4.20;

import "plcr-revival/ProxyFactory.sol";
import "./DemocraticParameterizer.sol";

contract DemocraticParameterizerFactory {

  event newDemocraticParameterizer(address creator, address democraticParameterizer,
                                   address voterList);

  ProxyFactory public proxyFactory;
  DemocraticParameterizer public canonizedDemocraticParameterizer;

  /// @dev constructor deploys a new canonical DemocraticParameterizer contract and a
  /// proxyFactory.
  constructor() {
    canonizedDemocraticParameterizer = new DemocraticParameterizer();
    proxyFactory = new ProxyFactory();
  }

  /// @dev deploys and initializes a new DemocraticParameterizerVoting contract that consumes a
  /// voting list and an initial parameterizer voting period.
  /// @param _voterList some contract with an `isWhitelisted` method that accepts a single
  /// bytes32 argument and returns a boolean.
  /// @param _parameterizerVotingPeriod an initial parameterization on this contract's only
  /// self-referential parameter.
  function createDemocraticParameterizer(address _voterList, uint _parameterizerVotingPeriod,
                                         bytes32[] params, uint[] paramValues)
  public returns (DemocraticParameterizer dp) {
    dp = DemocraticParameterizer(proxyFactory.createProxy(canonizedDemocraticParameterizer, ""));
    dp.init(_voterList, _parameterizerVotingPeriod, params, paramValues);

    emit newDemocraticParameterizer(msg.sender, address(dp), _voterList);
  }
}

