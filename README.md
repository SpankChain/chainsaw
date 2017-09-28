# Chainsaw

Chainsaw is ethereum based log extracting and log decoding library with a periodic polling feature. 

## Usage of Chainsaw . 

### 1. Build Chainsaw : 

Run the below command in the chainsaw directory .

```
npm install eth-chainsaw
```

### 2. Importing the chainsaw :

For non babel transpiled es6 :

```javascript
const Chainsaw = require('eth-chainsaw').Chainsaw
```

if your server is a es6 babel transpiled file , import in the following way:

```javascript
import { Chainsaw } from 'eth-chainsaw'
```

### 3. Instantiating chainsaw, initializing with web3 provider and deployed contract address :

```javascript
const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
// web3 , list of contract address
const chainsaw = new Chainsaw(web3, [List of contract address])

// Add abi of your contracts to chainsaw,so chainsaw is able to decode the logs.
chainsaw.addABI(testContract.abi) 
```

### 4. Event callback and Turn On Chainsaw Polling : 

_Define event callback_ . 

```javascript
// Chainsaw event callback functions
const eventCallBack = (error, eventData) => {
  if (!error && eventData.length > 0) {
    console.log('Chainsaw eventCallBack', eventData)
  }
}
```

_Turn on Polling in the following way_ : 

```javascript
// Chainsaw turn on polling to listen to events
chainsaw.turnOnPolling(eventCallBack)
```

### 6. Complete Working Example of Usage :

```javascript
// Importing Chainsaw
const Chainsaw = require('eth-chainsaw').Chainsaw
[setup.js can be found here] (./tests/setup.js)
const setup = require('./tests/setup.js')

const Web3 = require('web3')
const app = require('express')()

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

// Chainsaw event callback functions
const eventCallBack = (error, eventData) => {
  if (!error && eventData.length > 0) {
    console.log('Chainsaw eventCallBack', eventData)
  }
}

const initChainsaw = async () => {
  // Following deploys a test contract. Its responsibility
  // of the client of chainsaw to deploy their respective contracts.
  // Chainsaw does not have configs , it only has initializaiton
  // parameters when you instantiate a class .
  const testContract = await setup.default({
    testRPCProvider: 'http://localhost:8545/'
  })

  // Initialize with web3 provider and contract address to watch.
  const chainsaw = new Chainsaw(web3, [testContract.address])

  // Add abi of the contract to chainsaw.
  chainsaw.addABI(testContract.abi)

  // Chainsaw turn on polling to listen to events
  chainsaw.turnOnPolling(eventCallBack)

  // Now call your contract methods to receive event data
  // in the callback. Following is just a test example
  await testContract.deposit('0xabc', {value: 20} )
}

initChainsaw()

app.listen(3000, function () {
  console.log('Chainsaw Example Usage ')
})
```

## Other Implemented Methods: 

### Get undecoded logs by block number:

_Function_:

```javascript
/**
  ** Given the blocknumber return the array of logs for each transaction.
  ** blockNumber -> Block: [ txHash1, txHash2] -> Logs: [logs1, logs2]
  **/
  getLogsByBlockNumber (blockNumber)
```

_Example Usage_ :

```javascript
chainsaw.getLogsByBlockNumber(web3.eth.blockNumber)
```

### Get decoded logs by block range:

_Function_:

```javascript
/**
  ** Given an startBlock and endBlock range, decoded logs are returned.
  ** Params -
  **  startBlock: Starting block to read the block. (default: latest block)
  **  endBlock: End block to read the block.(default: latest block)
  **/
  getLogs (startBlock = this.eth.blockNumber, endBlock = this.eth.blockNumber)
```

_Example Usage_ : Reads from block 100 to latestBlock .

```javascript
chainsaw.getLogsByBlockNumber(100, web3.eth.blockNumber)
```

### Chainsaw event object format 

```json
 { 
  "name": "DidCreateChannel",
  "events":
   [ { "name": "viewer",
       "type": "address",
       "value": "0x50f485d16569013b785524c8d96720cee14fcf8b" },
     { "name": "broadcaster",
       "type": "address",
       "value": "0x488767fdbd05d7c516357df8a6495171c20f2d81" },
     { "name": "channelId",
       "type": "bytes32",
       "value": "0x2223420000000000000000000000000000000000000000000000000000000000" } ],
  "address": "0x454671f51b892b1597488235785279a1bcb42600",
  "logIndex": 0,
  "blockHash": "0xe1ff93d04753a5750ba0827de2d8067b21b8fbe47ff10cd3560a5e98b7ea67e7",
  "blockNumber": 98,
  "contractAddress": "0x454671f51b892b1597488235785279a1bcb42600",
  "sender": "0x50f485d16569013b785524c8d96720cee14fcf8b",
  "receiver": "0x454671f51b892b1597488235785279a1bcb42600",
  "ts": 1506492156 
  }
  ```
  
### Running chainsaw tests  

```
  npm run mocha
```

Please make sure to edit config.json with web3 http provider of your choice . If you do use anything other than 
testrpc for running tests , please make sure that first 10 accounts `web3.eth.accounts`  are unlocked and has some ether to cover the gas cost for calling contract methods . 

```json
{
  "WEB3_PROVIDER": "http://localhost:8545"
}
```
