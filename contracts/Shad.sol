pragma solidity 0.4.15;

contract Shad {
 address public addr;
 event ShadEvent(address sha);
 event DeployEvent(address shad);

 function Shad(){
     DeployEvent(address(this));
 }

 function process(uint tokenBidPriceInWei, uint bidWeiAmount, uint8 v, bytes32 r, bytes32 s) {
    var bidHash = sha3(address(this), tokenBidPriceInWei, bidWeiAmount);
    addr = ecrecover(bidHash, v, r, s);
    ShadEvent(addr);
 }
}
