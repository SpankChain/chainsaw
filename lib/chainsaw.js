//const Web3 = require('web3');
const config = require('./configuration');
const WebHooks = require('node-webhooks');
const Promise = require('bluebird');
const jsonfile = require('jsonfile');
const webhookFile = './webhooks/data.json';
const requestify = require('requestify');

// Set provider .
const web3 = config.web3; //new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// Test Contract address
// Replace the contract address by the deployed contract address .
const contractAddress = '0x67d89519764565a4cdb9170ed423515e36ac6ebf';

// Get the contract object
let stubContract = config.contractObject();

// Get the deployed subContract
let deployedStubContract = stubContract.at(contractAddress);

const readAndCallHook = (contractEvent, eventData) => {
  jsonfile.readFile(webhookFile, function(err, obj) {
    // Get the array of webhoooks

    let hooks;

    switch (contractEvent) {
      case 'DidDeposit':
        hooks = obj['DidDeposit']
        break;
      case 'DidSettle':
        hooks = obj['DidSettle']
        break;
      case 'DidStartSettle':
        hooks = obj['DidStartSettle']
        break;
      case 'DidCreateChannel':
        hooks = obj['DidCreateChannel']
        break;
      case 'DidChannelClose':
        hooks = obj['DidChannelClose'];
        break;
      default:
        break;

    }

    if (hooks !== undefined)
      for (let i = 0; i < hooks.length; i++) {
        requestify.post(hooks[i], eventData)
          .then(function(response) {
            // Get the response body
            console.log(response.getBody());
          });
      }
  });
}

const allEvents = () => {
  // Lets watch all events for testing .
  let allEvents = deployedStubContract.allEvents();
  allEvents.watch(function(error, event) {
    if (!error)
      console.log(event);
  });
}

const didCreateChannelEvent = (channelId = "") => {

  let createChannelEvent;

  if (channelId == "")
    createChannelEvent = deployedStubContract.DidCreateChannel();
  else
    createChannelEvent = deployedStubContract.DidCreateChannel({
      channelId: channelId
    });

  createChannelEvent.watch(function(error, event) {

    if (!error) {
      readAndCallHook("DidCreateChannel", event);
    } {
      console.log(error);
    }
  });
};

const didDepositEvent = (channelId = "") => {

  let depositEvent;

  if (channelId == "")
    depositEvent = deployedStubContract.DidDeposit();
  else
    depositEvent = deployedStubContract.DidDeposit({
      channelId: channelId
    });

  depositEvent.watch(function(error, event) {

    if (!error) {
      readAndCallHook('DidDeposit', event);
    } {
      console.log(error);
    }
  });
};


const didStartSettleEvent = (channelId = "") => {

  // Avoid this repeation of the code .
  let startSettleEvent;
  if (channelId == "")
    startSettleEvent = deployedStubContract.DidStartSettle();
  else
    startSettleEvent = deployedStubContract.DidStartSettle({
      channelId: channelId
    });

  startSettleEvent.watch(function(error, event) {
    if (!error) {
      readAndCallHook('DidStartSettle', event);
    }
  });
}

const didSettleEvent = (channelId) => {

  // Avoid this repeation of the code .
  let settleEvent;
  if (channelId == "")
    settleEvent = deployedStubContract.DidSettle();
  else
    settleEvent = deployedStubContract.DidSettle({
      channelId: channelId
    });

  settleEvent.watch(function(error, event) {
    if (!error) {
      readAndCallHook('DidSettle', event);
    }
  });
}

const didCloseEvent = (channelId) => {

  // Avoid this repeation of the code .
  let closeEvent;
  if (channelId == "")
    closeEvent = deployedStubContract.DidChannelClose();
  else
    closeEvent = deployedStubContract.DidChannelClose({
      channelId: channelId
    });


  closeEvent.watch(function(error, event) {
    if (!error) {
      readAndCallHook("DidChannelClose", event);
    }
  });
}

module.exports = {
  allEvents: allEvents,
  didDepositEvent: didDepositEvent,
  didStartSettleEvent: didStartSettleEvent,
  didSettleEvent: didSettleEvent,
  didCreateChannelEvent: didCreateChannelEvent,
  didCloseEvent: didCloseEvent
}