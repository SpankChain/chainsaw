import { Chainsaw } from './chainsaw.js'
import { assert, expect } from 'chai'
import { setupAuction } from './setup'
import { SCOAuction } from '../../auction/database/sco-auction.js'
import p from 'es6-promisify'

const Web3 = require('web3')
const BN = require('bn.js')
const express = require('express')
const solc = require('solc')
const fs = require('fs')
const app = express()
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const spinner = require(`simple-spinner`)
const ethUtil = require('ethereumjs-util')
const abi = require('ethereumjs-abi')
const _pga = require('pg-async')
const [PgAsync, SQL] = [_pga['default'], _pga.SQL]

let chainsaw
let contractInstance
let scoAuction

// Saves all the events tests assertion
let events = []

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const getSig = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999, depositFromAccount = web3.eth.accounts[0]) => {
  const msgHash = `0x${abi.soliditySHA3(['address', 'uint', 'uint'], [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`

  const sig = web3.eth.sign(depositFromAccount, msgHash)
  const {v, r, s} = ethUtil.fromRpcSig(sig)
  // console.log('r , s , v', r, s, v)

  // const pubKey = ethUtil.ecrecover(ethUtil.toBuffer(msgHash), v, r, s)
  // // console.log('pubKey', pubKey)
  // const addrBuf = ethUtil.pubToAddress(pubKey)
  // const addr = ethUtil.bufferToHex(addrBuf)
  return {v, r, s}
}

const chainLogEvents = async (error, response) => {
  if (!error && response.length > 0) {
    // Insert the auction to database
    events.push(response[0][0])
    await scoAuction.insertAuctionEvent(response[0][0])
  }
}
export const mineBlock = () => {
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

const assertDB = async () => {
  const sqlRows = await scoAuction.query(SQL`SELECT * FROM auction_events`)
  for (let i = 0; i < sqlRows.length; i++) {
    assert.equal(sqlRows[i].contract_address, events[i].contractAddress)
    assert.equal(sqlRows[i].sender, events[i].sender)
    assert.equal(sqlRows[i].block_hash, events[i].blockHash)
    assert.equal(sqlRows[i].block_number, events[i].blockNumber)
    assert.equal(sqlRows[i].block_is_valid, true)
  }
}

const simulateAuction = async () => {
  spinner.start()
  console.log('Start Running tests')
  await scoAuction.query(SQL`delete from auction_events`)
  const depositIndex = 4
  let totalDeposit = 0
  let accountDeposits = {}
  let strikePrice = 1000

  // Start Auction
  console.log(`\x1b[33m`, '1. Start Auction:')
  await contractInstance.startAuction()

  // Do a bunch of deposits
  console.log(`\x1b[33m`, '2. Deposit Phase :')
  for (let i = 1; i <= depositIndex; i++) {
    const randDeposit = randomIntFromInterval(1000, 10000)
    await contractInstance.deposit({
      from: web3.eth.accounts[i],
      value: randDeposit })
    console.log(`\x1b[32m`, `=> ${i} Deposit Successful => `, web3.eth.accounts[i], randDeposit)
    totalDeposit += randDeposit
    accountDeposits[web3.eth.accounts[i]] = randDeposit
  }

  // Mine blocks to move processing phase
  await mineBlocks(10)

  console.log(`\x1b[33m`, `3. In Bid Processing Phase + Set Strike Price`)
  // Set the Strike price
  await contractInstance.setStrikePrice(strikePrice)
  console.log(`\x1b[32m`, ` => SetStrikePrice Successful`, strikePrice)

  // ProcessAll Bids
  console.log(`\x1b[33m`, '4. Bid Processing Phase - Process Bids')
  let bidIndex = 1
  while (bidIndex <= depositIndex) {
    const bidWeiAmount = randomIntFromInterval(strikePrice,
      accountDeposits[web3.eth.accounts[bidIndex]])
    const tokenBidPriceInWei = randomIntFromInterval(strikePrice, bidWeiAmount)
    const sig = await getSig(tokenBidPriceInWei, bidWeiAmount, web3.eth.accounts[bidIndex])
    await contractInstance.processBid(
    tokenBidPriceInWei,
    bidWeiAmount,
    1,
    sig.v,
    sig.r,
    sig.s)

    console.log(`\x1b[32m`, ` => Bid Processed successfully for =>`, web3.eth.accounts[bidIndex], tokenBidPriceInWei, bidWeiAmount)
    bidIndex++
  }

  console.log(`\x1b[33m`, '5. Auction Complete Succesful')
  // Complete the successful auction.
  await contractInstance.completeSuccessfulAuction()
  console.log(`\x1b[32m`, ` => Auction completed succesfully`)

  console.log(`\x1b[33m`, '5. Withdraw Remaining funds')
  let withdrawIndex = 1
  // Withdrawing all the remaining deposits
  while (withdrawIndex <= depositIndex) {
    await contractInstance.withdraw({from: web3.eth.accounts[withdrawIndex]})
    console.log(`\x1b[32m`, ` => Withdraw succesful for account ${withdrawIndex} `, web3.eth.accounts[withdrawIndex])
    withdrawIndex++
  }

  // Assert the DB Values
  assertDB()
  console.log('Assertion is done ')
  spinner.stop()
}

const init = async () => {

  return new Promise(async(accept) => {
    const inputContracts = {
      'SafeMath.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/SafeMath.sol`).toString(),
      'Token.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Token.sol`).toString(),
      // 'IERC20Token.sol': fs.readFileSync(`${__dirname}/../../auction/contracts/ccontracts/IERC20Token.sol`).toString(),
      'StandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/StandardToken.sol`).toString(),
      'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/HumanStandardToken.sol`).toString(),
      'Auction.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Auction.sol`).toString()
    }

    const deployParams = {
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

    spinner.start([10])
    console.log('\x1b[36m', 'Deploying Auction contract')
    contractInstance = await setupAuction({
      testRPCProvider: 'http://localhost:8545/',
      defaultContract: 'Auction.sol',
      input: inputContracts,
      constructParams: deployParams
    })

    // Setup Chainsaw
    console.log('\x1b[32m', 'Setting up Chainsaw - Initializing')
    chainsaw = new Chainsaw(web3, [contractInstance.address], 0)
    chainsaw.addABI(contractInstance.abi)

   // Database setup
    console.log('\x1b[33m', 'Initializing and setting up database', '\x1b[37m')
    const TEST_DB = { host: 'localhost', database: 'auction' }
    scoAuction = new SCOAuction(TEST_DB)
    console.log(`\x1b[35m`, 'Initialization Complete\n',
    `Use "curl http://localhost:3000/simulateContractCalls" to run testrunner\n`,
    `Use "curl http://localhost:3000/assertDatabase\n" after that assert database values`)
    console.log('\x1b[37m')

    // Chainsaw turn on polling
    chainsaw.turnOnPolling(chainLogEvents)
    spinner.stop()

    simulateAuction()
    accept()
  })
}

// Initialization of the auction contract
init()

app.listen(3000, function () {
  console.log('Auction Contract Deployment')
})
