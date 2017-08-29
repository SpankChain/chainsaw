import { assert } from 'chai'
import p from 'es6-promisify'
import Web3 from 'web3'
import { sha3 } from 'ethereumjs-util'
import { Chainsaw } from '../lib/chainsaw.js'
import setup from '../js/setup'
const util = require('util')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const solc = require('solc')
const fs = require('fs')

const contractPath = `${__dirname}/../contracts/StubPaymentChannel.sol`
// TODO : Import the configs from chainsaw configs .

let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

describe('chainsaw', () => {
  let snapshots = []
  let chainsaw
  let contractInstance

  const takeSnapshot = () => {
    return new Promise(async (accept) => {
      let res = await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: new Date().getTime()
      })
      accept(res.result)
    })
  }

  const revertSnapshot = (snapshotId) => {
    return new Promise(async (accept) => {
      await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [snapshotId],
        id: new Date().getTime()
      })
      accept()
    })
  }

  const mineBlock = () => {
    return new Promise(async (accept) => {
      await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      })
      accept()
    })
  }

  const mineBlocks = (count) => {
    return new Promise(async (accept) => {
      let i = 0
      while (i < count) {
        await mineBlock()
        i++
      }
      accept()
    })
  }

  before(async () => {
    contractInstance = await setup({
      testRPCProvider: 'http://localhost:8545/'
    })
    const content = fs.readFileSync(contractPath)
    const compiledContract = solc.compile(content.toString(), 1)
    const abi = compiledContract.contracts[':StubPaymentChannel'].interface
    chainsaw = new Chainsaw(web3, [contractInstance.address])
    chainsaw.addABI(JSON.parse(abi))
  })

  describe('[with test contract deployed ]', () => {

    it('[test contract deployment successful]', () => {
      assert.notEqual(contractInstance, undefined)
      assert.equal(contractInstance.address.length, 42)
    })

    describe('[With single block range]', () => {
      before(async() => {
        snapshots.push(await takeSnapshot())
      })

      after(async() => {
        await revertSnapshot(snapshots.pop())
      })

      it('[Function:getLogsByBlockNumber - no logs/events]', async() => {
        await mineBlocks(1)
        const logsInTheBlock = chainsaw.getLogsByBlockNumber(web3.eth.blockNumber)
        assert.equal(logsInTheBlock.length, 0)
      })

      it('[Function.getLogsByBlockNumber - with undecoded logs/events]', async () => {
        // Create an event in the block
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        const logsInTheBlock = chainsaw.getLogsByBlockNumber(web3.eth.blockNumber)[0][0]
        assert.equal(logsInTheBlock.address.length, 42)
        assert.isArray(logsInTheBlock.topics, 'Topics should be an array')
      })

      it('[Function:getLogs - no logs/events]', async () => {
        await mineBlocks(1)
        assert.equal(chainsaw.getLogs().length, 0)
      })

      it('[Function:getLogs - with decoded logs/events]', async () => {
        // Create an event by calling method on the contract
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        const eventLog = chainsaw.getLogs()[0][0]
        assert.equal(eventLog.name, 'DidCreateChannel')
        assert.equal(eventLog.address.length, 42)
        assert.isArray(eventLog.events)
      })
    })

    describe('[With startBlock and endBlock specified]', () => {
      before(async() => {
        snapshots.push(await takeSnapshot())
      })

      after(async() => {
        await revertSnapshot(snapshots.pop())
      })

      it('[Function:getLogs - decoded logs for startBlock/endBlock range]', async() => {
        // TODO: Finish these set of tests
        const expectedEvents = ['DidCreateChannel', 'DidDeposit']
        const eventParams = [
          [
            { name: 'viewer',
              type: 'address',
              value: web3.eth.accounts[0] },
            { name: 'broadcaster',
              type: 'address',
              value: web3.eth.accounts[2] },
            { name: 'channelId',
              type: 'bytes32',
              value: '0x2223420000000000000000000000000000000000000000000000000000000000' }
          ],
          [
            { name: 'channelId',
              type: 'bytes32',
              value: '0x2223420000000000000000000000000000000000000000000000000000000000' },
            { name: 'amount', type: 'uint256', value: '20' }
          ]
        ]

        const startBlock = web3.eth.blockNumber

        // Create a new event
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')

        // Mine 3 no event Blocks
        await mineBlocks(3)

        await contractInstance.deposit('0x222342', {value: 20})
        const endBlock = web3.eth.blockNumber
        const logs = chainsaw.getLogs(startBlock, endBlock)

        for (let i = 0; i < expectedEvents.length; i++) {
          assert.equal(logs[i][0].name, expectedEvents[i])
          assert.equal(logs[i][0].address, contractInstance.address)
          assert.deepEqual(logs[i][0].events, eventParams[i])
        }
      })

      it.skip('[Function:getLogs - Test invalid block range]', () => {
        // TODO : Fix this test This causes infinite loop , investigate
        let startBlock = -1
        let endBlock = web3.eth.blockNumber + 100

        try {
          const logs = chainsaw.getLogs(startBlock, endBlock)
        } catch (error) {
          assert.equal(error.message, 'Invalid startBlock: Must be below web3.eth.blockNumber or startBlock cannot be below 0')
        }
        startBlock = web3.eth.blockNumber + 1
        endBlock = web3.eth.blockNumber

        try {
          const logs = chainsaw.getLogs(startBlock, endBlock)
        } catch (error) {
          assert.equal(error.message, 'Invalid startBlock: Must be below endBlock')
        }

        startBlock = 6
        endBlock = 5

        try {
          const logs = chainsaw.getLogs(startBlock, endBlock)
        } catch (error) {
          assert.equal(error.message, 'Invalid startBlock: Must be below endBlock')
        }
      })
    })

    describe('[Test polling]', () => {
      // after(async() => {
      //   await revertSnapshot(snapshots.pop())
      // })
      it('[Basic Polling]', async () => {
        // Call an contract method to mine a new block
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        await contractInstance.deposit('0x222342', {value: 20})

        chainsaw.turnOnPolling(function (error, response) {
          if (!error) {
            assert.isAbove(response.length, 0)
            assert.isArray(response[0][0].events, 'Events is array of parameter')
            assert.equal(response[0][0].address, contractInstance.address)
          }
        })
      })
    })

    describe('[with Chainsaw initialized with contract addresses]', () => {
      // Initialize chainsaw with contract address
      let chainsawWithContractAddress
      before(async() => {
        // TODO : Deploy multiple contracts, test chainsaw logs extractions.
        chainsawWithContractAddress = new Chainsaw(web3, [contractInstance.address])
      })

      it.skip('[Test with chainsaw initialization ]', async() => {
        // TODO : Finish this test
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        const logs = chainsawWithContractAddress.getLogs()
        console.log('Logs chainsaw', logs)
      })
    })
  })
})

/*
    it("Add Ab", async () => {
      fs.readFile(contractPath, (error, content) =>{
        if(!error){
          let compiledContract = solc.compile(content.toString(), 1)
          let abi = compiledContract.contracts[':StubPaymentChannel'].interface
          let logDecoder = new LogDecoder();

          chainsaw.run();
        }
      })
    })
  })

    it.skip("Decode logs", async () => {
      let log = {
        logIndex: 0,
        transactionIndex: 0,
        transactionHash: '0xeecbdd424cc3db7567a55c6517428b2d58ae5719adf76a71dc3dfb9e3081bec2',
        blockHash: '0x7902fbc122df3b4ada3a653d0a81442c51ef72a984e8272793ea89c8bd76e1e8',
        blockNumber: 7,
        address: '0xcdc731b2a28aaf66d1a32e787987e0288b1d485d',
        data: '0x2c00000000000000000000000000000000000000000000000000000000000000',
        topics:
         [ '0xadc1e8a294f8415511303acc4a8c0c5906c7eb0bf2a71043d7f4b03b46a39130',
           '0x00000000000000000000000036b9bf8edd9633d2c32bf821c493f5e438a4d345',
           '0x000000000000000000000000f51832115d7c81e0398af7e828b0228e11dba6ff' ],
        type: 'mined'
                } ;
      let logDecoder = new LogDecoder();
      logDecoder.decodeLogs(log);
    })

})
*/
