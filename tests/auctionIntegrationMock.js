// Step 1: Deploy Contract - initialized with one set of parameters
// Step 2: Call contract method "start" auction .
// Step 3: Call contact method "depositInWEI" .
// Step 4: Chainsaw polling would get the event data . Use event data in
// call back to call insert_auction_event mock function.
// Step 5: Simulate /Randomize step3 for lots of user deposits.

// More organized thought
// 1: All Events in auction contract
// Listen all of the following events
// event DepositEvent(address indexed buyer, uint weiDeposited);
// event SetStrikePriceEvent(uint strikePrice);
// event ProcessBidEvent(address indexed buyer, uint numTokensPurchased, uint totalCostInWei);
// event AuctionSuccessEvent(uint blockNumber, uint strikePrice, uint totalTokensSold, uint totalWeiRaised);
// event WithdrawEvent(address indexed buyer, uint tokensReceived, uint unspentDeposit);
// Use chainsaw in polling mode to get the events in a callback and then
// call insert_auction_event mock .
// First strategy to use sinon and spies.

import { assert, expect } from 'chai'
import p from 'es6-promisify'
import { setupAuction } from '../js/setup'
import { SCOAuction } from '../../auction/database/sco-auction.js'
import { Chainsaw } from '../lib/chainsaw.js'
import Web3 from 'web3'

const fs = require('fs')
const sinon = require('sinon')

const _pga = require('pg-async')
const secp256k1 = require(`secp256k1`)
const abi = require(`ethereumjs-abi`)

let [PgAsync, SQL] = [_pga['default'], _pga.SQL];

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
let update = (...args) => Object.assign({}, ...args)

describe('Auction Integration Mock', () => {
  let contractInstance
  let chainsaw
  let scoAuction
  let scoAuctionMock

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

  describe('[Testrpc : Contract deployment in testrpc]', () => {
    before(async () => {
      const inputContracts = {
        'SafeMath.sol': fs.readFileSync(`${__dirname}/../contracts/SafeMath.sol`).toString(),
        'Token.sol': fs.readFileSync(`${__dirname}/../contracts/Token.sol`).toString(),
        'IERC20Token.sol': fs.readFileSync(`${__dirname}/../contracts/IERC20Token.sol`).toString(),
        'StandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/StandardToken.sol`).toString(),
        'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/HumanStandardToken.sol`).toString(),
        'Auction.sol': fs.readFileSync(`${__dirname}/../contracts/Auction.sol`).toString()
      }
      // Deploy the auction contract
      // See if the auction contract looks like .
      contractInstance = await setupAuction({
        testRPCProvider: 'http://localhost:8545/',
        defaultContract: 'Auction.sol',
        input: inputContracts,
        constructParams: {
          'tokenSupply': 1000000000,
          'tokenName': 'TESTRPCTOKEN',
          'tokenDecimals': 9,
          'tokenSymbol': 'TST',
          'weiWallet': web3.eth.accounts[5],
          'tokenWallet': web3.eth.accounts[6],
          'minDepositInWei': 200,
          'minWeiToRaise': 1000,
          'maxWeiToRaise': 100000000000000000000,
          'minTokensForSale': 1,
          'maxTokensForSale': 500000000,
          'maxTokenBonusPercentage': 40,
          'depositWindowInBlocks': 10,
          'processingWindowInBlocks': 1000
        }
      })
      chainsaw = new Chainsaw(web3, [contractInstance.address])
      chainsaw.addABI(contractInstance.abi)
      const TEST_DB = { host: 'localhost', database: 'auction' }
      let cxn = new PgAsync(update(TEST_DB, { database: 'postgres' }))
    //  await cxn.query(`DROP DATABASE "${TEST_DB.database}"`).then(null, () => {})
      //await cxn.query(`CREATE DATABASE "${TEST_DB.database}"`)
      scoAuction = new SCOAuction(TEST_DB)
    //  await scoAuction.setupDatabase()
      scoAuctionMock = sinon.mock(scoAuction)
    })

    const getSignatures = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999) => {
      const msg = `0x${abi.soliditySHA3(['address', 'uint', 'uint'],
      [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`
      console.log('Contract address ::', contractInstance.address)
      console.log('msg:', msg)

      return new Promise((resolve, reject) => {
        web3.eth.sign(web3.eth.accounts[0], msg, function (err, result) {
          if (!err) {
            const sig = result.substr(2, result.length)
            const r = '0x' + sig.substr(0, 64)
            const s = '0x' + sig.substr(64, 64)
            const v = web3.toDecimal(sig.substr(128, 2)) + 27
            // r = result.slice(0, 66)
            // s = '0x' + result.slice(66, 130)
            // v = web3.toDecimal(String('0x' + result.slice(130, 132)))
            console.log(`${tokenBidPriceInWei},${bidWeiAmount}, ${v}, ${r}, ${s}`)
            resolve({r, s, v})
          } else {
            reject(err)
          }
        })
      })
    }

    it('Connect to Postgres', async () => {
      let pgVersion = await scoAuction.selftest()
      assert.isAbove(+pgVersion.pg_version, 90400)
    })

    describe('[with Auction contract deployed]', () => {
      it('[test contract deployment successful]', () => {
        assert.notEqual(contractInstance, undefined)
        assert.equal(contractInstance.address.length, 42)
      })
      after(async () => {
        chainsaw.turnOffPolling()
      })

      describe('DepositEvent', () => {
        it('[deposit: One contract method call]', async () => {
          await contractInstance.deposit({
            sender: web3.eth.accounts[0],
            value: 1000 })

          chainsaw.turnOnPolling(async function (error, response) {
            console.log('Polling response is here', response)

            if (!error) {
              const expectedArgs = response[0][0]
              const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
              await scoAuction.insertAuctionEvent(1, expectedArgs)
              const chainId = 1
              queryOne.callsArgWithAsync(2, 'res', SQL`
                SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
              queryOne.restore()
            }
          })
        })
        it('[deposit: Multiple deposit calls with random values]', async () => {
        })
      })

      describe('SetStrikePriceEvent', () => {
        it('[setStrikePrice: Not in bid processingPhase]', async () => {

          try {
            await contractInstance.setStrikePrice(696)
          } catch (error) {
            assert.ok(error, 'Not in bid phase cannot set the strike phase.')
          }
        })
        it('[setStrikePrice: In bid phase success]', async () => {
          // Will change to bid phase after mining 10 blocks.
          await mineBlocks(10)
          await contractInstance.setStrikePrice(696)

          chainsaw.turnOnPolling(async function (error, response) {
            console.log('Polling response is here', response)
            if (!error) {
              const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
              const expectedArgs = response[0][0]
              const chainId = 1
              await scoAuction.insertAuctionEvent(chainId, expectedArgs)
              queryOne.callsArgWithAsync(2, 'res', SQL`
                SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
              queryOne.restore()
            }
          })
        })
      })

      describe('ProcessBidEvent', () => {
        it('[processBid: One contract method call]', async () => {
          const tokenBidPriceInWei = 696
          const bidWeiAmount = 1000
          const ret = await getSignatures(tokenBidPriceInWei, bidWeiAmount)
          console.log('ret value ', ret)
          await contractInstance.processBid(
          tokenBidPriceInWei,
          bidWeiAmount,
          1,
          0,
          ret.r,
          ret.s)

          chainsaw.turnOnPolling(async function (error, response) {
            console.log('Polling response is here', response)

            if (!error) {
              // ************** Need to mock insertAuctionEvent *************
              const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
              const expectedArgs = response[0][0]
              const chainId = 1
              await scoAuction.insertAuctionEvent(chainId, expectedArgs)
              queryOne.callsArgWithAsync(2, 'res', SQL`
                SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
              queryOne.restore()
            }
          })
        })
      })

      describe('AuctionSuccessEvent', () => {
        it('[completeSuccessfulAuction: One contract method call]', async () => {
        //  await mineBlocks(1000)
          await contractInstance.completeSuccessfulAuction()
          chainsaw.turnOnPolling(async function (error, response) {
            console.log('Polling response is here', response)

            if (!error) {
              const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
              const expectedArgs = response[0][0]
              const chainId = 1
              await scoAuction.insertAuctionEvent(chainId, expectedArgs)
              queryOne.callsArgWithAsync(2, 'res', SQL`
                SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
              queryOne.restore()
            }
          })
        })
      })

      describe.skip('WithdrawEvent', () => {
        before(async () => {
          // Before should have snapshot of auction complete phase
        })
        it('[withdraw: One contract method call]', async () => {
          await contractInstance.withdraw({ sender: web3.eth.accounts[0] })

          chainsaw.turnOnPolling(function (error, response) {
            console.log('Polling response is here', response)

            if (!error) {
              // ************** Need to mock insertAuctionEvent *************
            }
          })
        })
      })
    })
  })
})
