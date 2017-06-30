const Web3 = require('web3');

const CONTRACTS_INTERFACE = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "broadcaster",
        "type": "address"
      },
      {
        "name": "channelId",
        "type": "bytes32"
      }
    ],
    "name": "createChannel",
    "outputs": [],
    "payable": true,
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "channelId",
        "type": "bytes32"
      },
      {
        "name": "payment",
        "type": "uint256"
      },
      {
        "name": "challengedPayment",
        "type": "uint256"
      }
    ],
    "name": "settle",
    "outputs": [],
    "payable": true,
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "channelId",
        "type": "bytes32"
      },
      {
        "name": "payment",
        "type": "uint256"
      }
    ],
    "name": "startSettle",
    "outputs": [],
    "payable": true,
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "channelId",
        "type": "bytes32"
      }
    ],
    "name": "deposit",
    "outputs": [],
    "payable": true,
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "viewer",
        "type": "address"
      },
      {
        "indexed": true,
        "name": "broadcaster",
        "type": "address"
      },
      {
        "indexed": false,
        "name": "channelId",
        "type": "bytes32"
      }
    ],
    "name": "DidCreateChannel",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "channelId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "DidDeposit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "name": "channelId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "payment",
        "type": "uint256"
      }
    ],
    "name": "DidStartSettle",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "name": "channelId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "name": "payment",
        "type": "uint256"
      },
      {
        "indexed": false,
        "name": "challengedPayment",
        "type": "uint256"
      }
    ],
    "name": "DidSettle",
    "type": "event"
  }
];

const contractInterface = function () {
  return CONTRACT_INTERFACE
}

const contractObject = function(){
  const abi = contractInterface();
  const deployed = web3.eth.contract(JSON.parse(abi));
  return deployed ;
}

module.exports = {
  contractObject : contractObject
}
