# Botherbot

A small slackbot designed to do simple tasks on a schedule like pinging users.
It also has commands to change branches on a specified directory to change what branch a webserver may have deployed there. That requires a seperate, hotloading webserver aimed at that directory.


## Deploying

You'll need a `tokens.key` file in the root of the project, or to define ones path as the first argument.

```text/javascript
module.exports = {
  slack: 'xoxb-myslackbotkey-00000000000000000000000',
  admins: [ // List of admin usernames
    'frankie',
    'ronni',
  ],
  operator: 'frankie', // The big admin username
  doLog: true, // Log to what occurs to the operator?
  deployable: true, //Take deploy commands?
  gitpath: '/projects/three/FE-Dev', // Path to execute git checkout commands in
};
```


