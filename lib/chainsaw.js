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
  constructor (web3, contractAddresses = [], isPolling = false, lastReadBlockNumber = web3.eth.blockNumber) {
    this.web3 = web3
    this.eth = web3.eth
    this.contractAddresses = contractAddresses
    this.isPolling = isPolling
    this.lastReadBlockNumber = this.eth.blockNumber
    this.generator = null
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
  ** If default values are not specified startBlock and endBlock
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

    let logs = []
    for (let i = startBlock; i <= endBlock; i++) {
      const logsInTheBlock = this.getLogsByBlockNumber(i)
      logs.push(logsInTheBlock.map(log => {
        if (this.contractAddresses.length > 0) {
          log = log.filter(a => this.contractAddresses.indexOf(a.address) >= 0)
        }
        return abiDecoder.decodeLogs(log)
      }).filter(a => a.length > 0))
    }

    // // Flatten the logs array
    logs = logs.reduce((prev, curr) => {
      return prev.concat(curr)
    }).filter(a => a.length > 0)

    return logs
  }

  * getLogsGenerator () {
    // console.log('lastReadBlockNumber:', this.lastReadBlockNumber)
    // console.log('currentBlockNumber:', this.eth.blockNumber)
    if (this.lastReadBlockNumber < this.eth.blockNumber) {
      yield this.getLogs(this.lastReadBlockNumber, this.eth.blockNumber)
      this.lastReadBlockNumber = this.eth.blockNumber
    }
  }

  async runPolling (callback) {
    if (!this.isPolling) {
      // End polling as it has been set to false .
      return
    }

    if (!this.generator) {
      this.generator = this.getLogsGenerator()
    }

    const logsP = this.generator.next()
    if (logsP.value) {
      callback(null, logsP.value)
    }

    // TODO : await around block time .
    // Event make it better , how often you can poll.
    await wait(1000)
    this.runPolling(callback)
  }

  turnOnPolling (callback) {
    this.isPolling = true
    this.runPolling(callback)
  }

  turnOffPolling () {
    this.isPolling = false
  }
}

module.exports = {
  Chainsaw
}
