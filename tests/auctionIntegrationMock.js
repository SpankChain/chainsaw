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
// const secp256k1 = require(`secp256k1`)
// const abi = require(`ethereumjs-abi`)
const BN = require('bn.js')

let [PgAsync, SQL] = [_pga['default'], _pga.SQL]

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

const ethUtil = require('ethereumjs-util')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
let update = (...args) => Object.assign({}, ...args)

describe('Auction Integration Mock', () => {
  let contractInstance
  let chainsaw
  let scoAuction

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

  const randomIntFromInterval = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  const getSig = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999, depositFromAccount = web3.eth.accounts[0]) => {
    const msgHash = web3.sha3(contractInstance.address, tokenBidPriceInWei, bidWeiAmount)
    // const msgHash = '0x' + Buffer.from(String(contractInstance.address) + String(tokenBidPriceInWei) + String(bidWeiAmount)).toString('hex')
    // const msgHash = web3.sha3('hello')
    // const msgHash = '0x' + Buffer.from('hello').toString('hex')
    // const msgHash = `0x${abi.soliditySHA3(['address', 'uint', 'uint'], [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`
    // const msgHash ='0xf4ad19e1b2618eb70be5c6e082a3d045b5b9cdb2c85c4ed0a317c5cda3cf6899'
    // const msgHash = ethUtil.sha3(contractInstance.address, tokenBidPriceInWei, bidWeiAmount)

    console.log('MsgHash ::', msgHash)

    // const prefix = Buffer.from('\x19Ethereum Signed Message:\n')
    // const prefixedMsg = ethUtil.sha3(
    //   Buffer.concat([prefix, Buffer.from(String(msgHash.length)), Buffer.from(msgHash)])
    // )
    const sig = web3.eth.sign(depositFromAccount, msgHash)
    const {v, r, s} = ethUtil.fromRpcSig(sig)
    console.log('v, r, s', v, r, s)

    // Geth does this automatically
    // const pubKey = ethUtil.ecrecover(ethUtil.toBuffer('0xf4ad19e1b2618eb70be5c6e082a3d045b5b9cdb2c85c4ed0a317c5cda3cf6899'), v, r, s)
    // const pubKey = ethUtil.ecrecover(msgHash, v, r, s)
    // const pubKey = ethUtil.ecrecover(prefixedMsg, v, r, s)
    // console.log('pubKey', pubKey)
    // const addrBuf = ethUtil.pubToAddress(pubKey)
    // const addr = ethUtil.bufferToHex(addrBuf)
    // console.log('web3 acccounts are the same', web3.eth.accounts[0], addr)
    return {v, r, s}
  }

  describe.skip('[AuctionFlow : Single event flow TestRPC]', () => {
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

      // Chainsaw and Database setup.
      chainsaw = new Chainsaw(web3, [contractInstance.address])
      chainsaw.addABI(contractInstance.abi)
      const TEST_DB = { host: 'localhost', database: 'auction' }
      scoAuction = new SCOAuction(TEST_DB)
      // await scoAuction.setupDatabase()
    })

    it('[Test Signatures and ECRecover outside of contracts]', async () => {
      getSig()
    })

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

              // 1 . Test the state on the chain by parameter by contract method call.
              expectedArgs.events.map(a => {
                if (a.name === 'depositInWei') {
                  assert.equal(1000, a.value, 'Correct DepositInWei for this account')
                }

                if (a.name === 'totalDepositInWei') {
                  assert.equal(1000, a.value, 'Total Deposit is correct')
                }

                if (a.name === 'buyerAddress') {
                  assert.equal(web3.eth.accounts[0], a.value, 'Deposit address is correct')
                }
              })

              // 2. Stub and test database insert_auciton_event .
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
          // Get v, r, s
          const ret = await getSig(tokenBidPriceInWei, bidWeiAmount)

          // Calling contract method processBid
          await contractInstance.processBid(
          tokenBidPriceInWei,
          bidWeiAmount,
          1,
          ret.v,
          ret.r,
          ret.s)

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

      describe('AuctionSuccessEvent', () => {
        it('[completeSuccessfulAuction: One contract method call]', async () => {
        //  await mineBlocks(1000)
          console.log('Auction Success Event => ')
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

      describe('WithdrawEvent', () => {
        before(async () => {
          // Before should have snapshot of auction complete phase
        })
        it('[withdraw: One contract method call]', async () => {
          await contractInstance.withdraw({ sender: web3.eth.accounts[0] })

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
    })
  })

  describe('[AuctionFlow : Multiple Deposits and multiple withdraws flow TestRPC]', () => {
    let accountDeposits = {}
    let deployParams
    let strikePrice
    before(async () => {
      const inputContracts = {
        'SafeMath.sol': fs.readFileSync(`${__dirname}/../contracts/SafeMath.sol`).toString(),
        'Token.sol': fs.readFileSync(`${__dirname}/../contracts/Token.sol`).toString(),
        'IERC20Token.sol': fs.readFileSync(`${__dirname}/../contracts/IERC20Token.sol`).toString(),
        'StandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/StandardToken.sol`).toString(),
        'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/HumanStandardToken.sol`).toString(),
        'Auction.sol': fs.readFileSync(`${__dirname}/../contracts/Auction.sol`).toString()
      }

      deployParams = {
        'tokenSupply': 1000000000,
        'tokenName': 'TESTRPCTOKEN',
        'tokenDecimals': 9,
        'tokenSymbol': 'TST',
        'weiWallet': web3.eth.accounts[5],
        'tokenWallet': web3.eth.accounts[6],
        'minDepositInWei': 200,
        'minWeiToRaise': 1000,
        'maxWeiToRaise': new BN('23000000000000000000000'), // 69 Million at eth = $300
        'minTokensForSale': 1,
        'maxTokensForSale': 500000000,
        'maxTokenBonusPercentage': 40,
        'depositWindowInBlocks': 10,
        'processingWindowInBlocks': 1000
      }

      contractInstance = await setupAuction({
        testRPCProvider: 'http://localhost:8545/',
        defaultContract: 'Auction.sol',
        input: inputContracts,
        constructParams: deployParams
      })

      // Chainsaw and Database setup.
      chainsaw = new Chainsaw(web3, [contractInstance.address])
      chainsaw.addABI(contractInstance.abi)
      const TEST_DB = { host: 'localhost', database: 'auction' }
      scoAuction = new SCOAuction(TEST_DB)
    })

    it('Connect to Postgres', async () => {
      let pgVersion = await scoAuction.selftest()
      assert.isAbove(+pgVersion.pg_version, 90400)
    })

    it('[test contract deployment successful]', () => {
      console.log('contract Instance', contractInstance)
      assert.notEqual(contractInstance, undefined)
      assert.equal(contractInstance.address.length, 42)
    })

    it('[DepositEvent: Ten Deposit Events]', async () => {
      let totalDeposit = 0
      for (let i = 1; i <= 9; i++) {
        const randDeposit = randomIntFromInterval(1000, 10000)
        await contractInstance.deposit({
          sender: web3.eth.accounts[i],
          value: randDeposit })
        totalDeposit += randDeposit
        // Recording deposits each one made for processBid.
        accountDeposits[web3.eth.accounts[i]] = randDeposit
        chainsaw.turnOnPolling(async function (error, response) {
          if (!error) {
            const expectedArgs = response[0][0]
            console.log(`\x1b[42m`, 'Deposit Event ')
            console.log(i, expectedArgs)

            // 1 . Test the state on the chain by parameter by contract method call.
            expectedArgs.events.map(a => {
              if (a.name === 'depositInWei') {
                assert.equal(randDeposit, a.value, 'Correct DepositInWei for this account')
              }

              if (a.name === 'totalDepositInWei') {
                assert.equal(totalDeposit, a.value, 'Total Deposit is correct')
              }
            })

            // 2. Stub and test database insert_auciton_event .
            const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
            await scoAuction.insertAuctionEvent(1, expectedArgs)
            const chainId = 1
            queryOne.callsArgWithAsync(2, 'res', SQL`
              SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
            queryOne.restore()
          }
        })

        chainsaw.turnOffPolling()
      }
    })

    it('[StrikePriceEvent: Set strike price ]', async () => {
      // await SetStrikePriceEvent
      strikePrice = 1000
      await contractInstance.setStrikePrice(strikePrice)
      chainsaw.turnOnPolling(async function (error, response) {
        if (!error) {
          const expectedArgs = response[0][0]

          // Test On chain values from the log events
          expectedArgs.events.map(a => {
            if (a.name === 'strikePriceInWei') {
              assert.equal(strikePrice, a.value, 'Correct strike price set')
            }
          })

          // Test insert_auction_event
          const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
          await scoAuction.insertAuctionEvent(1, expectedArgs)
          const chainId = 1
          queryOne.callsArgWithAsync(2, 'res', SQL`
            SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
          queryOne.restore()
        }
        chainsaw.turnOffPolling()
      })
    })

    it('[ProcessBidEvents: Process Bids ]', async () => {
      // minDepositInWei < bidWeiAmount
      // strikePriceInWei <= tokenBidPriceInWei
      // tokenBidPriceInWei <= bidWeiAmount
      // >> bidWeiAmount should be always greater or equal strikePrice
      let bidIndex = 1
      // Lets accept the random Bids
      while (bidIndex <= 9) {
        const bidWeiAmount = randomIntFromInterval(strikePrice,
          accountDeposits[web3.eth.accounts[bidIndex]])
        const tokenBidPriceInWei = randomIntFromInterval(strikePrice, bidWeiAmount)

        // Get v, r, s
        const ret = await getSig(tokenBidPriceInWei, bidWeiAmount, web3.eth.accounts[bidIndex])

        // Calling contract method processBid
        await contractInstance.processBid(
        tokenBidPriceInWei,
        bidWeiAmount,
        1,
        ret.v,
        ret.r,
        ret.s)

        chainsaw.turnOnPolling(async function (error, response) {
          console.log('Polling response is here', response)

          if (!error) {
            const expectedArgs = response[0][0]
            console.log(`\x1b[33m`, 'ProcessBid event ')
            console.log(bidIndex, expectedArgs)
            const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)

            const chainId = 1
            await scoAuction.insertAuctionEvent(chainId, expectedArgs)
            queryOne.callsArgWithAsync(2, 'res', SQL`
              SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
            queryOne.restore()
          }
        })
        chainsaw.turnOffPolling()
        bidIndex++
      }
    })

    it('[AuctionSuccessEvent : Auction Complete]', async () => {
      await contractInstance.completeSuccessfulAuction()

      chainsaw.turnOnPolling(async function (error, response) {
        if (!error) {
          const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
          const expectedArgs = response[0][0]
          console.log(`\x1b[42m`, 'ExpectedArgs ::', expectedArgs)
          const chainId = 1
          await scoAuction.insertAuctionEvent(chainId, expectedArgs)
          queryOne.callsArgWithAsync(2, 'res', SQL`
            SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
          queryOne.restore()
        }
      })
      chainsaw.turnOffPolling()
    })
  })
})
