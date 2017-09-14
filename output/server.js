'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mineBlock = undefined;

var _chainsaw = require('./chainsaw.js');

var _chai = require('chai');

var _setup = require('./setup');

var _scoAuction = require('../../auction/database/sco-auction.js');

var _es6Promisify = require('es6-promisify');

var _es6Promisify2 = _interopRequireDefault(_es6Promisify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const Web3 = require('web3');
const BN = require('bn.js');
const express = require('express');
const solc = require('solc');
const fs = require('fs');
const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const spinner = require(`simple-spinner`);
const ethUtil = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const _pga = require('pg-async');
const [PgAsync, SQL] = [_pga['default'], _pga.SQL];

let chainsaw;
let contractInstance;
let scoAuction;

// Saves all the events tests assertion
let events = [];

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const getSig = (tokenBidPriceInWei = 696969696969696969, bidWeiAmount = 999999999999999999, depositFromAccount = web3.eth.accounts[0]) => {
  const msgHash = `0x${abi.soliditySHA3(['address', 'uint', 'uint'], [contractInstance.address, tokenBidPriceInWei, bidWeiAmount]).toString('hex')}`;

  const sig = web3.eth.sign(depositFromAccount, msgHash);
  const { v, r, s } = ethUtil.fromRpcSig(sig);
  // console.log('r , s , v', r, s, v)

  // const pubKey = ethUtil.ecrecover(ethUtil.toBuffer(msgHash), v, r, s)
  // // console.log('pubKey', pubKey)
  // const addrBuf = ethUtil.pubToAddress(pubKey)
  // const addr = ethUtil.bufferToHex(addrBuf)
  return { v, r, s };
};

const chainLogEvents = (() => {
  var _ref = _asyncToGenerator(function* (error, response) {
    if (!error && response.length > 0) {
      // Insert the auction to database
      events.push(response[0][0]);
      yield scoAuction.insertAuctionEvent(response[0][0]);
    }
  });

  return function chainLogEvents(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();
const mineBlock = exports.mineBlock = () => {
  return new Promise((() => {
    var _ref2 = _asyncToGenerator(function* (accept) {
      yield (0, _es6Promisify2.default)(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      });
      accept();
    });

    return function (_x3) {
      return _ref2.apply(this, arguments);
    };
  })());
};

const mineBlocks = count => {
  return new Promise((() => {
    var _ref3 = _asyncToGenerator(function* (accept) {
      let i = 0;
      while (i < count) {
        yield mineBlock();
        i++;
      }
      accept();
    });

    return function (_x4) {
      return _ref3.apply(this, arguments);
    };
  })());
};

const assertDB = (() => {
  var _ref4 = _asyncToGenerator(function* () {
    const sqlRows = yield scoAuction.query(SQL`SELECT * FROM auction_events`);
    for (let i = 0; i < sqlRows.length; i++) {
      _chai.assert.equal(sqlRows[i].contract_address, events[i].contractAddress);
      _chai.assert.equal(sqlRows[i].sender, events[i].sender);
      _chai.assert.equal(sqlRows[i].block_hash, events[i].blockHash);
      _chai.assert.equal(sqlRows[i].block_number, events[i].blockNumber);
      _chai.assert.equal(sqlRows[i].block_is_valid, true);
    }
  });

  return function assertDB() {
    return _ref4.apply(this, arguments);
  };
})();

const simulateAuction = (() => {
  var _ref5 = _asyncToGenerator(function* () {
    spinner.start();
    console.log('Start Running tests');
    yield scoAuction.query(SQL`delete from auction_events`);
    const depositIndex = 4;
    let totalDeposit = 0;
    let accountDeposits = {};
    let strikePrice = 1000;

    // Start Auction
    console.log(`\x1b[33m`, '1. Start Auction:');
    yield contractInstance.startAuction();

    // Do a bunch of deposits
    console.log(`\x1b[33m`, '2. Deposit Phase :');
    for (let i = 1; i <= depositIndex; i++) {
      const randDeposit = randomIntFromInterval(1000, 10000);
      yield contractInstance.deposit({
        from: web3.eth.accounts[i],
        value: randDeposit });
      console.log(`\x1b[32m`, `=> ${i} Deposit Successful => `, web3.eth.accounts[i], randDeposit);
      totalDeposit += randDeposit;
      accountDeposits[web3.eth.accounts[i]] = randDeposit;
    }

    // Mine blocks to move processing phase
    yield mineBlocks(10);

    console.log(`\x1b[33m`, `3. In Bid Processing Phase + Set Strike Price`);
    // Set the Strike price
    yield contractInstance.setStrikePrice(strikePrice);
    console.log(`\x1b[32m`, ` => SetStrikePrice Successful`, strikePrice);

    // ProcessAll Bids
    console.log(`\x1b[33m`, '4. Bid Processing Phase - Process Bids');
    let bidIndex = 1;
    while (bidIndex <= depositIndex) {
      const bidWeiAmount = randomIntFromInterval(strikePrice, accountDeposits[web3.eth.accounts[bidIndex]]);
      const tokenBidPriceInWei = randomIntFromInterval(strikePrice, bidWeiAmount);
      const sig = yield getSig(tokenBidPriceInWei, bidWeiAmount, web3.eth.accounts[bidIndex]);
      yield contractInstance.processBid(tokenBidPriceInWei, bidWeiAmount, 1, sig.v, sig.r, sig.s);

      console.log(`\x1b[32m`, ` => Bid Processed successfully for =>`, web3.eth.accounts[bidIndex], tokenBidPriceInWei, bidWeiAmount);
      bidIndex++;
    }

    console.log(`\x1b[33m`, '5. Auction Complete Succesful');
    // Complete the successful auction.
    yield contractInstance.completeSuccessfulAuction();
    console.log(`\x1b[32m`, ` => Auction completed succesfully`);

    console.log(`\x1b[33m`, '5. Withdraw Remaining funds');
    let withdrawIndex = 1;
    // Withdrawing all the remaining deposits
    while (withdrawIndex <= depositIndex) {
      yield contractInstance.withdraw({ from: web3.eth.accounts[withdrawIndex] });
      console.log(`\x1b[32m`, ` => Withdraw succesful for account ${withdrawIndex} `, web3.eth.accounts[withdrawIndex]);
      withdrawIndex++;
    }

    // Assert the DB Values
    assertDB();
    console.log('Assertion is done ');
    spinner.stop();
  });

  return function simulateAuction() {
    return _ref5.apply(this, arguments);
  };
})();

const init = (() => {
  var _ref6 = _asyncToGenerator(function* () {

    return new Promise((() => {
      var _ref7 = _asyncToGenerator(function* (accept) {
        const inputContracts = {
          'SafeMath.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/SafeMath.sol`).toString(),
          'Token.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Token.sol`).toString(),
          // 'IERC20Token.sol': fs.readFileSync(`${__dirname}/../../auction/contracts/ccontracts/IERC20Token.sol`).toString(),
          'StandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/StandardToken.sol`).toString(),
          'HumanStandardToken.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/HumanStandardToken.sol`).toString(),
          'Auction.sol': fs.readFileSync(`${__dirname}/../../auction/contract/contracts/Auction.sol`).toString()
        };

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
        };

        spinner.start([10]);
        console.log('\x1b[36m', 'Deploying Auction contract');
        contractInstance = yield (0, _setup.setupAuction)({
          testRPCProvider: 'http://localhost:8545/',
          defaultContract: 'Auction.sol',
          input: inputContracts,
          constructParams: deployParams
        });

        // Setup Chainsaw
        console.log('\x1b[32m', 'Setting up Chainsaw - Initializing');
        chainsaw = new _chainsaw.Chainsaw(web3, [contractInstance.address], 0);
        chainsaw.addABI(contractInstance.abi);

        // Database setup
        console.log('\x1b[33m', 'Initializing and setting up database', '\x1b[37m');
        const TEST_DB = { host: 'localhost', database: 'auction' };
        scoAuction = new _scoAuction.SCOAuction(TEST_DB);
        console.log(`\x1b[35m`, 'Initialization Complete\n', `Use "curl http://localhost:3000/simulateContractCalls" to run testrunner\n`, `Use "curl http://localhost:3000/assertDatabase\n" after that assert database values`);
        console.log('\x1b[37m');

        // Chainsaw turn on polling
        chainsaw.turnOnPolling(chainLogEvents);
        spinner.stop();

        simulateAuction();
        accept();
      });

      return function (_x5) {
        return _ref7.apply(this, arguments);
      };
    })());
  });

  return function init() {
    return _ref6.apply(this, arguments);
  };
})();

// Initialization of the auction contract
init();

app.listen(3000, function () {
  console.log('Auction Contract Deployment');
});