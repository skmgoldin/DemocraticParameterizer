pragma solidity ^0.4.20;

import "./VoterListInterface.sol";
import "zeppelin/math/SafeMath.sol";

contract DemocraticParameterizer {

  using SafeMath for uint;

  event initialized(VoterListInterface voterList, bytes32 kludge);
  event newProposal(string param, uint value, bytes32 propID, uint votingEndTime,
                                   uint processBy, address proposer);
  event voteCast(address voter, bytes32 propID, uint faction, uint votesFor, uint votesAgainst);
  event proposalProcessed(bytes32 propID, bool passed);

  struct Proposal {
    string name;
    uint value;
    uint votingEndTime;
    uint processBy;
    uint votesFor;
    uint votesAgainst;
  }

  mapping(bytes32 => uint) public params;
  mapping(bytes32 => Proposal) public proposals;

  VoterListInterface public voterList;

  modifier onlyListedVoters(address _caller) {
    require(voterList.isWhitelisted(keccak256(abi.encodePacked(_caller))));
    _;
  }

  /// @dev initialize the contract
  /// @param _voterList some contract with an `isWhitelisted` method that accepts a single
  /// bytes32 argument and returns a boolean.
  /// @param _parameterizerVotingPeriod an initial parameterization on this contract's only
  /// self-referential parameter.
  function init(address _voterList, uint _parameterizerVotingPeriod,
                bytes32[] _params, uint[] _paramValues) public {
    require(_voterList != 0 && address(voterList) == 0);
    require(_params.length == _paramValues.length);

    voterList = VoterListInterface(_voterList);
    set("parameterizerVotingPeriod", _parameterizerVotingPeriod);

    for(uint i = 0; i < _params.length; i++) {
      params[_params[i]] = _paramValues[i]; 
    }

    emit initialized(voterList, _params[0]);
  }

  /// @dev propose a reparamaterization of a named key's value.
  /// @param _name the name of the key to be reparameterized
  /// @param _value the proposed value to set under the given key
  function proposeReparameterization(string _name, uint _value)
  public onlyListedVoters(msg.sender) returns (bytes32 propID) {
    propID = keccak256(abi.encodePacked(_name, _value));
    Proposal storage prop = proposals[propID];

    require(!propExists(prop)); // Forbid duplicate proposals
    require(get(_name) != _value); // Forbid NOOP reparameterizations

    // Add the proposal to the proposals mapping
    proposals[propID] = Proposal({
        name: _name,
        value: _value,
        // Votes cannot be cast after the votingEndTime date
        votingEndTime: now.add(get("parameterizerVotingPeriod")),
        // The proposal cannot be processed after the processBy date
        processBy: now.add(get("parameterizerVotingPeriod").mul(2)),
        votesFor: 0,
        votesAgainst: 0
    });

    emit newProposal(_name, _value, propID, proposals[propID].votingEndTime,
                                      proposals[propID].processBy, msg.sender);
  }

  /// @dev cast a vote for or against a proposal
  /// @param _propID the proposal to cast a vote for
  /// @param _faction the faction to cast a vote in. 0 to oppose the proposal, 1 to support it.
  function vote(bytes32 _propID, uint _faction) public onlyListedVoters(msg.sender) {
    Proposal storage prop = proposals[_propID];

    // The proposal must exist, and its voting period must be active.
    require(propExists(prop));
    require(now < prop.votingEndTime);

    // Tally the user's vote
    if(_faction == 0) {
      prop.votesAgainst++;
    } else if(_faction == 1) {
      prop.votesFor++;
    } else {
      revert("Vote must be either against (0) or for (1) the proposal");
    }

    emit voteCast(msg.sender, _propID, _faction, prop.votesFor, prop.votesAgainst);
  }

  /// @dev finalize a proposal following its voting stage. Will result in the proposal being
  /// deleted, and may result in an update to the params mapping if the proposal passed.
  /// @param _propID the proposal to finalize
  function finalizeProposal(bytes32 _propID) public onlyListedVoters(msg.sender) {
    Proposal storage prop = proposals[_propID];

    // The propsal must exist, and its voting period must have ended.
    require(propExists(prop));
    require(prop.votingEndTime < now);

    // If the processBy date has passed, or the proposal was defeated in voting, delete it.
    // Else, (the processBy date has not passed and the proposal won in voting), set the new
    // parameterization and then delete the proposal.
    if(prop.processBy < now || prop.votesFor < prop.votesAgainst) {
      delete proposals[_propID];
      emit proposalProcessed(_propID, false);
    } else {
      set(prop.name, prop.value);
      delete proposals[_propID];
      emit proposalProcessed(_propID, true);
    }
  }

  /// @dev Determines whether a proposal in storage was ever initialized
  /// @param _prop The proposal whose existance is to be determined
  function propExists(Proposal storage _prop) view internal returns (bool) {
      return _prop.processBy > 0;
  }

  /// @notice gets the parameter keyed by the provided name value from the params mapping
  /// @param _name the key whose value is to be determined
  function get(string _name) public view returns (uint) {
      return params[keccak256(abi.encodePacked(_name))];
  }

  /// @dev sets the param keted by the provided name to the provided value
  /// @param _name the name of the param to be set
  /// @param _value the value to set the param to be set
  function set(string _name, uint _value) private {
    params[keccak256(abi.encodePacked(_name))] = _value;
  }
}

