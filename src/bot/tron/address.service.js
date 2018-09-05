const { Client } = require('@tronscan/client');
const chalk = require('chalk');
const schedule = require('node-schedule');
const stringify = require('json-stable-stringify');
const moment = require('moment-timezone');
const users = require('../../db')();
const { numberformat } = require('../utils');
const { checkAddressPattern } = require('./helpers');

 
let bot = null;
const jobs = {};

exports.showBal = async (reply, address) => {
  console.log('===========================================================');
  const client = new Client();
  let msg = `<b>${address}</b>\n\n`;
  const accountInfo = await client.getAddress(address);
  const balances = accountInfo.balances || [];
  const frozenBalances = (accountInfo.frozen && accountInfo.frozen.balances) || [];
  const { amount = 0, expires } = frozenBalances[0] || {};
  if (amount > 0) {
    msg += '<b>* Frozen Balance</b>\n';
    msg += `Amount: ${numberformat(amount / 1000000)}\n`;
    msg += `Expires: ${moment(expires).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss')} (+09:00)\n\n`;
  }
  for (const token of balances) {
    const { name, balance } = token;
    const bal = Math.floor(balance);
    if (bal > 0) {
      msg += `- ${name}:  <b>${numberformat(bal)}</b>\n`;
      console.log(name === 'TRX' ? chalk.green(address, name, bal) : chalk.white(address, name, bal));
    }
  }
  reply(msg, { parse_mode: 'HTML' });
};


const showBalance = async (chatId) => {
  console.log('===========================================================');
  const result = await users.child(`/tron/${chatId}/address`).once('value');
  console.log(result.val());
  const myAddress = result.val();
  if (!myAddress) return bot.telegram.sendMessage(chatId, 'Not found tron addresses.');

  const client = new Client();
  await Promise.all(Object.keys(myAddress).map(async (addr) => {
  // for (const addr of Object.keys(myAddress)) {
    const preTokens = (myAddress[addr] && myAddress[addr].tokens) || {};
    // let msg = `<b>[Balance Notification - ${Object.keys(preTokens).length > 0 ? 'Updated' : 'Registration'}]</b>\n`;
    let msg = '<b>[Balance Notification]</b>\n';
    msg += `<b>${addr}</b>\n\n`;
    const currentTokens = {};
    try {
      const accountInfo = await client.getAddress(addr);
      const balances = accountInfo.balances || [];

      const frozenBalances = (accountInfo.frozen && accountInfo.frozen.balances) || [];
      const { amount = 0, expires } = frozenBalances[0] || {};

      const changed = [];
      const allTokens = [];
      balances.forEach((token) => {
        const { name, balance } = token;
        const bal = Math.floor(balance) || 0;
        const preBal = preTokens[name] || 0;
        if (bal !== preBal && Object.keys(preTokens).length > 0) {
          const diff = parseInt(bal - preBal, 10);
          changed.push(`<b> - ${name}:  ${numberformat(preBal)} -> ${numberformat(bal)} (${diff > 0 ? `+${diff}` : diff})</b>`);
        }

        if (bal > 0) {
          currentTokens[name] = bal;
          allTokens.push(`- ${name}:  ${numberformat(bal)}`);
          console.log(name === 'TRX' ? chalk.green(addr, name, bal) : chalk.white(addr, name, bal));
        }
      });

      if (stringify(preTokens) !== stringify(currentTokens)) {
        const updates = {};
        updates[`/tron/${chatId}/address/${addr}/tokens`] = currentTokens;
        updates[`/tron/${chatId}/address/${addr}/updateTime`] = new Date();
        await users.update(updates);
        if (changed.length > 0) {
          msg += '<b>* Balance changes</b>\n';
          msg += changed.join('\n');
          msg += '\n\n';
        }

        if (allTokens.length > 0) {
          msg += '<b>* Current Balance</b>\n';
          msg += allTokens.join('\n');
        }

        if (amount > 0) {
          msg += '\n\n<b>* Frozen Balance</b>\n';
          msg += `Amount: ${numberformat(amount / 1000000)}\n`;
          msg += `Expires: ${moment(expires).tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss')} (+09:00)\n`;
        }

        bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' });
      }
    } catch (err) {
      // ignore
      // console.error(err);
    }
  }));
};

exports.addAddress = async (chatId, addr, reply) => {
  const currentUsers = await users.child('/tron').once('value');
  
  if (Object.keys(currentUsers).length > 300) {
    return reply('exceeded maximum users. Please contact to marucool9@gmail.com');
  }

  if (!checkAddressPattern(addr)) return reply('Invalid address.');
  const data = await users.child(`/tron/${chatId}/address`).once('value');
  console.log(data.val());
  const updates = {};
  const address = data.val() || {};
  if (address[addr]) {
    return reply('Already added tron address.');
  }

  if (Object.keys(address).length > 4) {
    return reply('You can add address up to 5.');
  }

  let initListen = false;
  if (Object.keys(address).length === 0) {
    initListen = true;
  }
  address[addr] = {
    createTime: new Date(),
  };
  updates[`/tron/${chatId}/address`] = address;
  await users.update(updates);
  if (initListen) await this.startListenAccount(chatId);
  return reply(`${addr} tron address added.`);
};

// exports.getAddresses = async (reply, chatId) => {
//   const data = await users.child(`/tron/${chatId}/address`).once('value');
//   const address = data.val() || [];
//   if (address.length === 0) return reply('No added tron addresses.');
//   return reply(address.join('\n'));
// };

exports.startListenAccount = async (chatId, send = true) => {
  const data = await users.child(`/tron/${chatId}/address`).once('value');
  const address = data.val() || [];
  if (address.length === 0) return bot.telegram.sendMessage(chatId, 'Not found tron addresses to start.');

  if (jobs[chatId]) {
    const { job } = jobs[chatId];
    if (job && job.nextInvocation()) {
      if (send) return bot.telegram.sendMessage(chatId, 'Your tron address are already listening now..');
      return false;
    }
  }

  jobs[chatId] = {
    job: schedule.scheduleJob('*/10 * * * * *', async () => {
      await showBalance(chatId);
    }),
  };
  const updates = {};
  updates[`/tron/${chatId}/listenChangeBalances`] = true;
  await users.update(updates);
  if (send) return bot.telegram.sendMessage(chatId, 'Started listening change balance.');
  return false;
};

exports.stopListenAccount = async (reply, chatId) => {
  const { job = {} } = jobs[chatId];

  console.log(job && job.nextInvocation());

  if (!job.nextInvocation()) {
    return reply('Not found job for listening change balance.');
  }

  job.cancel();
  const updates = {};
  updates[`/tron/${chatId}/listenChangeBalances`] = false;
  await users.update(updates);
  return reply('stopped listening chanage balance.');
};

exports.getAddress = async (reply, chatId) => {
  const data = await users.child(`/tron/${chatId}/address`).once('value');
  console.log(data.val());
  const address = data.val() || {};
  if (Object.keys(address).length === 0) {
    return reply('No added tron addresses.');
  }
  
  let msg = '<b>[Address List]</b>\n\n';
  msg = Object.keys(address).reduce((prev, next) => {
    msg += `${next}\n`;
    return msg;
  }, msg);
  return reply(msg, { parse_mode: 'HTML' });
};

exports.removeAddress = async (chatId, addr, reply) => {
  if (!checkAddressPattern(addr)) return reply('Invalid address.');
  const data = await users.child(`/tron/${chatId}/address`).once('value');
  console.log(data.val());
  const updates = {};
  const address = data.val() || {};
  if (address[addr]) {
    updates[`/tron/${chatId}/address/${addr}`] = null;
    await users.update(updates);
    if (Object.keys(address).length === 1) {
      this.stopListenAccount(reply, chatId);
    }
    return reply(`${addr} tron address removed.`);
  }
  return reply('Not found tron address.');
};

exports.showBalances = async (reply, chatId) => {
  const data = await users.child(`/tron/${chatId}/address`).once('value');
  const addresses = data.val() || {};
  if (Object.keys(addresses).length === 0) {
    return reply('No added tron addresses.');
  }

  await Promise.all(Object.keys(addresses).map(async (address) => {
    await this.showBal(reply, address);
  }));
};

exports.initListen = async (myBot) => {
  bot = myBot;
  const data = await users.child('/tron').once('value');
  const allUsers = data.val();
  console.log(allUsers);
  for (const chatId of Object.keys(allUsers)) {
    const { listenChangeBalances } = allUsers[chatId] || {};
    if (listenChangeBalances === true) {
      await this.startListenAccount(chatId, false);
    }
  }
};
