import Web3 from 'web3'
import p from 'es6-promisify'
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

export const takeSnapshot = () => {
  return new Promise(async (accept) => {
    let res = await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_snapshot',
      id: new Date().getTime()
    })
    accept(res.result)
  })
}

export const revertSnapshot = (snapshotId) => {
  return new Promise(async (accept) => {
    await p(web3.currentProvider.sendAsync.bind(web3.currentProvider))({
      jsonrpc: '2.0',
      method: 'evm_revert',
      params: [snapshotId],
      id: new Date().getTime()
    })
    accept()
  })
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

export const mineBlocks = (count) => {
  return new Promise(async (accept) => {
    let i = 0
    while (i < count) {
      await mineBlock()
      i++
    }
    accept()
  })
}

export const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}
