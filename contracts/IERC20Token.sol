pragma solidity ^0.4.16;

/*
    ERC20 Standard Token interface
*/
contract IERC20Token {
    // these functions aren't abstract since the compiler emits automatically generated getter functions as external
    function name() public constant returns (string n) { n; }
    function symbol() public constant returns (string s) { s; }
    function decimals() public constant returns (uint8 d) { d; }
    function totalSupply() public constant returns (uint256 t) { t; }
    function balanceOf(address _owner) public constant returns (uint256 b) { _owner; b; }
    function allowance(address _owner, address _spender) public constant returns (uint256 remaining) { _owner; _spender; remaining; }

    function transfer(address _to, uint256 _value) public returns (bool success);
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success);
    function approve(address _spender, uint256 _value) public returns (bool success);
}
