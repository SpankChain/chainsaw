import { assert } from 'chai'
import p from 'es6-promisify'
import Web3 from 'web3'
import { sha3 } from 'ethereumjs-util'
import { Chainsaw } from '../lib/chainsaw.js'
import setup from './js/setup'
import * as utils from './utils/utils.js'
import * as config from './config.json'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const web3 = new Web3(new Web3.providers.HttpProvider(config.WEB3_PROVIDER))

describe('chainsaw', () => {
  let chainsaw
  let contractInstance

  before(async () => {
    contractInstance = await setup({
      testRPCProvider: config.WEB3_PROVIDER
    })
    chainsaw = new Chainsaw(web3, [contractInstance.address])
    chainsaw.addABI(contractInstance.abi)
  })

  describe('[with test contract deployed ]', () => {

    it('[test contract deployment successful]', () => {
      assert.notEqual(contractInstance, undefined)
      assert.equal(contractInstance.address.length, 42)
    })

    describe('[getLogsByBlockNumber: With single block range]', () => {
      it('[test with no (undecoded)logs/events]', async() => {
        await utils.mineBlocks(1)
        const logsInTheBlock = chainsaw.getLogsByBlockNumber(web3.eth.blockNumber)
        assert.equal(logsInTheBlock.length, 0, 'Since no contract method called ,hence no logs.')
      })

      it('[Invalid block number]', () => {
        try {
          const logsInTheBlock = chainsaw.getLogsByBlockNumber(-1)
        } catch (error) {
          assert.equal(error.message, 'Invalid blockNumber : blockNumber should be greater than zero and less than latestBlock.')
        }
      })

      it('[test with (undecoded)logs/events]', async () => {
        // Create an event in the block
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        const logsInTheBlock = chainsaw.getLogsByBlockNumber(web3.eth.blockNumber)[0][0]
        assert.equal(logsInTheBlock.address.length, 42)
        assert.isArray(logsInTheBlock.topics, 'Topics should be an array')
      })
    })

    describe('[getLogs: no startBlock and endBlock (only default)]', () => {
      it('[getLogs: A block with no logs/events]', async () => {
        await utils.mineBlocks(1)
        assert.equal(chainsaw.getLogs().length, 0)
      })

      it('[getLogs: A block with decoded logs/events]', async () => {
        // Create an event by calling method on the contract
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        const eventLog = chainsaw.getLogs()[0][0]
        assert.equal(eventLog.name, 'DidCreateChannel')
        assert.equal(eventLog.address.length, 42)
        assert.isArray(eventLog.events)
        eventLog.events.forEach((elem) => {
          switch (elem.name) {
            case 'viewer':
              assert.equal(elem.value, web3.eth.accounts[0])
              break
            case 'broadcaster':
              assert.equal(elem.value, web3.eth.accounts[2])
              break
            case 'channelId':
              assert.equal(elem.value, '0x2223420000000000000000000000000000000000000000000000000000000000')
              break
          }
        })
      })
    })
    describe('[getLogs: With startBlock and endBlock specified]', () => {
      it('[Get decoded logs/events for block range]', async() => {

        await utils.mineBlocks(1)
        const startBlock = web3.eth.blockNumber

        // Create a new event
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')

        // Mine 3 no event Blocks
        await utils.mineBlocks(3)
        await contractInstance.deposit('0x222342', {value: 20})

        const endBlock = web3.eth.blockNumber
        const logs = chainsaw.getLogs(startBlock, endBlock)

        logs.forEach((log) => {
          if (log[0].eventType === 'DidDeposit') {
            assert.equal(log[0].contractAddress, contractInstance.address)
            assert.equal(log[0].sender, web3.eth.accounts[0])
            log[0].fields.forEach((elem) => {
              if (elem.name === 'channelId') {
                assert.equal(elem.value, '0x2223420000000000000000000000000000000000000000000000000000000000')
              }
              if (elem.name === 'amount') {
                assert.equal(elem.value, '20')
              }
            })
          }

          if (log[0].eventType === 'DidCreateChannel') {
            assert.equal(log[0].contractAddress, contractInstance.address)
            assert.equal(log[0].sender, web3.eth.accounts[0])
          
            log[0].fields.forEach((elem) => {
              switch (elem.name) {
                case 'viewer':
                  assert.equal(elem.value, web3.eth.accounts[0])
                  break
                case 'broadcaster':
                  assert.equal(elem.value, web3.eth.accounts[2])
                  break
                case 'channelId':
                  assert.equal(elem.value, '0x2223420000000000000000000000000000000000000000000000000000000000')
                  break
              }
            })
          }
        })
      })

      it('[Test invalid block range]', () => {
        const startBlock = -1
        const endBlock = web3.eth.blockNumber + 100
        try {
          const logs = chainsaw.getLogs(startBlock, endBlock)
        } catch (error) {
          assert.equal(error.message, 'Invalid startBlock: Must be below web3.eth.blockNumber or startBlock cannot be below 0')
        }
      })
    })

    describe('[Test polling]', () => {
      const assertChainsawEvents = (_chainsaw) => {
        _chainsaw.turnOnPolling(function (error, response) {
          if (!error && response.length > 0) {
            response.forEach((log) => {
              if (log[0].eventType === 'DidDeposit') {
                assert.equal(log[0].contractAddress, contractInstance.address)
                assert.equal(log[0].sender, web3.eth.accounts[0])
                log[0].fields.forEach((elem) => {
                  if (elem.name === 'channelId') {
                    assert.equal(elem.value, '0x2223420000000000000000000000000000000000000000000000000000000000')
                  }
                  if (elem.name === 'amount') {
                    assert.equal(elem.value, '20')
                  }
                })
              }

              if (log[0].eventType === 'DidCreateChannel') {
                assert.equal(log[0].contractAddress, contractInstance.address)
                assert.equal(log[0].sender, web3.eth.accounts[0])
                log[0].fields.forEach((elem) => {
                  switch (elem.name) {
                    case 'viewer':
                      assert.equal(elem.value, web3.eth.accounts[0])
                      break
                    case 'broadcaster':
                      assert.equal(elem.value, web3.eth.accounts[2])
                      break
                    case 'channelId':
                      assert.equal(elem.value, '0x2223420000000000000000000000000000000000000000000000000000000000')
                      break
                  }
                })
              }
            })
          }
        })
        _chainsaw.turnOffPolling()
      }

      it('[Basic Polling]', async () => {
        // Call an contract method to mine a new block
        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        await contractInstance.deposit('0x222342', {value: 20})

        assertChainsawEvents(chainsaw)
      })

      it('[Polling : PollingInterval specific testing]', async () => {
        // One second polling Interval
        const _localChainsaw = new Chainsaw(web3, [contractInstance.address], 1000)

        await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
        await contractInstance.deposit('0x222342', {value: 20})

        // Wait for 1 second of polling interval
        await wait(1000)
        assertChainsawEvents(_localChainsaw)
      })

      it('[Polling : Empty polling (no new block created)]', async () => {
        await utils.mineBlocks(1)
        const _localChainsaw = new Chainsaw(web3, [contractInstance.address], 1000)

        // Turn on polling
        _localChainsaw.turnOnPolling((error, response) => {
          if (!error) {
            assert.equal(response.length, 0, 'New block is empty with no logs')
          }
        })

        // Turn off polling.
        _localChainsaw.turnOffPolling()
        // Turn on polling.
        _localChainsaw.turnOnPolling((error, response) => {
          if (!error) {
            assert.equal(response.length, 0, 'Reads just the last block again')
          }
        })
      })
    })
  })
})
