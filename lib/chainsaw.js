const Web3 = require('web3');
const config = require('./configuration');
const WebHooks = require('node-webhooks');
const Promise = require('bluebird');
const jsonfile = require('jsonfile');
const webhookFile = './webhooks/data.json';
const requestify = require('requestify');

// Set provider .
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// Test Contract address
// Replace the contract address by the deployed contract address .
const contractAddress = '0xfe1fd859ecab153ffa1d3d9e1eb864c528c8aa1b';

// Get the contract object
let stubContract = config.contractObject();

// Get the deployed subContract
let deployedStubContract = stubContract.at(contractAddress);

const allEvents = () => {
  // Lets watch all events for testing .
  let allEvents = deployedStubContract.allEvents();
  allEvents.watch(function(error, event) {
    if (!error)
      console.log(event);
  });
}

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
      jsonfile.readFile(webhookFile, function(err, obj) {
        // Get the array of webhoooks
        let hooks = obj['DidDeposit'];

        for (let i = 0; i < hooks.length; i++) {
          requestify.post(hooks[i], event)
            .then(function(response) {
              // Get the response body
              console.log(response.getBody());
            });
        }
      });

    }
  });
};


const didStartSettleEvent = (channelId = "") => {

  // Avoid this repeation of the code .
  let startSettleEvent;
  if (channelId == "")
    startSettleEvent = deployedStubContract.DidDeposit();
  else
    startSettleEvent = deployedStubContract.DidDeposit({
      channelId: channelId
    });

  startSettleEvent.watch(function(error, event) {
    if (!error) {
      jsonfile.readFile(webhookFile, function(err, obj) {
        // Get the array of webhoooks
        let hooks = obj['didStartSettle'];

        for (let i = 0; i < hooks.length; i++) {
          requestify.post(hooks[i], event)
            .then(function(response) {
              // Get the response body
              console.log(response.getBody());
            });
        }
      });

    }
  });
}

const didSettleEvent = (channelId) => {

  // Avoid this repeation of the code .
  let settleEvent;
  if (channelId == "")
    settleEvent = deployedStubContract.DidDeposit();
  else
    settleEvent = deployedStubContract.DidDeposit({
      channelId: channelId
    });


  settleEvent.watch(function(error, event) {
    if (!error) {
      jsonfile.readFile(webhookFile, function(err, obj) {
        // Get the array of webhoooks
        let hooks = obj['didSettle'];

        for (let i = 0; i < hooks.length; i++) {
          requestify.post(hooks[i], event)
            .then(function(response) {
              // Get the response body
              console.log(response.getBody());
            });
        }
      });

    }
  });
}

module.exports = {
  allEvents: allEvents,
  didDepositEvent: didDepositEvent,
  didStartSettleEvent: didStartSettleEvent,
  didSettleEvent: didSettleEvent
}