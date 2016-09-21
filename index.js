var SlackBot = require('slackbots');

var tokens = require('./tokens.key');

var repeat_str = 'hour';
var repeat = 1000 * 60 * 60;

var settings = {
  name : 'Botherbot',
  token: tokens.slack,
};

var bot = new SlackBot(settings);

var admins = [];
var bothers = {};
/*

{
  target: user
  messages: [msg]
  timeout: obj

}

*/
var help = [
"> `bother [user] message`",
">   adds another thing to bother [user] about",
"> ",
"> `clear [user]`",
">   clears all bothers for a user",
"> ",
"> `list [user]`",
">   lists all bothers for a user",
"> ", 
"> `remove [user] [bother]`",
">   removes bother from user. [bother] is either message or bother id",
"> ",
"> `help`",
">   show help message",
].join('\n');


var doBother = (bother) => {
  var chatID = bot.getChatId(bother.target);
  bot.postMessage(chatID, 'Bother bother! I am set to remind you every ' + repeat_str + ' of the following tasks: \n> ' + bother.messages.join('\n> '));
}


bot.on('start', () => {
  Promise.all([bot.getUserId('frankie'),
               bot.getUserId('ronni')])
  .then(val => {
    admins = admins.concat(val);
    bot.postMessageToUser('frankie', 'I live.'); 
    console.log('started.');
  });
});

bot.on('message', (msg) => {
  if (msg.type == 'message' &&
      msg.channel && 
      msg.channel.startsWith('D') && // Make sure its a private message
      msg.user != bot.id) { 
    
    console.log(msg.user, admins);
    if (admins.indexOf(msg.user) != -1) {
      var split = msg.text.split(' ');
      if (split[0] === 'help') {
        bot.postMessage(msg.channel, help); 
      }

      else if(split[0] == 'bother' && split.length > 2) {
      }
      else if(split[0] == 'clear' && split.length == 2) {

      }
      else if(split[0] == 'list' && split.length == 2) {

      }
      else if(split[0] == 'remove' && split.length > 2) {

      }
      else {
        bot.postMessage(msg.channel, 'Usage error. See `help` for details.');
      }
    }
    else {
      bot.postMessage(msg.channel, 'Sorry! I only respond to my admins.');
    }
  }
});
