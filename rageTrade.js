const Web3 = require('web3')
const { BigNumber, ethers } = require('ethers');
const fs = require('fs')
const readline = require("readline")

const arbRpcURL = '' // Нода арбитрума
const arb_web3 = new Web3(arbRpcURL)

const minAmount = '10' //Количество сколько минимум забросить
const maxAmount = '100' //Количество сколько всего нужно забросить

const rageAddress = '0xf9305009FbA7E381b3337b5fA157936d73c2CF36'
const rageABI = [{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"to","type":"address"}],"name":"deposit","outputs":[{"internalType":"uint256","name":"shares","type":"uint256"}],"stateMutability":"nonpayable","type":"function"}, {"inputs":[],"name":"totalAssets","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"view","type":"function"}]
const rageContract = new arb_web3.eth.Contract(rageABI, rageAddress)

const USDC_ADDRESS = '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8'
const usdcABI = [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}, {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]
const usdcContract = new arb_web3.eth.Contract(usdcABI, USDC_ADDRESS)

let accounts = []
let depositedUSDC = '0'

async function sleep(seconds){
    return new Promise((resolve) =>{setTimeout(resolve, 1000 * seconds)})
}

async function getInfo(){
    const acc = readline.createInterface({ 
      input:fs.createReadStream('accs.txt'), //Название файла с ключами
    })
    for await (let line of acc) {
      accounts.push(arb_web3.eth.accounts.privateKeyToAccount(line))
    }
}

async function checkAllow(){

  let totalCap = ethers.utils.parseUnits('3350000', 6).toNumber()
  let nowCap = Number(await rageContract.methods.totalAssets().call())
  let count = 0
  while(totalCap - nowCap < ethers.utils.parseUnits(minAmount, 6).toNumber()){
    nowCap = Number(await rageContract.methods.totalAssets().call())
    console.log('Waiting...')
    await sleep(1)
    count +=1
  }
  const amountDif = BigNumber.from(totalCap).sub(BigNumber.from(nowCap)).toNumber()

  if (amountDif >= (ethers.utils.parseUnits(maxAmount, 6).toNumber() - depositedUSDC)){
    return ethers.utils.parseUnits(maxAmount, 6).toNumber() - depositedUSDC
  }

  if (amountDif < (ethers.utils.parseUnits(maxAmount, 6).toNumber() - depositedUSDC)){
    return amountDif
  }
}

async function arbSingleCall(tx, privateKey){
    let signedTx = await arb_web3.eth.accounts.signTransaction(tx, privateKey)
    await arb_web3.eth.sendSignedTransaction(signedTx.rawTransaction)
    .catch(e =>{
      console.log(e)
    })

    return signedTx.transactionHash
}

async function rageDeposit(account, amount){
  const data = rageContract.methods.deposit(amount, account.address).encodeABI()

  let tx = {
    to: rageAddress,
    value: 0,
    gas: 2000000,
    gasPrice: op_web3.utils.toWei("0.1", 'gwei'),
    data: data
  }

  const txHash = await arbSingleCall(tx, account.privateKey)
  console.log(`${account.address.slice(0, 4) + '...' + account.address.slice(38, 42)} - Successful deposit USDC to RageTrade: ${txHash}`)
}

async function main(){
  await getInfo()
  console.log('Accounts:\n')
  let totalBalance = 0
  for(let account of accounts){
      balance = Number(arb_web3.utils.fromWei(await arb_web3.eth.getBalance(account.address), 'ether'))
      totalBalance += balance
      console.log(`${account.address} ${balance} ETH`)
  }

  console.log(`\nTotal balance: ${totalBalance} ETH`)

  console.log('\nStart!')
  console.log('\n')
  let count = 0
  depositedUSDC = ethers.utils.parseUnits(depositedUSDC, 6).toNumber()

  for(let account of accounts){
    while(depositedUSDC < ethers.utils.parseUnits(maxAmount, 6).toNumber()){
      const amount = await checkAllow()
      console.log(amount)
      await rageDeposit(account, amount)
      depositedUSDC += amount

      console.log('\n')
      count +=1
      console.log(`${account.address} done! Total: ${count}`)
      console.log('\n')
    }
  }

  return
}

main()