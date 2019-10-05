import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as Color from 'color';
import template from './template';
import { execSync } from 'child_process';

const walColorsPath = path.join(os.homedir(), '/.cache/wal/colors');
let autoUpdateWatcher: fs.FSWatcher | null = null;


export function activate(context: vscode.ExtensionContext) {

	// Register the update command
	let disposable = vscode.commands.registerCommand('walTheme.update', generateColorThemes);
	context.subscriptions.push(disposable);

	// Start the auto update if enabled
	if(vscode.workspace.getConfiguration().get('walTheme.autoUpdate')) {
		generateColorThemes(); // Needed for when wal palette updates shile vscode isn't running
		autoUpdateWatcher = autoUpdate();
	}

	// Toggle the auto update in real time when changing the extension configuration
	vscode.workspace.onDidChangeConfiguration(event => {
		if(event.affectsConfiguration('walTheme.autoUpdate')) {
			if(vscode.workspace.getConfiguration().get('walTheme.autoUpdate')) {
				if(autoUpdateWatcher === null) {
					autoUpdateWatcher = autoUpdate();
				}
			}
			else if(autoUpdateWatcher !== null) {
				autoUpdateWatcher.close();
				autoUpdateWatcher = null;
			}
		}
	});

}

export function deactivate() {

	// Close the watcher if active
	if(autoUpdateWatcher !== null) {
		autoUpdateWatcher.close();
	}

}


/**
 * Generates the theme from the current color palette and overwrites the last one
 */
function generateColorThemes() {
	// Import colors from pywal cache
	let colors: Color[] = new Array(16);
	try {
		for (let i = 0; i < colors.length; i++) {
			let resources: string = execSync("xrdb -query -all | grep 'color" + i.toString() + ":'").toString();
			let matches = resources.match(/#[a-f\d]{6}/gi);
			if (matches !== null) {
				colors[i] = Color(matches[0]);
				console.log(colors[i]);
			} else {
				throw Error;
			}
		}
	} catch(error) {
		vscode.window.showErrorMessage('Couldn\'t load colors from pywal cache, be sure to run pywal before updating.');
		return;
	}
		
	// Generate the normal theme
	const colorTheme = template(colors, false);
	fs.writeFileSync(path.join(__dirname,'../themes/wal.json'), JSON.stringify(colorTheme, null, 4));
	
	// Generate the bordered theme
	const colorThemeBordered = template(colors, true);
	fs.writeFileSync(path.join(__dirname,'../themes/wal-bordered.json'), JSON.stringify(colorThemeBordered, null, 4));
}

/**
 * Automatically updates the theme when the color palette changes
 * @returns The watcher for the color palette
 */
function autoUpdate(): fs.FSWatcher {
	let fsWait = false;

	// Watch for changes in the color palette of wal
	return fs.watch(walColorsPath, (event, filename) => {
		if (filename) {
			// Delay after a change is found
			if (fsWait) {
				return;
			}
			fsWait = true;
			setTimeout(() => {
				fsWait = false;
			}, 100);
	
			// Update the theme
			console.log("Generating themes");
			generateColorThemes();
			vscode.commands.executeCommand("workbench.action.reloadWindow");
		}
	});
}
