'use strict';

var _chainsaw = require('./chainsaw.js');

var _setup = require('./setup');

var _setup2 = _interopRequireDefault(_setup);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const Web3 = require('web3');

const express = require('express');
const solc = require('solc');
const fs = require('fs');
// TODO : Replace this with your auction contract .
const contractPath = `${__dirname}/../contracts/StubPaymentChannel.sol`;

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

app.get('/', (() => {
  var _ref = _asyncToGenerator(function* (req, res) {
    const contractInstance = yield (0, _setup2.default)({
      testRPCProvider: 'http://localhost:8545/'
    });
    const content = fs.readFileSync(contractPath);
    const compiledContract = solc.compile(content.toString(), 1);
    const abi = compiledContract.contracts[':StubPaymentChannel'].interface;
    const chainsaw = new _chainsaw.Chainsaw(web3, [contractInstance.address], 0);
    chainsaw.addABI(JSON.parse(abi));

    yield contractInstance.createChannel(web3.eth.accounts[2], '0x222342');
    yield contractInstance.deposit('0x222342', { value: 20 });

    chainsaw.turnOnPolling(function (error, response) {
      console.log('Chainsaw is here');
      if (!error) {
        console.log('Log response:', response);
      }
    });

    yield contractInstance.deposit('0x222342', { value: 20 });
    // await wait(50000)
    //chainsaw.turnOffPolling()
  });

  return function (_x, _x2) {
    return _ref.apply(this, arguments);
  };
})());

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});