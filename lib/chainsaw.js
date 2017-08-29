import p from 'es6-promisify'
const abiDecoder = require('abi-decoder')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

// Lives inside a long-running process
// Usage patterns:
// 1. Polling - given a set of contract addresses, emit all events logged for that contract
// 2. Querying - given a block range and an address, return all events logged

/**
** Chainsaw is a ethereum log extractor and log decoding library.
**/
class Chainsaw {
  constructor (web3, contractAddresses = [], pollingInterval = 10000) {
    this.web3 = web3
    this.eth = web3.eth
    this.contractAddresses = contractAddresses
    this.isPolling = false
    this.lastReadBlockNumber = this.eth.blockNumber
    this.generator = null
    this.pollingInterval = pollingInterval
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
      }).filter(a => a.length > 0)
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
  ** Given an startBlock and endBlock range, decoded logs are returned.
  ** Params -
  **  startBlock: Starting block to read the block. (default: latest block)
  **  endBlock: End block to read the block.(default: latest block)
  **/
  getLogs (startBlock = this.eth.blockNumber, endBlock = this.eth.blockNumber) {

    if (startBlock > this.eth.blockNumer || startBlock < 0) {
      throw new Error('Invalid startBlock: Must be below web3.eth.blockNumber or startBlock cannot be below 0')
    }

    if (startBlock > endBlock) {
      throw new Error('Invalid startBlock: Must be below endBlock')
    }

    if (endBlock > this.eth.blockNumber) {
      throw new Error('Invalid endBlock: Must be less than or equal to latest block')
    }

    let logs = []
    for (let i = startBlock; i <= endBlock; i++) {
      const logsInTheBlock = this.getLogsByBlockNumber(i)
      logs.push(logsInTheBlock.map(log => {
        log = log.filter(a => this.contractAddresses.indexOf(a.address) >= 0)
        return abiDecoder.decodeLogs(log)
      }).filter(a => a.length > 0))
    }

    // // Flatten the logs array
    logs = logs.reduce((prev, curr) => {
      return prev.concat(curr)
    }).filter(a => a.length > 0)

    return logs
  }

  /**
  ** Generator function which yields logs from the blockchain based on last
  ** read block and the latest block.
  **/
  * getLogsGenerator () {
    if (this.lastReadBlockNumber < this.eth.blockNumber) {
      yield this.getLogs(this.lastReadBlockNumber, this.eth.blockNumber)
      this.lastReadBlockNumber = this.eth.blockNumber
    }
  }

  /**
  ** Recursive runPolling functions. (Recommended not to call this function
  ** directly.) Best usage pattern would be call turnOnPolling(handler).
  ** Termination condition for runPolling is when isPolling = false.
  **/
  async runPolling (handler) {
    if (!this.isPolling) {
      // End polling if isPolling is set to false.
      return
    }

    if (!this.generator) {
      this.generator = this.getLogsGenerator()
    }

    const logsP = this.generator.next()
    if (logsP.value) {
      handler(null, logsP.value)
    }

    await wait(this.pollingInterval)
    this.runPolling(handler)
  }
  /**
  ** Turns polling on for reading logs.
  ** Params -
  **  handler: Expects an function handler to send the logs back.
  **/
  turnOnPolling (handler) {
    this.isPolling = true
    this.runPolling(handler)
  }

  /**
  **  Turns polling off.(Logs can still be manually read)
  **/
  turnOffPolling () {
    this.isPolling = false
  }
}

module.exports = {
  Chainsaw
}
