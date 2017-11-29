let fs = require('fs');

let config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
if (!config.token) {
	console.log("No Discord user token found at config.token! Exiting...");
	exit();
}
let pre = "/";
if (config.prefix) {
	pre = config.prefix;
} else {
	console.log("No prefix found at config.prefix! Defaulting to \"" + pre + "\"!");
}
let outChannel;
if (config.outChannel) {
	outChannel = config.outChannel;
} else {
	console.log("No output channel found at config.outChannel! Please set it with the " + pre + "outchannel command!");
}
let modRole;
if (config.modRole) {
	modRole = config.modRole;
} else {
	console.log("No role for moderators found at config.modRole! Please set it with the " + pre + "modrole command!");
}
let title = "Moderator";
if (config.title) {
	title = config.title;
} else {
	console.log("No name for moderators found at config.title! Defaulting to " + title + "!");
}

let Discord = require('discord.io');

let bot = new Discord.Client({
	token: config.token,
	autorun: true
});

bot.on('ready', function() {
	console.log('Logged in as %s - %s\n', bot.username, bot.id);
});

bot.on('disconnect', function() {
	console.log("Disconnected. Reconnecting...");
	bot.connect();
});

let cases = JSON.parse(fs.readFileSync('cases.json', 'utf8'));
/*
structure of a case object
user { //userID of the user who sent the initial messagef
	messages: [], //array of messages, allows mods to check history
	attachments: [] //array of buffers or whatever, of files uploaded with messages.
}
*/

let pendingAnswer = {
	user: ""
};

bot.on('message', function(user, userID, channelID, message, event) {
	if (userID === bot.id) {
		return;
	}
	if (bot.directMessages[channelID]) {
		if (outChannel) {
			if (cases[userID]) {
				let cas = cases[userID];
				cas.messages.push(message);
				let out = "**New message from <@" + userID + ">!**\n```" + message + "```\n";
				if (event.d.attachments.length > 0) {
					for (let att of event.d.attachments) {
						cas.attachments.push(att.url);
						out += "Attachment: <" + att.url + ">\n";
					}
				}
				bot.sendMessage({
					to: outChannel,
					message: out
				}, function(err, res) {
					if (err) {
						console.log(err);
					} else {
						bot.sendMessage({
							to: userID,
							message: "Reply sent to " + title + "s!"
						});
					}
				});
				fs.writeFileSync('cases.json', JSON.stringify(cases), 'utf8');
			} else {
				cases[userID] = {
					messages: [message],
					attachments: event.d.attachments
				};
				let out = "**New case from <@" + userID + ">!**\n```" + message + "```\n";
				if (event.d.attachments.length > 0) {
					for (let att of event.d.attachments) {
						out += "Attachment: <" + att.url + ">\n";
					}
				}
				bot.sendMessage({
					to: outChannel,
					message: out
				}, function(err, res) {
					if (err) {
						console.log(err);
					} else {
						bot.sendMessage({
							to: userID,
							message: "Message sent to " + title + "s!"
						});
					}
				});
				fs.writeFileSync('cases.json', JSON.stringify(cases), 'utf8');
			}
		} else {
			bot.sendMessage({
				to: channelID,
				message: "I can't accept your message because I'm not properly set up! Please tell the admin of the server you saw me in to set an outChannel!"
			});
		}
	} else if (isMod(user, userID, channelID, message, event)) {
		let lowMessage = message.toLowerCase();
		if (lowMessage.indexOf(pre + "help") === 0) {
			help(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "outchannel") === 0) {
			setOutChannel(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "modrole") === 0) {
			setModRole(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "reply") === 0) {
			reply(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "details") === 0) {
			details(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "list") === 0) {
			listCases(user, userID, channelID, message, event);
			return;
		}
		if (lowMessage.indexOf(pre + "close") === 0) {
			closeCase(user, userID, channelID, message, event);
			return;
		}
		if (userID === pendingAnswer.user && channelID == pendingAnswer.channel) {
			if (lowMessage.indexOf("yes") === 0) {
				confirmCloseCase(user, userID, channelID, message, event);
			} else {
				pendingAnswer = {
					user: ""
				};
			}
		}
	}
	let lowMessage = message.toLowerCase();
	if (lowMessage.indexOf("<@" + bot.id + ">") > -1) {
		help2(user, userID, channelID, message, event);
		return;
	}
});

function help2(user, userID, channelID, message, event) {
	out = "I am a basic modmail bot made by AlphaKretin#7990!\n";
	out += "You can find my source at <https://github.com/AlphaKretin/modmail-bot>\n";
	out += "Server mods (or the owner if no mod role is defined) can see my commands with " + pre + "help!";
	bot.sendMessage({
		to: channelID,
		message: out
	});
}

function isMod(user, userID, channelID, message, event) {
	let serverID = bot.channels[channelID] && bot.channels[channelID].guild_id;
	if (modRole) {
		return bot.servers[serverID].members[userID] && bot.servers[serverID].members[userID].roles.indexOf(modRole) > -1;
	} else {
		return bot.servers[serverID].owner_id === userID;
	}
}

function help(user, userID, channelID, message, event) {
	out = "**Commands:**```\n";
	out += pre + "outchannel: Specify which channel to print messages from users.\n";
	out += pre + "modrole [roleID]: Specify which role the bot will accept commands from, default is server owner.\n";
	out += pre + "reply [@mention] [reply]: Reply to the case of the user you mentioned.\n";
	out += pre + "details [@mention]: See the history of the case of the user you mentioned.\n";
	out += pre + "list: See a list of all open cases.\n";
	out += pre + "close [@mention]: Close the case of the user you mentioned.\n```";
	bot.sendMessage({
		to: channelID,
		message: out
	});
}

function setOutChannel(user, userID, channelID, message, event) {
	if (outChannel) {
		if (outChannel !== channelID) {
			let oldChannel = outChannel;
			outChannel = channelID;
			config.outChannel = outChannel;
			bot.sendMessage({
				to: channelID,
				message: "Output channel changed from <#" + oldChannel + "> to <#" + outChannel + ">!"
			});
			fs.writeFileSync('config.json', JSON.stringify(config), 'utf8');
		}
	} else {
		outChannel = channelID;
		config.outChannel = outChannel;
		bot.sendMessage({
			to: channelID,
			message: "Output channel set to <#" + outChannel + ">!"
		});
		fs.writeFileSync('config.json', JSON.stringify(config), 'utf8');
	}
}

function setModRole(user, userID, channelID, message, event) {
	let arg = message.slice((pre + "modrole ").length);
	let serverID = bot.channels[channelID] && bot.channels[channelID].guild_id;
	if (arg in bot.servers[serverID].roles) {
		if (modRole) {
			if (modRole !== arg) {
				let oldRole = modRole;
				modRole = arg;
				config.modRole = modRole;
				bot.sendMessage({
					to: channelID,
					message: "Moderator role changed from " + bot.servers[serverID].roles[oldRole].name + " to " + bot.servers[serverID].roles[arg].name + "!"
				});
				fs.writeFileSync('config.json', JSON.stringify(config), 'utf8');
			}
		} else {
			modRole = arg;
			config.modRole = modRole;
			bot.sendMessage({
				to: channelID,
				message: "Moderator role set to " + bot.servers[serverID].roles[arg].name + "!"
			});
			fs.writeFileSync('config.json', JSON.stringify(config), 'utf8');
		}
	} else {
		bot.sendMessage({
			to: channelID,
			message: arg + " is not a valid role ID! Please enter a valid role ID."
		});
	}
}

function reply(user, userID, channelID, message, event) {
	let args = message.split(" ");
	let us = args[1].replace(/[<@>]/g, "");
	if (us in cases) {
		let arg = message.slice((pre + "reply " + args[1] + " ").length);
		let cas = cases[us];
		cas.messages.push(arg);
		let out = "**Reply from " + title + "s!**\n```" + arg + "```\n";
		if (event.d.attachments.length > 0) {
			for (let att of event.d.attachments) {
				cas.attachments.push(att.url);
				out += "Attachment: <" + att.url + ">\n";
			}
		}
		bot.sendMessage({
			to: us,
			message: out
		}, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				bot.sendMessage({
					to: channelID,
					message: "Reply sent to <@" + us + ">!"
				});
			}
		});
		fs.writeFileSync('cases.json', JSON.stringify(cases), 'utf8');
	} else if (us in bot.users) {
		let arg = message.slice((pre + "reply " + args[1] + " ").length);
		cases[us] = {
			messages: [message],
			attachments: event.d.attachments
		};
		let out = "**Message from " + title + "s!**\n```" + arg + "```\n";
		if (event.d.attachments.length > 0) {
			for (let att of event.d.attachments) {
				out += "Attachment: <" + att.url + ">\n";
			}
		}
		bot.sendMessage({
			to: us,
			message: out
		}, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				bot.sendMessage({
					to: channelID,
					message: "Reply sent to <@" + us + ">!"
				});
			}
		});
		fs.writeFileSync('cases.json', JSON.stringify(cases), 'utf8');
	} else {
		bot.sendMessage({
			to: channelID,
			message: args[1] + " is not a valid mention or ID of a user!"
		});
	}
}

function details(user, userID, channelID, message, event) {
	let args = message.split(" ");
	let us = args[1].replace(/[<@>]/g, "");
	if (us in cases) {
		let outs = [];
		let out = "";
		for (let mes of cases[us].messages) {
			if (out.length + mes.length + "``````\n".length < 2000) {
				out += "```" + mes + "```\n";
			} else if (mes.length + "``````\n".length < 2000) {
				outs.push(out);
				out = "```" + mes + "```\n";
			} else {
				outs.push(out);
				out = mes;
			}
		}
		for (let mes of cases[us].attachments) {
			if (out.length + mes.length + "Attachment: <>\n".length < 2000) {
				out += "Attachment <" + mes + ">\n";
			} else if (mes.length + "Attachment: <>\n".length < 2000) {
				outs.push(out);
				out = "Attachment <" + mes + ">\n";
			} else {
				outs.push(out);
				out = mes;
			}
		}
		outs.push(out);
		bot.sendMessage({
			to: channelID,
			message: "**Details of case with <@" + us + ">:**"
		}, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				for (let ou of outs) {
					bot.sendMessage({
						to: channelID,
						message: ou
					});
				}
			}
		});
	} else {
		bot.sendMessage({
			to: channelID,
			message: args[1] + " is not a mention or ID of a user with an open case!"
		});
	}
}

function listCases(user, userID, channelID, message, event) {
	let list = [];
	Object.keys(cases).forEach(function(key, index) {
		list.push("<@" + key + ">");
	});
	bot.sendMessage({
		to: channelID,
		message: "**The following users have open cases:**\n" + list.toString().replace(/,/g, ", ")
	});
}

function closeCase(user, userID, channelID, message, event) {
	let args = message.split(" ");
	let us = args[1].replace(/[<@>]/g, "");
	if (us in cases) {
		pendingAnswer = {
			user: userID,
			channel: channelID,
			toDel: us
		};
		bot.sendMessage({
			to: channelID,
			message: "Type \"yes\" if you are *sure* you want to close the case with <@" + us + ">. It will be **permanently** deleted and you will **not** be able to recover it! Typing anything else will abort the close."
		});
	} else {
		bot.sendMessage({
			to: channelID,
			message: args[1] + " is not a mention or ID of a user with an open case!"
		});
	}
}

function confirmCloseCase(user, userID, channelID, message, event) {
	delete cases[pendingAnswer.toDel];
	bot.sendMessage({
		to: channelID,
		message: "Case with <@" + pendingAnswer.toDel + "> closed!"
	});
	pendingAnswer = {
		user: ""
	};
	fs.writeFileSync('cases.json', JSON.stringify(cases), 'utf8');
}