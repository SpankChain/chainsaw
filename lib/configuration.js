//const Web3 = require('/Users/yogeshsrihari/blockchain_loan/web3.js/lib/web3');
const Web3 = require('web3');
const fs = require('fs');
const solc = require('solc');
// Connect to mongo
const mongojs = require('mongojs');
const config = require(`${__dirname}/../config.json`);

// Initialization values
const MONGO_URL = config.MONGO_URL ;
const SOLIDTY_CONTRACT_SRC = `${__dirname}/../../hub/${config.SOLIDTY_CONTRACT_SRC}`;
const TESTRPC_PROVIDER = config.WEB3_PROVIDER;
const CONTRACT_ADDRESS = config.CONTRACT_ADDRESS;

// Local mongo url
const db = mongojs(MONGO_URL,['events']);

const ProviderEngine = require('web3-provider-engine/index.js');
const ZeroClientProvider = require('web3-provider-engine/zero.js');


const engine = ZeroClientProvider({
  getAccounts: function(){},
  rpcUrl: 'https://rinkeby.infura.io/R3pIiVvLicNLNQfqbF5s', //RANDOM ID, TO GET A REAL ONE, REGISTER AT INFURA.IO
})


// Export web3 object
let web3 = new Web3(engine);

const createContract = () => {
  let source = fs.readFileSync(SOLIDTY_CONTRACT_SRC, 'utf-8')

  let compiledContract = solc.compile(source, 1)

  //console.log("compiledContract", compiledContract)
  let abi = compiledContract.contracts[':Broker'].interface
  let bytecode = "0x" + compiledContract.contracts[':Broker'].bytecode;
  // let gasEstimate = web3.eth.estimateGas({
  //   data: bytecode
  // });

  let deployableContract = web3.eth.contract(JSON.parse(abi));

  contractInfo = {
    'contract': deployableContract,
    'gasEstimate': 21000,//gasEstimate,
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
