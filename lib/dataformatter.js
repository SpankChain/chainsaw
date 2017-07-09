const eventToChannel = (eventData) => {
  channelTemp = {
    channelId: "",
    sender: "",
    receiver: "",
    price: 0,
    value: 0,
    channelValue: "",
    nonce: "",
    v: 27,
    r: "",
    s: ""
  };

  if (eventData.event == "DidDeposit") {
    channelTemp.channelId = eventData.args.channelId;
    channelTemp.channelValue = eventData.args.value;
  } else if (eventData.event == "DidStartSettle") {
    channelTemp.channelId = eventData.args.channelId;
    channelTemp.value = eventData.args.payment;
    channelTemp.price = -1;
  }

  return channelTemp;
}

module.exports = {
  eventToChannel: eventToChannel
}