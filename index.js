var SlackBot = require('slackbots');
var jsonfile = require('jsonfile');

var tokens = require('./tokens.key');

var repeat_str = 'hour';
var repeat = 1000 * 60;

var settings = {
  name : 'Botherbot',
  token: tokens.slack,
};

var savefile = './save.json';

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
"> `forcebother`",
">   bothers everynoe in the list immediately",
"> `help`",
">   show help message",
].join('\n');


var doBother = (botherTarget) => {
  var bother = bothers[botherTarget];
  if (bother.messages == undefined || bother.messages.length == 0) return;
  bot.postMessageToUser(botherTarget, 'Bother bother! I am set to remind you every ' + repeat_str + ' of the following tasks: \n> ' + bother.messages.join('\n> '));
}


bot.on('start', () => {
  Promise.all([bot.getUserId('frankie'),
               bot.getUserId('ronni')])
  .then(val => {
    admins = admins.concat(val);
    load();
    bot.postMessageToUser('frankie', 'I live.'); 
    console.log('started.');
  });
});

var save = () => {
  var clone = Object.keys(bothers).map(key => {
    var b = bothers[key];
    return {
      target: b.target,
      messages: b.messages.slice(0),
    };
  });
  
  jsonfile.writeFile(savefile, clone, (err) => {
    if(err) throw err;
  });
};

var load = () => {

  jsonfile.readFile(savefile, (err, get) => {
    if(err) return; //throw err;

    get.forEach(bother => {
      bothers[bother.target] = {
        target: bother.target,
        messages: bother.messages.slice(0),
        timeout: setInterval(doBother, repeat, bother.target),
      };
    });
  });
};

var checkUser = (user) => {
  return bot.getUserId(user).then((id) => id != undefined);
};

bot.on('message', (msg) => {
  if (msg.type == 'message' &&
      msg.channel && 
      msg.channel.startsWith('D') && // Make sure its a private message
      msg.user != bot.id) { 
    
    if (admins.indexOf(msg.user) != -1) {
      var split = msg.text.split(' ');
      if (split[0] === 'help') {
        bot.postMessage(msg.channel, help); 
      }

      else if(split[0] == 'bother' && split.length > 2) {
        checkUser(split[1]).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          if(!bothers[split[1]])
            bothers[split[1]] = {
              target: split[1],
              messages: [],
              timeout: setInterval(doBother, repeat, split[1]),
            };
          console.log('Bother added ', bothers);

          bothers[split[1]].messages.push(split.slice(2).join(' '));
          bot.postMessage(msg.channel, 'Added bother to ' + split[1] + ': ' + split.slice(2).join(' ') + '\nThey now have ' + bothers[split[1]].messages.length + ' bothers.');
          save();
        });
      }

      else if(split[0] == 'clear' && split.length == 2) {
        checkUser(split[1]).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }
          if (!bothers[split[1]] || bothers[split[1]].messages.length == 0) {
            bot.postMessage(msg.channel, 'User has no bothers.');
          }
          else {
            bothers[split[1]].messages = [];
            clearInterval(bothers[split[1]].timeout);
            bot.postMessage(msg.channel, 'User\'s bothers cleared');
            save();
          }
        });
      }

      else if(split[0] == 'list' && split.length == 2) {
        checkUser(split[1]).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          var bother = bothers[split[1]];
          if (!bother) bot.postMessage(msg.channel, 'User has no bothers.');
          else bot.postMessage(msg.channel, 'User has ' + bother.messages.length + ':\n' + bother.messages.map((m,i) => ('> ' + i + ') ' + m)).join('\n'));
        });

      }

      else if(split[0] == 'remove' && split.length > 2) {
        checkUser(split[1]).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }


          var bother = bothers[split[1]];
          if (!bother) bot.postMessage(msg.channel, 'User has no bothers.');
          else {
            var rem = parseInt(split[2]) - 1;
            if (rem != NaN) {
              if (rem >= bother.messages.length || rem < 0) bot.postMessage(msg.channel, 'Bother index ' + (rem + 1) + ' is outside of user\'s bother message list.');
              else {
                var removed = bother.messages.splice(rem, 1)[0];
                bot.postMessage(msg.channel, 'Removed bother from user:\n>' + removed);
                save();
              }
            }
            else {
              var toRemove = split.slice(2).join(' ');
              var ind = bother.messages.map(m => m.toLowerCase()).indexOf(toRemove.toLowerCase());
              if (ind == -1) bot.postMessage(msg.channel, 'Could not find bother for user. Try `list`ing a user\s bothers and removing by index');
              else {
                var removed = bother.messages.splice(ind, 1);
                bot.postMessage(msg.channel, 'Removed bother from user:\n>' + removed);
                save();
              }
            }
          }
        });
      }

      else if(split[0] == 'forcebother') {
        Object.keys(bothers).forEach(b => doBother(b));
        bot.postMessage(msg.channel, 'All users bothered.');
      }
      else if(split[0] == "message" && split.length > 2) {
        checkUser(split[1]).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }
          var target = split[1];
          var msg = split.slice(2).join(' ');
          bot.postMessageToUser(target, msg);
          bot.postMessage(msg.channel, 'Message sent!');
        });
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
