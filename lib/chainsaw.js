const abiDecoder = require('abi-decoder')

// Lives inside a long-running process
// Usage patterns:
// 1. Polling - given a set of contract addresses, emit all events logged for that contract
// 2. Querying - given a block range and an address, return all events logged

/**
** Chainsaw is a ethereum log extractor and log decoding library.
**/
class Chainsaw {
  constructor (web3, contractAddresses = []) {
    this.web3 = web3
    this.eth = web3.eth
    this.contractAddresses = contractAddresses
  }

  /**
  ** Given the blocknumber return the array of logs for each transaction.
  ** blockNumber -> Block: [ txHash1, txHash2] -> Logs: [logs1, logs2]
  **/
  getLogsByBlockNumber (blockNumber) {
    let block = this.eth.getBlock(blockNumber)
    if (block && block['hash']) {
      let transactionHashes = block['transactions']
      return transactionHashes.map(tx => {
        // If no logs for a transaction it is omitted
        let receipt = this.web3.eth.getTransactionReceipt(tx)
        if (receipt && receipt['logs']) {
          return receipt['logs']
        }
      }).filter(a => (a !== []))
    } else {
      return []
    }
  }

  /**
  ** Ability to add abi for decoder before being able to decode logs
  ** in the block .
  **/
  addABI (abi) {
    abiDecoder.addABI(abi)
  }

  /**
  ** Decode logs in the blocks using abiDecoder .
  ** Returns event in this example format:
  { name: 'DidCreateChannel',
    events:
      [ { name: 'viewer',
         type: 'address',
         value: '0x08d1bf4bac8fa0d0d329c95c18f45eec7c7739c2' },
       { name: 'broadcaster',
         type: 'address',
         value: '0xbed82d0641feba393ef536d179ee2a44223fdbfc' },
       { name: 'channelId',
         type: 'bytes32',
         value: '0x2223420000000000000000000000000000000000000000000000000000000000' } ],
    address: '0xb536509016df6ff7829eb25312830cbdbcac29c2' }
  **/
  decodeLogsInBlock (logs) {
    return abiDecoder.decodeLogs(logs)
  }

  /**
  ** Given an startBlock and endBlock range, decoded logs are returned.
  ** If values are default values are not specified startBlock and endBlock
  ** have default values of latest block and hence it returns the logs of
  ** latest blocks decoded logs .
  **/
  getLogs (startBlock = this.eth.blockNumber, endBlock = this.eth.blockNumber) {
    if (startBlock > this.eth.blockNumer) {
      throw new Error('Invalid startBlock: Must be below web3.eth.blockNumber')
    }

    if (startBlock > endBlock) {
      throw new Error('Invalid startBlock: Must be below endBlock')
    }

    let logs
    for (let i = startBlock; i <= endBlock; i++) {
      const logsInTheBlock = this.getLogsByBlockNumber(i)
      logs = logsInTheBlock.map(log => {
        return this.decodeLogsInBlock(log)
      }).filter(a => a)
    }

    return logs
  }
}

module.exports = {
  Chainsaw
}
