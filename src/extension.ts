import * as vscode from 'vscode';
import * as Chance from 'chance';
import { Config, ConfigRetrival, configEnum } from './config-retrival';
import { InsertText } from './insert-text';

let param: Config;

function configObserve(context: vscode.ExtensionContext, retrival = new ConfigRetrival(vscode.workspace)) {

	param = retrival.param;

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {

		param.quoteStyle     = e.affectsConfiguration(configEnum.QUOTESTYLE) 		 ? retrival.quoteStyle 		 : param.quoteStyle;
		param.insertType     = e.affectsConfiguration(configEnum.INSERTTYPE) 		 ? retrival.insertType 		 : param.insertType;
		param.loremSize      = e.affectsConfiguration(configEnum.LOREMSIZE) 		 ? retrival.loremSize 		 : param.loremSize;
		param.hashSize       = e.affectsConfiguration(configEnum.HASHSIZE) 		   ? retrival.hashSize 	   	 : param.hashSize;
		param.disableNotifs  = e.affectsConfiguration(configEnum.DISABLENOTIFS)  ? retrival.disableNotifs  : param.disableNotifs;
		param.withQuote      = e.affectsConfiguration(configEnum.WITHQUOTE)      ? retrival.withQuote      : param.withQuote;
		param.withNewLine    = e.affectsConfiguration(configEnum.WITHNEWLINE)    ? retrival.withNewLine    : param.withNewLine;
	}));
}

export function activate(context: vscode.ExtensionContext) {

	configObserve(context);

	let insertRandomAnimal = vscode.commands.registerCommand('extension.insertRandomAnimal', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');

		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.animal.random);
		});

		param.disableNotifs ? 0 : vscode.window.showInformationMessage(`Animal location: ${text.animal.type}`);
	});

	let insertRandomPerson = vscode.commands.registerCommand('extension.insertRandomPerson', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.person);
		});
	});

	let insertRandomDate = vscode.commands.registerCommand('extension.insertRandomDate', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.date);
		});
	});

	let insertRandomCountry = vscode.commands.registerCommand('extension.insertRandomCountry', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.country);
		});
	});

	let insertRandomNumber = vscode.commands.registerCommand('extension.insertRandomNumber', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.number);
		});
	});

	let insertRandomString = vscode.commands.registerCommand('extension.insertRandomString', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.string);
		});
	});

	let insertLorem = vscode.commands.registerCommand('extension.insertLorem', async () => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, null);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.lorem);
		});
	});

	let insertLoremSmall = vscode.commands.registerCommand('extension.insertLoremSmall', async () => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, null);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.loremSmall);
		});
	});

	let insertLoremMedium = vscode.commands.registerCommand('extension.insertLoremMedium', async () => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, null);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.loremMedium);
		});
	});

	let insertLoremLarge = vscode.commands.registerCommand('extension.insertLoremLarge', async () => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, null);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.loremLarge);
		});
	});

	let insertRandomHash = vscode.commands.registerCommand('extension.insertRandomHash', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.hash.plain());
		});
	});

	let insertRandomHashSmall = vscode.commands.registerCommand('extension.insertRandomHashSmall', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.hash.small());
		});
	});

	let insertRandomHashMedium = vscode.commands.registerCommand('extension.insertRandomHashMedium', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.hash.medium());
		});
	});

	let insertRandomHashLarge = vscode.commands.registerCommand('extension.insertRandomHashLarge', async (chance = new Chance()) => {

		await vscode.commands.executeCommand('notifications.clearAll');
		const editor = vscode.window.activeTextEditor;
		const text = new InsertText(param, chance);

		editor.edit((active) => {
			const pos = param.insertType ? editor.selection.anchor : new vscode.Position(0, 0);;
			active.insert(pos, text.hash.large());
		});
	});

	const disposable = [
		insertRandomAnimal, insertRandomPerson, insertRandomDate, insertRandomCountry, insertRandomNumber, insertRandomString, insertLorem, insertLoremSmall, insertLoremMedium, insertLoremLarge, insertRandomHash, insertRandomHashSmall, insertRandomHashMedium, insertRandomHashLarge
	];

	context.subscriptions.push(...disposable);
}

export function deactivate() {}
