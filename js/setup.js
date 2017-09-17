import fs from 'fs'
import p from 'es6-promisify'
import TestRPC from 'ethereumjs-testrpc'
import solc from 'solc'
import Eth from 'ethjs-query'
import EthContract from 'ethjs-contract'
import Web3 from 'web3'
import HttpProvider from 'ethjs-provider-http'

const SOL_PATH = __dirname + '/../contracts/'
const TESTRPC_PORT = 8545
const MNEMONIC = 'elegant ability lawn fiscal fossil general swarm trap bind require exchange ostrich'
const DEFAULT_CONTRACT = 'StubPaymentChannel.sol'

// opts
// testRPCServer - if true, starts a testRPC server
// mnemonic - seed for accounts
// port - testrpc port
// noDeploy - if true, skip auction contract deployment
// testRPCProvider - http connection string for console testprc instance
// defaultContract - default contract to deploy .
export default async function (opts) {
  opts = opts || {}
  const mnemonic = opts.mnemonic || MNEMONIC
  const testRPCServer = opts.testRPCServer
  const port = opts.port || TESTRPC_PORT
  const noDeploy = opts.noDeploy
  const defaultAcct = opts.defaultAcct ? opts.defaultAcct : 0
  const defaultContract = opts.defaultContract || DEFAULT_CONTRACT
//  const input = opts.input || {defaultContract: fs.readFileSync(SOL_PATH + defaultContract).toString()}
  const defaultContractFormat = `${defaultContract}:` + defaultContract.slice(0, defaultContract.indexOf('.'))

  // START TESTRPC PROVIDER
  let provider
  if (opts.testRPCProvider) {
    provider = new HttpProvider(opts.testRPCProvider)
  } else {
    provider = TestRPC.provider({
      mnemonic: mnemonic
    })
  }
  // START TESTRPC SERVER
  if (opts.testRPCServer) {
    console.log('setting up testrpc server')
    await p(TestRPC.server({
      mnemonic: mnemonic
    }).listen)(port)
  }

  // BUILD ETHJS ABSTRACTIONS
  const eth = new Eth(provider)
  const contract = new EthContract(eth)
  const accounts = await eth.accounts()

  // COMPILE THE CONTRACT
  const input = {}
  input[defaultContract] = fs.readFileSync(SOL_PATH + defaultContract).toString()
  const output = solc.compile({ sources: input }, 1)
  if (output.errors) { console.log(Error(output.errors)) }

  const abi = JSON.parse(output.contracts[defaultContractFormat].interface)
  const bytecode = output.contracts[defaultContractFormat].bytecode

  // PREPARE THE CONTRACT ABSTRACTION OBJECT
  const contractInstance = contract(abi, bytecode, {
    from: accounts[defaultAcct],
    gas: 3000000
  })
  let contractTxHash, contractReceipt, contractObject
  if (!noDeploy) {
    // DEPLOY THE CONTRACT
    contractTxHash = await contractInstance.new()
    await wait(1500)
    // USE THE ADDRESS FROM THE TX RECEIPT TO BUILD THE CONTRACT OBJECT
    contractReceipt = await eth.getTransactionReceipt(contractTxHash)
    contractObject = contractInstance.at(contractReceipt.contractAddress)
  }

  // MAKE WEB3
  const web3 = new Web3()
  web3.setProvider(provider)
  web3.eth.defaultAccount = accounts[0]

  return contractObject
}

export async function setupAuction (opts) {
  opts = opts || {}
  const mnemonic = opts.mnemonic || MNEMONIC
  const testRPCServer = opts.testRPCServer
  const port = opts.port || TESTRPC_PORT
  const noDeploy = opts.noDeploy
  const defaultAcct = opts.defaultAcct ? opts.defaultAcct : 0
  const defaultContract = opts.defaultContract || DEFAULT_CONTRACT
  const input = opts.input || {defaultContract: fs.readFileSync(SOL_PATH + defaultContract).toString()}
  const constructParams = opts.constructParams || {}
  const defaultContractFormat = `${defaultContract}:` + defaultContract.slice(0, defaultContract.indexOf('.'))

  console.log('print opts', opts)
  // START TESTRPC PROVIDER
  let provider
  if (opts.testRPCProvider) {
    provider = new HttpProvider(opts.testRPCProvider)
  } else {
    console.log('Provider with mnemonic is set')
    provider = TestRPC.provider({
      mnemonic: mnemonic
    })
  }
  // START TESTRPC SERVER
  if (opts.testRPCServer) {
    console.log('Testrpc server startin manually')
    await p(TestRPC.server({
      mnemonic: mnemonic
    }).listen)(port)
  }

  // BUILD ETHJS ABSTRACTIONS
  const eth = new Eth(provider)
  const contract = new EthContract(eth)
  const accounts = await eth.accounts()

  // COMPILE THE CONTRACT
  // const input = {}
  // input[defaultContract] = fs.readFileSync(SOL_PATH + defaultContract).toString()
  const output = solc.compile({ sources: input }, 1)
  if (output.errors) { console.log(Error(output.errors)) }

  const abi = JSON.parse(output.contracts[defaultContractFormat].interface)
  const bytecode = output.contracts[defaultContractFormat].bytecode

  // PREPARE THE CONTRACT ABSTRACTION OBJECT
  const contractInstance = contract(abi, bytecode, {
    from: accounts[defaultAcct],
    gas: 3000000
  })
  let contractTxHash, contractReceipt, contractObject
  if (!noDeploy) {
    // DEPLOY THE AUCTION CONTRACT
    contractTxHash = await contractInstance.new(
      constructParams['tokenSupply'],
      constructParams['tokenName'],
      constructParams['tokenDecimals'],
      constructParams['tokenSymbol'],
      constructParams['weiWallet'],
      constructParams['tokenWallet'],
      constructParams['minDepositInWei'],
      constructParams['minWeiToRaise'],
      constructParams['maxWeiToRaise'],
      constructParams['minTokensForSale'],
      constructParams['maxTokensForSale'],
      constructParams['maxTokenBonusPercentage'],
      constructParams['depositWindowInBlocks'],
      constructParams['processingWindowInBlocks']
    )
    await wait(1500)
    // USE THE ADDRESS FROM THE TX RECEIPT TO BUILD THE CONTRACT OBJECT
    contractReceipt = await eth.getTransactionReceipt(contractTxHash)
    contractObject = contractInstance.at(contractReceipt.contractAddress)
  }

  // MAKE WEB3
  const web3 = new Web3()
  web3.setProvider(provider)
  web3.eth.defaultAccount = accounts[0]

  return contractObject
}

// async/await compatible setTimeout
// http://stackoverflow.com/questions/38975138/is-using-async-in-settimeout-valid
// await wait(2000)
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
