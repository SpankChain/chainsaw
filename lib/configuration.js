const Web3 = require('web3');
let web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
const fs = require('fs');
const solc = require('solc');

const createContract = () => {
  let source = fs.readFileSync('./contracts/contracts/StubPaymentChannel.sol', 'utf-8')
  let compiledContract = solc.compile(source, 1)
  //console.log("compiledContract", compiledContract)
  let abi = compiledContract.contracts[':StubPaymentChannel'].interface
  let bytecode = "0x" + compiledContract.contracts[':StubPaymentChannel'].bytecode;
  let gasEstimate = web3.eth.estimateGas({
    data: bytecode
  });

  let deployableContract = web3.eth.contract(JSON.parse(abi));

  contractInfo = {
    'contract': deployableContract,
    'gasEstimate': gasEstimate,
    'bytecode': bytecode
  }
  return contractInfo
}

const contractObject = () => {
  const contractData = createContract();

  return contractData['contract'];
}

module.exports = {
  contractObject: contractObject,
  web3: web3
}