// @ts-nocheck
const vscode = require('vscode');
const { SkillDockProvider } = require('./SkillDockProvider');

function activate(context) {
    const provider = new SkillDockProvider(context.extensionUri);

    // Register the main webview view in the bottom panel
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('skill-dock.view', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // Create a status bar item for quick access (lightning bolt icon)
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'skill-dock.openPanel';
    statusBarItem.text = '$(zap) Skill Dock';
    statusBarItem.tooltip = '\u6253\u5f00 AI Skill Dock';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Command: open/focus the bottom panel
    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.openPanel', () => {
            vscode.commands.executeCommand('skill-dock.view.focus');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.sync', () => {
            provider.sync();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.settings.initWorkspace', () => {
            provider.initWorkspace();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.settings.editJson', () => {
            provider.editJson();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.settings.appearance', () => {
            provider.setAppearance();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('skill-dock.addFile', () => {
            provider.addFile();
        })
    );
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
