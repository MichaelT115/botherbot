var SlackBot = require('slackbots');
var jsonfile = require('jsonfile');

var tokensFile = process.argv[2] || './tokens.key';

console.log("tokens file: ", tokensFile);
var tokens = require(tokensFile);

var repeat_str = 'hour';
var repeat = 1000 * 60 * 60;

var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

var settings = {
  name : 'Botherbot',
  token: tokens.slack,
};

var savefile = './save.json';

var bot = new SlackBot(settings);

var admins = [];
var bothers = {};

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
"> ",
"> `help`",
">   show help message",
"> ",
"> `time [set / get] [user] [minutes] `",
">   set or get the time between bothers for a user",
"> ",
"> `botherevery [user] [weekday] [24time] message`",
">   bother user on a schedule with the message",
].join('\n');


var doBother = (botherTarget) => {
  var bother = bothers[botherTarget];
  if (bother.messages == undefined || bother.messages.length == 0) return;
  bot.postMessageToUser(botherTarget, 'Bother bother! I am set to remind you every ' + repeat_str + ' of the following tasks: \n> ' + bother.messages.join('\n> '));
}

var constructUser = (data) => {
  if (data.delay < 10000) data.delay = 10000;
  
  var obj = {
    target: data.target, // Username of the botheree
    messages: data.messages || [], // Array of regularly repeated bother messages
    delay: data.delay || repeat, // Frequency of the regularly repeated bothers
    timeout: setInterval(doBother, data.delay || repeat, data.target), // Timeout object for repeated bothers
    crons: data.crons || [], // List of weekly bothers. { message, day, time }
  };

  bothers[data.target] = obj;
  return obj;
};

bot.on('start', () => {
  Promise.all(tokens.admins.map(val => bot.getUserId(val)))
  .then(val => {
    admins = admins.concat(val);
    load();
    bot.postMessageToUser(tokens.operator, 'I live.'); 
    console.log('started.');
  });
});

var save = () => {
  var clone = Object.keys(bothers).map(key => {
    var b = bothers[key];
    return {
      target: b.target,
      messages: b.messages.slice(0),
      crons: b.crons.slice(0),
      delay: b.delay,
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
      constructUser(bother);
    });
    startClock();
  });
};


var checkUser = (user) => {
  return bot.getUserId(user.replace('@','')).then((id) => id != undefined);
};


var cronBother = () => {
  var time = new Date();
  var hours = time.getHours();
  // Sanity: Just in case we somehow trigger at like 4:59
  if (time.getMinutes() > 30) hours += 1;

  var day = time.getDay();

  console.log("cron bother activate for " + weekdays[day] + " hour " + hours);

  
  for(target in bothers) {
    var bother = bothers[target];
    bother.crons.forEach(cron => {
      if (weekdays.indexOf(cron.day) == day && cron.time == hours) {
        bot.postMessageToUser(bother.target, 'Bother bother! I am set to remind you every ' + cron.day + ' at ' + cron.time + ' of the following: \n> ' + cron.message);
      }
    });
  }
};
var startClock = () => {
  var currentTime = new Date();
  var minutesToHour = 60 - currentTime.getMinutes();
  // Wait until next hour to 
  console.log('Not starting cron clock for another ' + minutesToHour + ' minutes');
  setTimeout(() => {
    cronBother();
    setInterval(cronBother, 60 * 60 * 1000);
  }, minutesToHour * 60 * 1000);
};


bot.on('message', (msg) => {
  if (msg.type == 'message' &&
      msg.channel && 
      msg.channel.startsWith('D') && // Make sure its a private message
      msg.user != bot.id) { 

    console.log('got a message ', msg.text);
    bot.getUsers().then(users => {
      var user = users.members.filter(u => (u.id == msg.user))[0];
      if (user.name !== tokens.operator && tokens.doLog)
        bot.postMessageToUser(tokens.operator, 'Got message from `' + user.name + '`:\n>' + msg.text);
    });

    if (admins.indexOf(msg.user) != -1) {
      if (msg.text.indexOf('<U') != -1) {
        bot.postMessage(msg.channel, "I can't handle @ symbols");
        return;
      }
      var split = msg.text.split(' ');
      var cmd = split[0].toLowerCase();

      if (cmd === 'help') {
        bot.postMessage(msg.channel, help); 
      }

      else if(cmd == 'bother' && split.length > 2) {
        var name = split[1].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          if(!bothers[name])
            constructUser({ target: name });
          console.log('Bother added ', bothers);

          bothers[name].messages.push(split.slice(2).join(' '));
          bot.postMessage(msg.channel, 'Added bother to ' + name + ': ' + split.slice(2).join(' ') + '\nThey now have ' + bothers[name].messages.length + ' bothers.');
          save();
        });
      }

      else if(cmd == 'clear' && split.length == 2) {
        var name = split[1].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }
          if (!bothers[name] || bothers[name].messages.length + bothers[name].crons.length == 0) {
            bot.postMessage(msg.channel, 'User has no bothers.');
          }
          else {
            bothers[name].messages = [];
            bothers[name].crons = [];
            clearInterval(bothers[name].timeout);
            bot.postMessage(msg.channel, 'User\'s bothers cleared');
            save();
          }
        });
      }

      else if(cmd == 'list' && split.length == 2) {
        var name = split[1].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          var bother = bothers[name];
          if (!bother || (bother.messages.length == 0 && bother.crons.length == 0)){
            bot.postMessage(msg.channel, 'User has no bothers.');
          }
          else {
            var botherList = bother.messages.map( (m, ind) =>
              ('> ' + (ind + 1) + ') ' + m)
            );

            botherList.push('\nWeeklies:');

            bother.crons.forEach( (entry, ind) =>
              botherList.push('> ' + (bother.messages.length + ind + 1) + ') Every ' + entry.day + ' at hour ' + entry.time + ': ' + entry.message)
            );

            bot.postMessage(msg.channel, 'User has ' + bother.messages.length + ' bother' + (bother.messages.length == 1 ? '':'s') + ':\n' + botherList.join('\n'));
          }
        });

      }

      else if(cmd == 'remove' && split.length > 2) {
        var name = split[1].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }


          var bother = bothers[name];
          if (!bother) bot.postMessage(msg.channel, 'User has no bothers.');
          else {
            var rem = parseInt(split[2]) - 1;
            if (!isNaN(rem)) {
              if (rem >= bother.messages.length + bother.crons.length || rem < 0) bot.postMessage(msg.channel, 'Bother index ' + (rem + 1) + ' is outside of user\'s bother message list.');
              else {
                if (rem < bother.messages.length) {
                  var removed = bother.messages.splice(rem, 1)[0];
                  bot.postMessage(msg.channel, 'Removed bother from user:\n>' + removed);
                  save();
                }
                else {
                  rem -= bother.messages.length;
                  var removed = bother.crons.splice(rem, 1)[0];
                  bot.postMessage(msg.channel, 'Removed weekly bother from user:\n> Every ' + removed.day + ' at hour ' + removed.time + ': ' + removed.message);
                  save();
                }
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

      else if(cmd == 'forcebother') {
        Object.keys(bothers).forEach(b => doBother(b));
        bot.postMessage(msg.channel, 'All users bothered.');
      }
      else if(cmd == "message" && split.length > 2) {
        var name = split[1].replace('@','');
        console.log('Messaging ', name);
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }
          var target = name;
          var msg = split.slice(2).join(' ');
          bot.postMessageToUser(target, msg);
          bot.postMessage(msg.channel, 'Message sent!');
        });
      }
      else if(cmd == "time" && split.length >= 3) {
        var name = split[2].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          var target = bothers[name];
          if (!target)
            target = constructUser({ target:name });

          switch(split[1]) {
            case 'set':
              
              var minutes = parseInt(split[3]);
              if (isNaN(minutes) || minutes <= 0) {
                bot.postMessage(msg.channel, 'Incorrect usage. See `help`');
              }
              else {
                target.delay = minutes * 1000 * 60;
                clearInterval(target.timeout);
                target.timeout = setInterval(doBother, target.delay, target.target);
                bot.postMessage(msg.channel, 'I will now bother ' + name + ' every ' + minutes + ' minutes.');
                save();
              }

              break;
            case 'get':
              var minutes = target.delay / 1000 / 60;
              bot.postMessage(msg.channel, 'I bother ' + name + ' every ' + minutes + ' minutes.');
              break;
            default:
              bot.postMessage(msg.channel, 'Incorrect usage. See `help`');
              break;
          }
        });
        
      }
      else if(cmd == 'botherevery' && split.length >= 5) {
        var name = split[1].replace('@','');
        checkUser(name).then(exists => {
          if (!exists) {
            bot.postMessage(msg.channel, 'Could not find user.');
            return;
          }

          var target = bothers[name];
          if (!target)
            target = constructUser({ target:name });
          
          var day = weekdays.indexOf(split[2].toLowerCase());
          var time = parseInt(split[3]);
          var message = split.slice(4).join(' ');        

          if (day == -1) {
            bot.postMessage(msg.channel, '`' + day + '` is not a day of the week.');
            return;
          }

          if (isNaN(time) || time < 0 || time >= 24) {
            bot.postMessage(msg.channel, 'Time `' + time + '` is not within 0-23');
            return;
          }

          target.crons.push({
            message: message,
            day: split[2],
            time: time,
          });

          bot.postMessage(msg.channel, 'Added weekly bother to `' + name + '`');
          save();
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
