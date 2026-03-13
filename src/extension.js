// @ts-nocheck
const vscode = require('vscode');
const { IDESkillDockProvider } = require('./IDESkillDockProvider');

function activate(context) {
    const provider = new IDESkillDockProvider(context);

    // Register the main webview view in the bottom panel
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('ide-skill-dock.view', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Create a status bar item for quick access (lightning bolt icon)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'ide-skill-dock.openPanel';
    statusBarItem.text = '$(zap) IDE Skill Dock';
    statusBarItem.tooltip = '\u6253\u5f00 AI Skill Dock';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Command: open/focus the bottom panel
    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.openPanel', () => {
            vscode.commands.executeCommand('ide-skill-dock.view.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.sync', () => {
            provider.sync();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.settings.initWorkspace', () => {
            provider.initWorkspace();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.settings.editJson', () => {
            provider.editJson();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.settings.appearance', () => {
            provider.setAppearance();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('ide-skill-dock.addFile', () => {
            provider.addFile();
        })
    );
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
