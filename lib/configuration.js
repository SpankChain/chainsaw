const Web3 = require('web3');
const fs = require('fs');
const solc = require('solc');
// Connect to mongo
const mongojs = require('mongojs');
const config = require('../config.json');

// Initialization values
const MONGO_URL = config.MONGO_URL ;
const SOLIDTY_CONTRACT_SRC = config.SOLIDTY_CONTRACT_SRC;
const TESTRPC_PROVIDER = config.WEB3_PROVIDER;
const CONTRACT_ADDRESS = config.CONTRACT_ADDRESS;

// Local mongo url
const db = mongojs(MONGO_URL,['events']);

// Export web3 object
let web3 = new Web3(new Web3.providers.HttpProvider(TESTRPC_PROVIDER));

const createContract = () => {
  let source = fs.readFileSync(SOLIDTY_CONTRACT_SRC, 'utf-8')
  let compiledContract = solc.compile(source, 1)
  //console.log("compiledContract", compiledContract)
  let abi = compiledContract.contracts[':Broker'].interface
  let bytecode = "0x" + compiledContract.contracts[':Broker'].bytecode;
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
  web3: web3,
  db: db
}
