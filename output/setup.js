'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setupAuction = undefined;

let setupAuction = exports.setupAuction = (() => {
  var _ref2 = _asyncToGenerator(function* (opts) {
    opts = opts || {};
    const mnemonic = opts.mnemonic || MNEMONIC;
    const testRPCServer = opts.testRPCServer;
    const port = opts.port || TESTRPC_PORT;
    const noDeploy = opts.noDeploy;
    const defaultAcct = opts.defaultAcct ? opts.defaultAcct : 0;
    const defaultContract = opts.defaultContract || DEFAULT_CONTRACT;
    const input = opts.input || { defaultContract: _fs2.default.readFileSync(SOL_PATH + defaultContract).toString() };
    const constructParams = opts.constructParams || {};
    const defaultContractFormat = `${defaultContract}:` + defaultContract.slice(0, defaultContract.indexOf('.'));

    // START TESTRPC PROVIDER
    let provider;
    if (opts.testRPCProvider) {
      provider = new _ethjsProviderHttp2.default(opts.testRPCProvider);
    } else {
      provider = _ethereumjsTestrpc2.default.provider({
        mnemonic: mnemonic
      });
    }
    // START TESTRPC SERVER
    if (opts.testRPCServer) {
      console.log('setting up testrpc server');
      yield (0, _es6Promisify2.default)(_ethereumjsTestrpc2.default.server({
        mnemonic: mnemonic
      }).listen)(port);
    }

    // BUILD ETHJS ABSTRACTIONS
    const eth = new _ethjsQuery2.default(provider);
    const contract = new _ethjsContract2.default(eth);
    const accounts = yield eth.accounts();

    // COMPILE THE CONTRACT
    // const input = {}
    // input[defaultContract] = fs.readFileSync(SOL_PATH + defaultContract).toString()
    const output = _solc2.default.compile({ sources: input }, 1);
    if (output.errors) {
      console.log(Error(output.errors));
    }

    const abi = JSON.parse(output.contracts[defaultContractFormat].interface);
    const bytecode = output.contracts[defaultContractFormat].bytecode;

    // PREPARE THE CONTRACT ABSTRACTION OBJECT
    const contractInstance = contract(abi, bytecode, {
      from: accounts[defaultAcct],
      gas: 3000000
    });
    let contractTxHash, contractReceipt, contractObject;
    if (!noDeploy) {
      // DEPLOY THE AUCTION CONTRACT
      contractTxHash = yield contractInstance.new(constructParams['tokenSupply'], constructParams['tokenName'], constructParams['tokenDecimals'], constructParams['tokenSymbol'], constructParams['weiWallet'], constructParams['tokenWallet'], constructParams['minDepositInWei'], constructParams['minWeiToRaise'], constructParams['maxWeiToRaise'], constructParams['minTokensForSale'], constructParams['maxTokensForSale'], constructParams['maxTokenBonusPercentage'], constructParams['depositWindowInBlocks'], constructParams['processingWindowInBlocks']);
      yield wait(1500);
      // USE THE ADDRESS FROM THE TX RECEIPT TO BUILD THE CONTRACT OBJECT
      contractReceipt = yield eth.getTransactionReceipt(contractTxHash);
      contractObject = contractInstance.at(contractReceipt.contractAddress);
    }

    // MAKE WEB3
    const web3 = new _web2.default();
    web3.setProvider(provider);
    web3.eth.defaultAccount = accounts[0];

    return contractObject;
  });

  return function setupAuction(_x2) {
    return _ref2.apply(this, arguments);
  };
})();

// async/await compatible setTimeout
// http://stackoverflow.com/questions/38975138/is-using-async-in-settimeout-valid
// await wait(2000)


var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _es6Promisify = require('es6-promisify');

var _es6Promisify2 = _interopRequireDefault(_es6Promisify);

var _ethereumjsTestrpc = require('ethereumjs-testrpc');

var _ethereumjsTestrpc2 = _interopRequireDefault(_ethereumjsTestrpc);

var _solc = require('solc');

var _solc2 = _interopRequireDefault(_solc);

var _ethjsQuery = require('ethjs-query');

var _ethjsQuery2 = _interopRequireDefault(_ethjsQuery);

var _ethjsContract = require('ethjs-contract');

var _ethjsContract2 = _interopRequireDefault(_ethjsContract);

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _ethjsProviderHttp = require('ethjs-provider-http');

var _ethjsProviderHttp2 = _interopRequireDefault(_ethjsProviderHttp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const SOL_PATH = __dirname + '/../contracts/';
const TESTRPC_PORT = 8545;
const MNEMONIC = 'elegant ability lawn fiscal fossil general swarm trap bind require exchange ostrich';
const DEFAULT_CONTRACT = 'StubPaymentChannel.sol';

// opts
// testRPCServer - if true, starts a testRPC server
// mnemonic - seed for accounts
// port - testrpc port
// noDeploy - if true, skip auction contract deployment
// testRPCProvider - http connection string for console testprc instance
// defaultContract - default contract to deploy .

exports.default = (() => {
  var _ref = _asyncToGenerator(function* (opts) {
    opts = opts || {};
    const mnemonic = opts.mnemonic || MNEMONIC;
    const testRPCServer = opts.testRPCServer;
    const port = opts.port || TESTRPC_PORT;
    const noDeploy = opts.noDeploy;
    const defaultAcct = opts.defaultAcct ? opts.defaultAcct : 0;
    const defaultContract = opts.defaultContract || DEFAULT_CONTRACT;
    //  const input = opts.input || {defaultContract: fs.readFileSync(SOL_PATH + defaultContract).toString()}
    const defaultContractFormat = `${defaultContract}:` + defaultContract.slice(0, defaultContract.indexOf('.'));

    // START TESTRPC PROVIDER
    let provider;
    if (opts.testRPCProvider) {
      provider = new _ethjsProviderHttp2.default(opts.testRPCProvider);
    } else {
      provider = _ethereumjsTestrpc2.default.provider({
        mnemonic: mnemonic
      });
    }
    // START TESTRPC SERVER
    if (opts.testRPCServer) {
      console.log('setting up testrpc server');
      yield (0, _es6Promisify2.default)(_ethereumjsTestrpc2.default.server({
        mnemonic: mnemonic
      }).listen)(port);
    }

    // BUILD ETHJS ABSTRACTIONS
    const eth = new _ethjsQuery2.default(provider);
    const contract = new _ethjsContract2.default(eth);
    const accounts = yield eth.accounts();

    // COMPILE THE CONTRACT
    const input = {};
    input[defaultContract] = _fs2.default.readFileSync(SOL_PATH + defaultContract).toString();
    const output = _solc2.default.compile({ sources: input }, 1);
    if (output.errors) {
      console.log(Error(output.errors));
    }

    const abi = JSON.parse(output.contracts[defaultContractFormat].interface);
    const bytecode = output.contracts[defaultContractFormat].bytecode;

    // PREPARE THE CONTRACT ABSTRACTION OBJECT
    const contractInstance = contract(abi, bytecode, {
      from: accounts[defaultAcct],
      gas: 3000000
    });
    let contractTxHash, contractReceipt, contractObject;
    if (!noDeploy) {
      // DEPLOY THE CONTRACT
      contractTxHash = yield contractInstance.new();
      yield wait(1500);
      // USE THE ADDRESS FROM THE TX RECEIPT TO BUILD THE CONTRACT OBJECT
      contractReceipt = yield eth.getTransactionReceipt(contractTxHash);
      contractObject = contractInstance.at(contractReceipt.contractAddress);
    }

    // MAKE WEB3
    const web3 = new _web2.default();
    web3.setProvider(provider);
    web3.eth.defaultAccount = accounts[0];

    return contractObject;
  });

  return function (_x) {
    return _ref.apply(this, arguments);
  };
})();

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));