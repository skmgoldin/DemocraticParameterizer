pragma solidity ^0.4.20;

contract VoterListInterface {
  function isWhitelisted(bytes32 _voter) public view returns (bool);
}

