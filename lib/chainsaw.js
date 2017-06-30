const Web3 = require('web3');
const config = require('./configuration');
const WebHooks = require('node-webhooks');

// Set provider .
const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));

// WebHooks
const webHooks = new WebHooks({
    db: './webHooksDB.json', // json file that store webhook URLs
    httpSuccessCodes: [200, 201, 202, 203, 204], //optional success http status codes
});

// Test Contract address
const contractAddress = '0xfb9491bb6e232953c245fabbd88ab3be8d5158a2';

// Get the contract object
let stubContract = config.contractObject();

// Get the deployed subContract
let deployedStubContract = subContract.at(contractAddress);
