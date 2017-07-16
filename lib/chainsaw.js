//const Web3 = require('web3');
const configuration = require('./configuration');
const WebHooks = require('node-webhooks');
const Promise = require('bluebird');
const jsonfile = require('jsonfile');
const webhookFile = './webhooks/data.json';
const requestify = require('requestify');
const config = require('../config.json');
const formater = require('./dataformatter.js');
const db = configuration.db ;

// Set provider .
const web3 = configuration.web3;//new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// Test Contract address
// Replace the contract address by the deployed contract address .
const contractAddress = config.CONTRACT_ADDRESS;

// Get the contract object
let contract = configuration.contractObject();

// Get the deployed subContract
let deployedContract = contract.at(contractAddress);

const getLogsByBlockNumber = (blockNumber, callback) => {

  let logs = [];
  web3.eth.getBlock(blockNumber, function(err, block){
    if(!err)
    {
      transactions = block['transactions'];
      for(let i = 0 ; i < transactions.length; i++ ){
        receipt = web3.eth.getTransactionReceipt(transactions[i]);
        logs.push(receipt['logs']) ;
        callback(null, logs);
      }
  }
  });
}

const init = () => {
  // 1 . Read the last block the channel events .
   db.events.find().sort({$natural:-1}).limit(1, function(err, block){
    let currentBlock = web3.eth.blockNumber ;
    let lastSavedBlock = block[0]['blockNumber'];

    // Read the logs for event state from blockchain
    // Save them to our database .
    for (let i = lastSavedBlock +1 ; i <= currentBlock ; i++){
      getLogsByBlockNumber(i, function(error, logs){
        //Now logs are returned for that particular block is returned
        console.log("Logs :: ", i);
        console.log(logs);
        let topics  = logs['topics'];
        console.log(topics);

      });
    }

   });
}

const saveAndCallHook = (contractEvent, eventData) => {
  jsonfile.readFile(webhookFile, function(err, obj) {
    // Get the array of webhoooks
    let hooks ;

    switch(contractEvent){
      case 'DidDeposit':
        hooks = obj['DidDeposit']
        console.log("Event data");
        console.log(eventData);
        console.log(formater.eventToChannel(eventData))
        break;
      case 'DidSettle':
        hooks = obj['DidSettle']
        break;
      case 'DidStartSettle':
        hooks = obj['DidStartSettle']
        console.log(formater.eventToChannel(eventData))
        break;
      case 'DidCreateChannel':
        hooks = obj['DidCreateChannel']
        break;
      case 'DidChannelClose':
        hooks = obj['DidChannelClose'] ;
        break;
      case 'HubChannelUpdate':
        hooks = obj['HubChannelUpdate'] ;
        break;
      default:
        break;

    }

    // Save all events in the mongojs .
    db.events.insert(eventData);



    if(hooks !== undefined )
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
  let allEvents = deployedContract.allEvents();
  allEvents.watch(function(error, event) {
    if (!error)
      console.log(event);
  });
}

const didCreateChannelEvent = (channelId = "") => {

  let createChannelEvent;
  console.log("Watching Did create channel events")

  if (channelId == "")
    createChannelEvent = deployedContract.DidCreateChannel();
  else
    createChannelEvent = deployedContract.DidCreateChannel({
      channelId: channelId
    });

  createChannelEvent.watch(function(error, event) {

    if (!error) {
      saveAndCallHook("DidCreateChannel", event);
    } {
      console.log(error);
    }
  });
};

const didDepositEvent = (channelId = "") => {

  let depositEvent;

  if (channelId == "")
    depositEvent = deployedContract.DidDeposit();
  else
    depositEvent = deployedContract.DidDeposit({
      channelId: channelId
    });

  depositEvent.watch(function(error, event) {

    if (!error) {
      saveAndCallHook('DidDeposit', event);
    } {
      console.log(error);
    }
  });
};


const didStartSettleEvent = (channelId = "") => {

  // Avoid this repeation of the code .
  let startSettleEvent;
  if (channelId == "")
    startSettleEvent = deployedContract.DidStartSettle();
  else
    startSettleEvent = deployedContract.DidStartSettle({
      channelId: channelId
    });

  startSettleEvent.watch(function(error, event) {
    if (!error) {
      // Call hooks that have registered
      saveAndCallHook('DidStartSettle', event);
    }
  });
}

const didSettleEvent = (channelId= "") => {

  // Avoid this repeation of the code .
  let settleEvent;
  if (channelId == "")
    settleEvent = deployedContract.DidSettle();
  else
    settleEvent = deployedContract.DidSettle({
      channelId: channelId
    });

  settleEvent.watch(function(error, event) {
    if (!error) {
      saveAndCallHook('DidSettle', event);
    }
  });
}

const didCloseEvent = (channelId) => {

  // // Avoid this repeation of the code .
  // let closeEvent;
  // if (channelId == "")
  //   closeEvent = deployedStubContract.DidChannelClose();
  // else
  //   closeEvent = deployedStubContract.DidChannelClose({
  //     channelId: channelId
  //   });
  //
  //
  // closeEvent.watch(function(error, event) {
  //   if (!error) {
  //     saveAndCallHook("DidChannelClose", event);
  //   }
  // });
}

// Watch All Events anyway
// Decoupling hooks from watching the events .

const watchEvents = () => {
  didCreateChannelEvent();
  didDepositEvent();
  didStartSettleEvent();
  didSettleEvent();
}

watchEvents() ;

module.exports = {
  allEvents: allEvents,
  didDepositEvent: didDepositEvent,
  didStartSettleEvent: didStartSettleEvent,
  didSettleEvent: didSettleEvent,
  didCreateChannelEvent : didCreateChannelEvent,
  didCloseEvent: didCloseEvent,
  init: init,
  saveAndCallHook:saveAndCallHook
}
