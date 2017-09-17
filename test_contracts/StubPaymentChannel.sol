pragma solidity ^0.4.2;

contract StubPaymentChannel{
  enum ChannelState { Open, Settling, Settled }

  struct PaymentChannel
  {
    address sender ;
    address broadcaster ;

  }

  event DidCreateChannel(address indexed viewer,
                         address indexed broadcaster,
                         bytes32 channelId);

  event DidDeposit(bytes32 indexed channelId,
                   uint256 amount);

  event DidStartSettle(bytes32 indexed channelId,
                       uint256 payment);

  event DidSettle(bytes32 channelId,
                  uint256 payment,
                  uint256 challengedPayment);

  event DidChannelClose(bytes32 channelId);


  /*function StubPaymentChannel() {

  }*/

  function createChannel(address broadcaster, bytes32 channelId)
  public payable{

    // Logic of channel Id saving .

    // Trigger create channel event .
    DidCreateChannel(msg.sender, broadcaster, channelId);
  }

  function deposit(bytes32 channelId) public payable{
    // Logic of Deposit here

    // Trigger the event DidDeposit.
    DidDeposit(channelId, msg.value) ;
  }

  function startSettle(bytes32 channelId, uint256 payment) public payable{

    // Logic for startSettle goes here .

    // Trigger the event DidSettle.
    DidStartSettle(channelId, payment);
  }

  function settle(bytes32 channelId , uint256 payment, uint256 challengedPayment) public payable{

    // Logic for settle .

    // Trigger the event DidSettle
    DidSettle(channelId, payment, challengedPayment);
  }

  function close(bytes32 channelId)
  {
    // Logic closing .

    DidChannelClose(channelId);
  }

}
