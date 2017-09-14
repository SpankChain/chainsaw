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
import * as utils from '../utils/utils.js'
import { sha3, ecsign } from 'ethereumjs-util'

const fs = require('fs')
const sinon = require('sinon')
const _pga = require('pg-async')
const abi = require('ethereumjs-abi')
const BN = require('bn.js')

let [PgAsync, SQL] = [_pga['default'], _pga.SQL]

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

const ethUtil = require('ethereumjs-util')

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
let update = (...args) => Object.assign({}, ...args)

const sign = (msgHash, privKey) => {
  if (typeof msgHash === 'string' && msgHash.slice(0, 2) === '0x') {
    msgHash = Buffer.alloc(32, msgHash.slice(2), 'hex')
  }
  const sig = ecsign(msgHash, privKey)
  return `0x${sig.r.toString('hex')}${sig.s.toString('hex')}${sig.v.toString(16)}`
}

describe('Auction Integration Mock', () => {
  let contractInstance
  let chainsaw
  let scoAuction

  const getSig = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999, depositFromAccount = web3.eth.accounts[0]) => {
    const msgHash = `0x${abi.soliditySHA3(['address', 'uint', 'uint'], [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`

    const sig = web3.eth.sign(depositFromAccount, msgHash)
    const {v, r, s} = ethUtil.fromRpcSig(sig)
    console.log('r , s , v', r, s, v)

    const pubKey = ethUtil.ecrecover(ethUtil.toBuffer(msgHash), v, r, s)
    // console.log('pubKey', pubKey)
    const addrBuf = ethUtil.pubToAddress(pubKey)
    const addr = ethUtil.bufferToHex(addrBuf)
    console.log('web3 acccounts are the same', web3.eth.accounts[0], addr)
    return {v, r, s}
  }
  describe('[AuctionFlow : Multiple Deposits and multiple withdraws flow TestRPC]', () => {
    let accountDeposits = {}
    let deployParams
    let strikePrice
    const depositIndex = 2
    let totalWieRaised = 0

    before(async () => {
      const inputContracts = {
        'SafeMath.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/SafeMath.sol`).toString(),
        'Token.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Token.sol`).toString(),
        // 'IERC20Token.sol': fs.readFileSync(`${__dirname}/../../auction/contracts/ccontracts/IERC20Token.sol`).toString(),
        'StandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/StandardToken.sol`).toString(),
        'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/HumanStandardToken.sol`).toString(),
        'Auction.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Auction.sol`).toString()
      }

      deployParams = {
        'tokenSupply': 1000000000,
        'tokenName': 'TESTRPCTOKEN',
        'tokenDecimals': 9,
        'tokenSymbol': 'TST',
        'weiWallet': web3.eth.accounts[15],
        'tokenWallet': web3.eth.accounts[16],
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
      // Clean up all the old rows
      await scoAuction.query(SQL`delete from auction_events`)
    })
    it('Connect to Postgres', async () => {
      let pgVersion = await scoAuction.selftest()
      assert.isAbove(+pgVersion.pg_version, 90400)
    })

    it('[test contract deployment successful]', () => {
      assert.notEqual(contractInstance, undefined)
      assert.equal(contractInstance.address.length, 42)
    })

    it('[StartAuctionEvent: Starts the auction]', async () => {
      await contractInstance.startAuction()

      chainsaw.turnOnPolling(async function (error, response) {
        if (!error) {
          const expectedArgs = response[0][0]
          console.log('StartAuctionEvent', expectedArgs)
          expectedArgs.events.map(a => {
            switch (a.name) {
              case 'contracAddress':
                assert.equal(expectedArgs.contractAddress, a.value)
                break
              case 'tokenAddress':
                assert.isOk(a.value)
                break
            }
          })

          // Insert the auction event in to database.
          await scoAuction.insertAuctionEvent(expectedArgs)

          // Test all the db table auction_events values to event log .
          const sqlRows = await scoAuction.query(SQL`SELECT *
                                                       FROM auction_events
                                                      WHERE auction_events.sender = ${expectedArgs.sender}
                                                        AND auction_events.event_name ='StartAuctionEvent'`, expectedArgs.sender)
          // Check all the db state
          assert.equal(sqlRows[0].contract_address, expectedArgs.address)
          assert.equal(sqlRows[0].sender, expectedArgs.sender)
          assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
          assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
          assert.equal(sqlRows[0].block_is_valid, true)
        }
      })
    })

    it('[DepositEvent: Ten Deposit Events]', async () => {
      for (let i = 1; i <= depositIndex; i++) {
        const randDeposit = utils.randomIntFromInterval(1000, 10000)
        await contractInstance.deposit({
          from: web3.eth.accounts[i],
          value: randDeposit })
        totalWieRaised += randDeposit
        // Recording deposits each one made
        accountDeposits[web3.eth.accounts[i]] = randDeposit
        chainsaw.turnOnPolling(async function (error, response) {
          if (!error) {
            const expectedArgs = response[0][0]
            // console.log(`\x1b[32m`, 'Deposit Event ', i, expectedArgs)
            // 1 . Test the state on the chain by parameter by contract method call.
            expectedArgs.events.map(a => {
              if (a.name === 'depositInWei') {
                assert.equal(randDeposit, a.value, 'Deposit account is wrong.')
              }
              if (a.name === 'totalDepositInWei') {
                assert.equal(randDeposit, a.value, 'Total Deposit is incorrect')
              }
              if (a.name === 'buyerAddress') {
                assert.equal(web3.eth.accounts[i], a.value, 'BuyerAddress is wrong')
              }
            })

            // Insert the auction event in to database.
            await scoAuction.insertAuctionEvent(expectedArgs)
            // Test all the db table auction_events values to event log .
            const sqlRows = await scoAuction.query(SQL`SELECT *
                                                         FROM auction_events
                                                        WHERE auction_events.sender = ${expectedArgs.sender}
                                                          AND auction_events.event_name ='DepositEvent'`, expectedArgs.sender)
            // Check all the db state
            assert.equal(sqlRows[0].contract_address, expectedArgs.address)
            assert.equal(sqlRows[0].sender, expectedArgs.sender)
            assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
            assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
            assert.equal(sqlRows[0].block_is_valid, true)
          }
        })

        chainsaw.turnOffPolling()
      }
    })

    it('[StrikePriceEvent: Set strike price ]', async () => {
      // await SetStrikePriceEvent
      await utils.mineBlocks(10)
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

          // Insert the auction event in to database.
          await scoAuction.insertAuctionEvent(expectedArgs)
          // Test all the db table auction_events values to event log .
          const sqlRows = await scoAuction.query(SQL`SELECT *
                                                       FROM auction_events
                                                      WHERE auction_events.sender = ${expectedArgs.sender}
                                                        AND auction_events.event_name ='SetStrikePriceEvent'`, expectedArgs.sender)

          assert.equal(sqlRows[0].contract_address, expectedArgs.address)
          assert.equal(sqlRows[0].sender, expectedArgs.sender)
          assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
          assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
          assert.equal(sqlRows[0].block_is_valid, true)
        }
      })
      chainsaw.turnOffPolling()
    })

    it('[ProcessBidEvents: Process Bids ]', async () => {
      // minDepositInWei < bidWeiAmount
      // strikePriceInWei <= tokenBidPriceInWei
      // tokenBidPriceInWei <= bidWeiAmount
      // >> bidWeiAmount should be always greater or equal strikePrice
      let bidIndex = 1
      // Lets accept the random Bids
      while (bidIndex <= depositIndex) {
        console.log('strikePrice', strikePrice)
        console.log('total deposit each account', accountDeposits[web3.eth.accounts[bidIndex]])
        const bidWeiAmount = utils.randomIntFromInterval(strikePrice,
          accountDeposits[web3.eth.accounts[bidIndex]])
        const tokenBidPriceInWei = utils.randomIntFromInterval(strikePrice, bidWeiAmount)

        // Get v, r, s
        const ret = await getSig(tokenBidPriceInWei, bidWeiAmount, web3.eth.accounts[bidIndex])
        // Calling contract method processBid
        console.log('tokenBidPriceInWei', tokenBidPriceInWei)
        console.log('bidWeiAmount', bidWeiAmount)
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

            // Insert the auction event in to database.
            await scoAuction.insertAuctionEvent(expectedArgs)
            // Test all the db table auction_events values to event log .
            const sqlRows = await scoAuction.query(SQL`SELECT *
                                                         FROM auction_events
                                                        WHERE auction_events.sender = ${expectedArgs.sender}
                                                          AND auction_events.event_name ='ProcessBidEvent'`, expectedArgs.sender)
            console.log('sqlRows in ProcessBidEvent', sqlRows[0])
            assert.equal(sqlRows[0].contract_address, expectedArgs.address)
            assert.equal(sqlRows[0].sender, expectedArgs.sender)
            assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
            assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
            assert.equal(sqlRows[0].block_is_valid, true)
          }
        })
        chainsaw.turnOffPolling()
        bidIndex++
      }
    })

    it('[AuctionSuccessEvent : Auction Complete]', async () => {

      chainsaw.turnOnPolling(async function (error, response) {
        if (!error) {
          const expectedArgs = response[0][0]
          console.log('expectedArgs', expectedArgs)

          // expectedArgs.events.map(a => {
          //   if (a.name === 'strikePriceInWei') {
          //     assert.equal(strikePrice, a.value, 'Strike price set matches')
          //   }
          // })
          // Insert the auction event in to database.
          await scoAuction.insertAuctionEvent(expectedArgs)
          // Test all the db table auction_events values to event log .
          // const sqlRows = await scoAuction.query(SQL`SELECT *
          //                                              FROM auction_events
          //                                             WHERE auction_events.sender = ${expectedArgs.sender}
          //                                               AND auction_events.event_name ='ProcessBidEvent'`, expectedArgs.sender)
          // console.log('sqlRows in AuctionSuccessEvent', sqlRows[0])
          // assert.equal(sqlRows[0].contract_address, expectedArgs.address)
          // assert.equal(sqlRows[0].sender, expectedArgs.sender)
          // assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
          // assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
          // assert.equal(sqlRows[0].block_is_valid, true)
        }
      })
      chainsaw.turnOffPolling()
    })

    it('[WithdrawEvent: withdraw funds]', async () => {
      let withdrawIndex = 1

      while (withdrawIndex <= depositIndex) {
        await contractInstance.withdraw({from: web3.eth.accounts[withdrawIndex]})
        chainsaw.turnOnPolling(async function (error, response) {
          if (!error) {
            const expectedArgs = response[0][0]
            console.log('expectedArgs', expectedArgs)

            expectedArgs.events.map(a => {
              if (a.name === 'tokensReceived') {
                assert.isAtLeast(a.value, 0, 'Tokens received above zero')
              }
              if (a.name === 'unspentDepositInWei') {
                assert.isAtLeast(a.value, 0, 'Unspent deposit should be greater than 0')
              }
            })

            // Insert the auction event in to database.
            await scoAuction.insertAuctionEvent(expectedArgs)
            // Test all the db table auction_events values to event log .
            const sqlRows = await scoAuction.query(SQL`SELECT *
                                                         FROM auction_events
                                                        WHERE auction_events.sender = ${expectedArgs.sender}
                                                          AND auction_events.event_name ='WithdrawEvent'`, expectedArgs.sender)
            assert.equal(sqlRows[0].contract_address, expectedArgs.address)
            assert.equal(sqlRows[0].sender, expectedArgs.sender)
            assert.equal(sqlRows[0].block_hash, expectedArgs.blockHash)
            assert.equal(sqlRows[0].block_number, expectedArgs.blockNumber)
            assert.equal(sqlRows[0].block_is_valid, true)
          }
        })
        withdrawIndex++
      }
    })
  })
  // describe('[AuctionFlow : Single event flow TestRPC]', () => {
  //   before(async () => {
  //     const inputContracts = {
  //       'SafeMath.sol': fs.readFileSync(`${__dirname}/../contracts/SafeMath.sol`).toString(),
  //       'Token.sol': fs.readFileSync(`${__dirname}/../contracts/Token.sol`).toString(),
  //       'IERC20Token.sol': fs.readFileSync(`${__dirname}/../contracts/IERC20Token.sol`).toString(),
  //       'StandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/StandardToken.sol`).toString(),
  //       'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../contracts/HumanStandardToken.sol`).toString(),
  //       'Auction.sol': fs.readFileSync(`${__dirname}/../contracts/Auction.sol`).toString()
  //     }
  //     // Deploy the auction contract
  //     // See if the auction contract looks like .
  //     contractInstance = await setupAuction({
  //       testRPCProvider: 'http://localhost:8545/',
  //       defaultContract: 'Auction.sol',
  //       input: inputContracts,
  //       constructParams: {
  //         'tokenSupply': 1000000000,
  //         'tokenName': 'TESTRPCTOKEN',
  //         'tokenDecimals': 9,
  //         'tokenSymbol': 'TST',
  //         'weiWallet': web3.eth.accounts[5],
  //         'tokenWallet': web3.eth.accounts[6],
  //         'minDepositInWei': 200,
  //         'minWeiToRaise': 1000,
  //         'maxWeiToRaise': 100000000000000000000,
  //         'minTokensForSale': 1,
  //         'maxTokensForSale': 500000000,
  //         'maxTokenBonusPercentage': 40,
  //         'depositWindowInBlocks': 10,
  //         'processingWindowInBlocks': 1000
  //       }
  //     })
  //
  //     // Chainsaw and Database setup.
  //     chainsaw = new Chainsaw(web3, [contractInstance.address])
  //     chainsaw.addABI(contractInstance.abi)
  //     const TEST_DB = { host: 'localhost', database: 'auction' }
  //     scoAuction = new SCOAuction(TEST_DB)
  //     //await scoAuction.setupDatabase()
  //   })
  //
  //   it('Connect to Postgres', async () => {
  //     let pgVersion = await scoAuction.selftest()
  //     assert.isAbove(+pgVersion.pg_version, 90400)
  //   })
  //
  //   describe.skip('[with Auction contract deployed]', () => {
  //     it('[test contract deployment successful]', () => {
  //       assert.notEqual(contractInstance, undefined)
  //       assert.equal(contractInstance.address.length, 42)
  //     })
  //     after(async () => {
  //       chainsaw.turnOffPolling()
  //     })
  //
  //     describe.skip('DepositEvent', () => {
  //       it('[deposit: One contract method call]', async () => {
  //         await contractInstance.deposit({
  //           sender: web3.eth.accounts[0],
  //           value: 1000 })
  //
  //         chainsaw.turnOnPolling(async function (error, response) {
  //           console.log('Polling response is here', response)
  //
  //           if (!error) {
  //             const expectedArgs = response[0][0]
  //
  //             // 1 . Test the state on the chain by parameter by contract method call.
  //             expectedArgs.events.map(a => {
  //               if (a.name === 'depositInWei') {
  //                 assert.equal(1000, a.value, 'Correct DepositInWei for this account')
  //               }
  //
  //               if (a.name === 'totalDepositInWei') {
  //                 assert.equal(1000, a.value, 'Total Deposit is correct')
  //               }
  //
  //               if (a.name === 'buyerAddress') {
  //                 assert.equal(web3.eth.accounts[0], a.value, 'Deposit address is correct')
  //               }
  //             })
  //           }
  //         })
  //       })
  //       it('[deposit: Multiple deposit calls with random values]', async () => {
  //       })
  //     })
  //
  //     describe.skip('SetStrikePriceEvent', () => {
  //       it('[setStrikePrice: Not in bid processingPhase]', async () => {
  //
  //         try {
  //           await contractInstance.setStrikePrice(696)
  //         } catch (error) {
  //           assert.ok(error, 'Not in bid phase cannot set the strike phase.')
  //         }
  //       })
  //       it('[setStrikePrice: In bid phase success]', async () => {
  //         // Will change to bid phase after mining 10 blocks.
  //         await utils.mineBlocks(10)
  //         await contractInstance.setStrikePrice(696)
  //
  //         chainsaw.turnOnPolling(async function (error, response) {
  //           console.log('Polling response is here', response)
  //           if (!error) {
  //             const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
  //             const expectedArgs = response[0][0]
  //             const chainId = 1
  //             await scoAuction.insertAuctionEvent(chainId, expectedArgs)
  //             queryOne.callsArgWithAsync(2, 'res', SQL`
  //               SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
  //             queryOne.restore()
  //           }
  //         })
  //       })
  //     })
  //
  //     describe.skip('ProcessBidEvent', () => {
  //       it('[processBid: One contract method call]', async () => {
  //         const tokenBidPriceInWei = 696
  //         const bidWeiAmount = 1000
  //         // Get v, r, s
  //         const ret = await getSig(tokenBidPriceInWei, bidWeiAmount)
  //
  //         // Calling contract method processBid
  //         await contractInstance.processBid(
  //         tokenBidPriceInWei,
  //         bidWeiAmount,
  //         1,
  //         ret.v,
  //         ret.r,
  //         ret.s)
  //
  //         chainsaw.turnOnPolling(async function (error, response) {
  //           console.log('Polling response is here', response)
  //
  //           if (!error) {
  //             const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
  //             const expectedArgs = response[0][0]
  //             const chainId = 1
  //             await scoAuction.insertAuctionEvent(chainId, expectedArgs)
  //             queryOne.callsArgWithAsync(2, 'res', SQL`
  //               SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
  //             queryOne.restore()
  //           }
  //         })
  //       })
  //     })
  //
  //     describe.skip('AuctionSuccessEvent', () => {
  //       it('[completeSuccessfulAuction: One contract method call]', async () => {
  //       //  await mineBlocks(1000)
  //         console.log('Auction Success Event => ')
  //         await contractInstance.completeSuccessfulAuction()
  //         chainsaw.turnOnPolling(async function (error, response) {
  //           console.log('Polling response is here', response)
  //
  //           if (!error) {
  //             const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
  //             const expectedArgs = response[0][0]
  //             const chainId = 1
  //             await scoAuction.insertAuctionEvent(chainId, expectedArgs)
  //             queryOne.callsArgWithAsync(2, 'res', SQL`
  //               SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
  //             queryOne.restore()
  //           }
  //         })
  //       })
  //     })
  //
  //     describe.skip('WithdrawEvent', () => {
  //       before(async () => {
  //         // Before should have snapshot of auction complete phase
  //       })
  //       it('[withdraw: One contract method call]', async () => {
  //         await contractInstance.withdraw({ sender: web3.eth.accounts[0] })
  //
  //         chainsaw.turnOnPolling(async function (error, response) {
  //           console.log('Polling response is here', response)
  //
  //           if (!error) {
  //             const queryOne = sinon.stub(scoAuction, 'queryOne').resolves(true)
  //             const expectedArgs = response[0][0]
  //             const chainId = 1
  //             await scoAuction.insertAuctionEvent(chainId, expectedArgs)
  //             queryOne.callsArgWithAsync(2, 'res', SQL`
  //               SELECT insert_auction_event(${chainId}, ${expectedArgs});`)
  //             queryOne.restore()
  //           }
  //         })
  //       })
  //     })
  //   })
  // })
})
