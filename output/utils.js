'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.randomIntFromInterval = exports.mineBlocks = exports.mineBlock = exports.revertSnapshot = exports.takeSnapshot = undefined;

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _es6Promisify = require('es6-promisify');

var _es6Promisify2 = _interopRequireDefault(_es6Promisify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const web3 = new _web2.default(new _web2.default.providers.HttpProvider('http://localhost:8545'));

const takeSnapshot = exports.takeSnapshot = () => {
  return new Promise((() => {
    var _ref = _asyncToGenerator(function* (accept) {
      let res = yield (0, _es6Promisify2.default)(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: '2.0',
        method: 'evm_snapshot',
        id: new Date().getTime()
      });
      accept(res.result);
    });

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  })());
};

const revertSnapshot = exports.revertSnapshot = snapshotId => {
  return new Promise((() => {
    var _ref2 = _asyncToGenerator(function* (accept) {
      yield (0, _es6Promisify2.default)(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: '2.0',
        method: 'evm_revert',
        params: [snapshotId],
        id: new Date().getTime()
      });
      accept();
    });

    return function (_x2) {
      return _ref2.apply(this, arguments);
    };
  })());
};

const mineBlock = exports.mineBlock = () => {
  return new Promise((() => {
    var _ref3 = _asyncToGenerator(function* (accept) {
      yield (0, _es6Promisify2.default)(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
        jsonrpc: "2.0",
        method: "evm_mine",
        id: new Date().getTime()
      });
      accept();
    });

    return function (_x3) {
      return _ref3.apply(this, arguments);
    };
  })());
};

const mineBlocks = exports.mineBlocks = count => {
  return new Promise((() => {
    var _ref4 = _asyncToGenerator(function* (accept) {
      let i = 0;
      while (i < count) {
        yield mineBlock();
        i++;
      }
      accept();
    });

    return function (_x4) {
      return _ref4.apply(this, arguments);
    };
  })());
};

const randomIntFromInterval = exports.randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};