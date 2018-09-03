const Telegraf = require('telegraf');
const nconf = require('nconf');
const { showBal, showBalances, addAddress, getAddress, removeAddress, startListenAccount, stopListenAccount, initListen } = require('./tron');

const { token } = nconf.get('telegram');
const bot = new Telegraf(token);

const run = async () => {
  const hasBotCommands = (entities) => {
    if (!entities || !(entities instanceof Array)) {
      return false;
    }
  
    return entities.some(e => e.type === 'bot_command');
  };

  const helpMsg = ['/addaddress Add tron address',
    '/getaddress Show added addresses',
    '/removeaddress Remove tron address',
    '/startlisten Start listening to change balance',
    '/stoplisten Stop listening to change balance.',
    '/address Show balance of input address',
    '/showbalances Show balance of added address'];

  bot.help(ctx => ctx.reply(helpMsg.join('\n')));
  bot.start(ctx => ctx.reply(helpMsg.join('\n')));

  bot.command('address', ({ reply }) => reply('/address  Reply tron address to show balance.', { reply_markup: { force_reply: true, selective: true } }));

  bot.command('showbalances', async ({ reply, from: { id: resChatId } }) => {
    await showBalances(reply, resChatId);
  });

  bot.command('startlisten', async ({ from: { id: resChatId } }) => {
    await startListenAccount(resChatId);
  });

  bot.command('stoplisten', async ({ reply, from: { id: resChatId } }) => {
    await stopListenAccount(reply, resChatId);
  });

  bot.command('addaddress', ({ reply }) => reply('/addaddress Reply tron address to add.', { reply_markup: { force_reply: true, selective: true } }));

  bot.command('getaddress', ({ reply, from: { id: resChatId } }) => {
    getAddress(reply, resChatId);
  });

  bot.command('removeaddress', ({ reply }) => reply('/removeaddress Reply tron address to remove.', { reply_markup: { force_reply: true, selective: true } }));

  bot.on('message', async (ctx) => {
    const { message, reply } = ctx;
    const resChatId = ctx.from.id;
    if (!hasBotCommands(message.entities)) {
      console.log(JSON.stringify(message, null, 2));
      const { reply_to_message } = message;
      if (reply_to_message) {
        const { text } = reply_to_message;

        if (text.startsWith('/addaddress')) {
          try {
            const address = message.text;
            await addAddress(resChatId, address, reply);
          } catch (err) {
            reply(`Error Occured: ${JSON.stringify(err)}`);
          }
        }

        if (text.startsWith('/removeaddress')) {
          try {
            const address = message.text;
            await removeAddress(resChatId, address, reply);
          } catch (err) {
            reply(`Error Occured: ${JSON.stringify(err)}`);
          }
        }

        if (text.startsWith('/address')) {
          try {
            const address = message.text;
            await showBal(reply, address);
          } catch (err) {
            reply(`Error Occured: ${JSON.stringify(err)}`);
          }
        }
      }
    }
  });

  bot.catch((err) => {
    console.log('Ooops', err);
  });

  bot.startPolling();
  await initListen(bot);
};

module.exports = async () => {
  await run();
};
