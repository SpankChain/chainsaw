import { Chainsaw } from './chainsaw.js'
import { assert, expect } from 'chai'
import { setupAuction } from './setup'
import { SCOAuction } from '../../auction/database/sco-auction.js'
import p from 'es6-promisify'

const Web3 = require('web3')
const BN = require('bn.js')
const express = require('express')
const fs = require('fs')
const JSONStream = require('JSONStream')
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
let inputData

// Saves all the events tests assertion
let events = []

// Array of tuple (publicKey , privateKey)
const keyPairs = [
['0x7d3f760e02168e26b33029d72951f2116f42720f', 'a5fbd3ad7301b5cd7d97d620b14f1b1cb16215957514db31f2508490d02acc1f'],
['0xbd926d9a9b6ee60f79a12f051d224a1bcba6070a', '6a4fce0774831de3317a7951c60ba91f558fe6dc17a9799d6f01a6cb220b3ec0'],
['0x4a5bf7e019b4506f7033b11aa59952f0a05cf3ec', 'fcd37bc17e62589a6c6f31b02258d89efec6c396fa5a0be86607c071305a568f'],
['0xf53bc59d6db484611d52fb8a9305abca10c69631', 'd18e7d0b2f4f0d74249436c35f59863507613384dd6f1564945d94fb8b467dfe'],
['0x4153c6964fe976872658be4952fc53cb703d7e05', '7d04f75e12fe017ff5be215950c6b8eb195eff563a5a0768ab2c731b03b49d7e'],
['0x78d510b0678f5d8d8cad7b55f32707520f6c31ff', '138acfea95c9f411e6d47749bcd3d24a8b6633e0529738b1ea0aef3f1b7a47e7'],
['0xc285f18925b7cbfc7d3e677bb87bd5e9f6ed063f', 'c30be6e1e9b3fa31d9d5a9d3f4dc4e3a1a9a78b0a3e8edf7fccb9dfcb12ea4d1'],
['0x12cbd4a135c4b5422ee8d7abd2fcb63d994a5d83', '38ff77940cca25c48ae2cb52589d5c466fbadb3ab82e5cc9629e1b8f5224319c'],
['0x2ceba0bad235c6316a5646caa3fb5f2a47d291fe', 'f95a067f09f6c852f6d3fac00393cc54acf1a070fd5e4c0c7b1d81a882999648'],
['0x70dfd9b434718c10ddfbf481a38d98fdd534b68f', '9706ad9bdcf68175b83aae1809b734640bc0b312ec5862ac8b3df2e659299c08'],
['0x83eed9463199719a000f407a02f425d9b9246bfa', '4acfef73ed3f5d3a365c493ff709db85d77cae4f1584d768533fbe5700236380'],
['0x3bdfb4c50dd90821076916790be4a3d1b70d7862', 'c11182987e5e2bd26a47c678b78482222e773f0a35f48fed7f2fef78761b6896'],
['0x02c4c0e92d6ff26658d67b87d952aa7cb53d407e', '0da415c8239023bc1d7f6baee93dc405a810f04b8310d128cd54ea7e69ef963a'],
['0x4a976be0519caf02fdffb3bd65e6957be4eb64ec', 'c29564cbc2fbba292cbbd8de51d70387369be1f0ccebd783dc91e9c086906e34'],
['0x6b4498a9b33cb0fcbd15274c9fd6a1ccbd7e7070', 'ff482190fd0d57470e9d6fde0d7b68a6a69a83357a870b608898d973b39234be'],
['0x54780695e02391d79da4f65a08925b7a42fb2c4f', '9e52e6d3b21fd959a5c20dae66b4de6d065a4bfa28e759e80d2a7caa9b30f63b'],
['0x032ec797479df61a77b42b8194dc8ff322d1658d', '4d44ebcf152a8ac9d206be32de38bc50fa041fafd8c26bfa6e960a708e8f38fe'],
['0x9ce79dd9341bdef1c103f85f74c72c11791aa89d', '9c72f3170dd72a5ed3cfac3599f2802f8b1fb073fb484702bc4420b98cc2cc88'],
['0x666f1fa6e63236c63e0c00a41d4ea8f6e979e0e1', 'b4dd7270b0eba995b316f867a9f6bcaac7714ba4feb6c3f17ff7235c04e61121'],
['0x84cf3849a167f4f665b7b3fb2397675ac2fa8f80', '06790df521f31d81510f2d0ee71cdd0327c89827ffd1e7beccd288b24e20793d'],
['0x94b52ff598d13bfb6d3146fad9a1ddd6acb7adcc', 'b9bbd7e7df81151bb487cec748027b70af27a5fb98c66cd011536b513cb8ba9f'],
['0xcca12c120c1ad5455cc7b93b1091212a87587d7a', '466f7ff8e911f6fb645a010674a57d1cedc414e21e317bbc677ac1ba9d3acdc6'],
['0x19cc34da4c59bff14f97127bee6602d73ec1b281', '1562ea0c166f3475a1b538ba5491b5aa1ae3a5b00242eac52e7804bdb8adf0ad'],
['0x8aace3feb1376345946f17805ab329311cfbeda9', 'eedb79f3313a80236ca1fc8d6554610b6aa6c73dc727d9b878c684ef520c079c'],
['0x5b60ad1c6add3c16622af39276e99b0b2b169b15', '3fd3eba813b3119fcc5c059b389a529159e9fe6f124690b3d53e847666ae2c51'],
['0x688a783cd8f1643a798265b39358a0101f963c97', '53b5e8479d668f5a51d2a8f05b2d9c31458479085d6082ce64c35e648b28b5f1'],
['0x70e18145b11b89cf81607ed55193b1e5c857fcf8', 'a6b022070087a0137940a06f5d58b11a5cae0cde9e90772a63f017af52438cf9'],
['0xfe6e50df6b165e9c9f99084afa6a5f52ae8b32b0', '00a5de83250091883dbc673ec76c428a1eb63d3fab87d61d67b876cf12d27b8b'],
['0x08b1b9d8199605e09e9758495cb3ca2b3bff4e40', 'e89ab82a0915d6a17acb5b81ba0d223df2988f67e711b2e11083d6e38a54b09d'],
['0xd191732020f5f5050d85e4e1ffacc508fcf9e1d1', 'afb29529639d5e2d8e70f1b8af42cd3c59eb213d9ca28d31496be0c3a2738f02']
]

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

    readSimulatedData()
    const simulateDeployParams = JSON.parse(inputData[0])
    console.log('simulated ::', simulateDeployParams.args._minDepositInWei)
    const phaseWindow = JSON.parse(inputData[1])

    // const deployParams = {
    //   'tokenSupply': 1000000000,
    //   'tokenName': 'TESTRPCTOKEN',
    //   'tokenDecimals': 9,
    //   'tokenSymbol': 'TST',
    //   'weiWallet': web3.eth.accounts[28],
    //   'tokenWallet': web3.eth.accounts[29],
    //   'minDepositInWei': new BN(simulateDeployParams.args._minDepositInWei),
    //   'minWeiToRaise': new BN(simulateDeployParams.args._minWeiToRaise),
    //   'maxWeiToRaise': new BN(simulateDeployParams.args._maxWeiToRaise), // 69 Million at eth = $300
    //   'minTokensForSale': simulateDeployParams.args._minTokensForSale,
    //   'maxTokensForSale': simulateDeployParams.args._maxTokensForSale,
    //   'maxTokenBonusPercentage': 40,
    //   'depositWindowInBlocks': phaseWindow.args.depositWindowInBlocks,
    //   'processingWindowInBlocks': phaseWindow.args.processingWindowInBlocks
    // }
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
    console.log('\x1b[36m', 'Deploying Auction contract', '\x1b[37m')
    contractInstance = await setupAuction({
      testRPCProvider: 'http://localhost:8545/',
      defaultContract: 'Auction.sol',
      input: inputContracts,
      constructParams: deployParams
    })

    console.log('contractInstance', contractInstance)

    // Setup Chainsaw
    console.log('\x1b[32m', 'Setting up Chainsaw - Initializing', '\x1b[37m')
    chainsaw = new Chainsaw(web3, [contractInstance.address], 0)
    chainsaw.addABI(contractInstance.abi)

   // Database setup
    console.log('\x1b[33m', 'Initializing and setting up database', '\x1b[37m')
    const TEST_DB = { host: 'localhost', database: 'auction' }
    scoAuction = new SCOAuction(TEST_DB)
    console.log(`\x1b[35m`, 'Initialization Complete\n', '\x1b[37m')

    // Chainsaw turn on polling
    chainsaw.turnOnPolling(chainLogEvents)
    spinner.stop()

    //simulateAuctionUsingData()
    simulateAuction()
    accept()
  })
}

app.listen(3000, function () {
  console.log('Auction Contract Deployment')
})

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const getSig = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999, depositFromAccount = keyPairs[0][0], privKey = keyPairs[0][1]) => {
  const msgHash = `0x${abi.soliditySHA3(['address', 'uint', 'uint'], [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`
  //const msgHash = ethUtil.sha3('hello')
  const sig = ethUtil.ecsign(ethUtil.toBuffer(msgHash), Buffer.from(privKey, 'hex'))

  // Test ecrecovering the right pub key.
  // const pubKey = ethUtil.ecrecover(ethUtil.toBuffer(msgHash), sig.v, sig.r, sig.s)
  // // console.log('pubKey', pubKey)
  // const addrBuf = ethUtil.pubToAddress(pubKey)
  // const addr = ethUtil.bufferToHex(addrBuf)
  // console.log('Addresses are same', keyPairs[0][0], addr)

  return sig
}

const chainLogEvents = async (error, response) => {
  if (!error && response.length > 0) {
    // Insert the auction event to database
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
    console.log('\x1b[31m', 'sqlRows', sqlRows[i], '\x1b[37m')
    console.log('\x1b[32m', 'events', events[i], '\x1b[37m')
    assert.equal(sqlRows[i].contract_address, events[i].contractAddress)
    assert.equal(sqlRows[i].sender, events[i].sender)
    // assert.equal(sqlRows[i].block_hash, events[i].blockHash)
    assert.equal(sqlRows[i].block_number, events[i].blockNumber)
    assert.equal(sqlRows[i].block_is_valid, true)
    assert.deepEqual(sqlRows[i].fields, events[i].fields)
  }
}

const readSimulatedData = async () => {
  inputData = fs.readFileSync(`${__dirname}/input.json`).toString().split('\n')
}

const simulateAuction = async () => {
  spinner.start()
  await scoAuction.query(SQL`delete from auction_events`)
  const depositIndex = 1
  let totalDeposit = 0
  let accountDeposits = {}
  let strikePrice = 1000

  // Start Auction
  console.log(`\x1b[33m`, '1. Start Auction:', '\x1b[37m')
  await contractInstance.startAuction()

  // Do a bunch of deposits
  console.log(`\x1b[33m`, '2. Deposit Phase :', '\x1b[37m')
  for (let i = 1; i <= depositIndex; i++) {
    const randDeposit = randomIntFromInterval(1000, 10000)
    await contractInstance.deposit({
      from: web3.eth.accounts[i],
      value: randDeposit })
    console.log(`\x1b[32m`, `=> ${i} Deposit Successful => `, web3.eth.accounts[i], randDeposit)
    totalDeposit += randDeposit
    accountDeposits[web3.eth.accounts[i]] = randDeposit
  }

  // Mine blocks to move to processing phase
  await mineBlocks(10)

  console.log(`\x1b[33m`, `3. In Bid Processing Phase + Set Strike Price`, '\x1b[37m')
  // Set the Strike price
  await contractInstance.setStrikePrice(strikePrice)
  console.log(`\x1b[32m`, ` => SetStrikePrice Successful`, strikePrice, '\x1b[37m')

  // ProcessAll Bids
  console.log(`\x1b[33m`, '4. Bid Processing Phase - Process Bids', '\x1b[37m')
  let bidIndex = 1
  while (bidIndex <= depositIndex) {
    const bidWeiAmount = randomIntFromInterval(strikePrice,
      accountDeposits[web3.eth.accounts[bidIndex]])
    const tokenBidPriceInWei = randomIntFromInterval(strikePrice, bidWeiAmount)
    const sig = await getSig(tokenBidPriceInWei, bidWeiAmount, web3.eth.accounts[bidIndex], keyPairs[bidIndex][1])
    await contractInstance.processBid(tokenBidPriceInWei, bidWeiAmount, 1, sig.v, sig.r, sig.s)

    console.log(`\x1b[32m`, ` => Bid Processed successfully for =>`, web3.eth.accounts[bidIndex], tokenBidPriceInWei, bidWeiAmount, '\x1b[37m')
    bidIndex++
  }

  console.log(`\x1b[33m`, '5. Auction Complete Succesful', '\x1b[37m')
  // Complete the successful auction.
  await contractInstance.completeSuccessfulAuction()
  console.log(`\x1b[32m`, ` => Auction completed succesfully`, '\x1b[37m')

  console.log(`\x1b[33m`, '5. Withdraw Remaining funds', '\x1b[37m')
  let withdrawIndex = 1
  // Withdrawing all the remaining deposits
  while (withdrawIndex <= depositIndex) {
    await contractInstance.withdraw({from: web3.eth.accounts[withdrawIndex]})
    console.log(`\x1b[32m`, ` => Withdraw succesful for account ${withdrawIndex} `, web3.eth.accounts[withdrawIndex], '\x1b[37m')
    withdrawIndex++
  }

  await wait(1500)
  // Assert the DB Values
  assertDB()
  console.log('Assertion is done ', '\x1b[37m')
  spinner.stop()
}

const simulateAuctionUsingData = async () => {
  let index = 2
  while (index < inputData.length) {
    const call = JSON.parse(inputData[index])

    if (call.type === 'wait_blocks') {
      await mineBlocks(call.n)
      index++
      continue
    }

    if (call.type === 'call') {
      console.log('call ::', call)
      switch (call.func) {
        case 'depositInWEI' :
          console.log(`\x1b[32m`, `=>  Deposit Successful => `,
            call.sender, call.args.value, `\x1b[37m`)
          try {
            await contractInstance.deposit({
              from: '0x' + call.sender,
              value: call.args.value
            })
          } catch (error) {
            console.log(error)
          }

          break
        case 'processBid':
          await contractInstance.processBid(
            call.args.tokenBidPriceInWei,
            call.args.bidWeiAmount,
            call.args.tokenBonusPercentage,
            call.args.v,
            call.args.r,
            call.args.s
          )
          break
        case 'setStrikPrice':
          await contractInstance.setStrikPrice(call.args._strikePrice)
          break
        case 'completeSuccessfulAuction':
          await contractInstance.completeSuccessfulAuction()
          break
      }
    }
    index++
  }
}

// Initialization of the auction contract
init()
