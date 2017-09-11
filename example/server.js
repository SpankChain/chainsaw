import { Chainsaw } from './chainsaw.js'
import setup from './setup'
const Web3 = require('web3')

const express = require('express')
const solc = require('solc')
const fs = require('fs')
// TODO : Replace this with your auction contract .
const contractPath = `${__dirname}/../contracts/StubPaymentChannel.sol`

const app = express()
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

app.get('/', async function (req, res) {
  const contractInstance = await setup({
    testRPCProvider: 'http://localhost:8545/'
  })
  const content = fs.readFileSync(contractPath)
  const compiledContract = solc.compile(content.toString(), 1)
  const abi = compiledContract.contracts[':StubPaymentChannel'].interface
  const chainsaw = new Chainsaw(web3, [contractInstance.address], 0)
  chainsaw.addABI(JSON.parse(abi))

  await contractInstance.createChannel(web3.eth.accounts[2], '0x222342')
  await contractInstance.deposit('0x222342', {value: 20})

  chainsaw.turnOnPolling(function (error, response) {
    console.log('Chainsaw is here')
    if (!error) {
      console.log('Log response:', response)
    }
  })

  await contractInstance.deposit('0x222342', {value: 20})
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
