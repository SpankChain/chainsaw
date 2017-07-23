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
    s: "",
    event:""
  };

  if (eventData.event == "DidDeposit") {
    channelTemp.channelId = eventData.args.channelId;
    channelTemp.channelValue = eventData.args.value;
    channelTemp.event ="DidDeposit"
  } else if (eventData.event == "DidStartSettle") {
    channelTemp.channelId = eventData.args.channelId;
    channelTemp.value = eventData.args.payment;
    channelTemp.price = -1;
    channelTemp.event ="DidStartSettle"
  }
  else{
    return eventData;
  }

  return channelTemp;
}

module.exports = {
  eventToChannel: eventToChannel
}
