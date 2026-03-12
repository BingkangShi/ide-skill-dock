// @ts-nocheck
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

class SkillDockProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._registryPath = path.join(extensionUri.fsPath, 'skills_registry.json');
        this._initRegistry();
    }

    _initRegistry() {
        if (!fs.existsSync(this._registryPath)) {
            const defaultRegistry = {
                workspace: "",
                icon_path: "default",
                skill: {},
                appearance: { background: 'dark' }
            };
            fs.writeFileSync(this._registryPath, JSON.stringify(defaultRegistry, null, 2), 'utf8');
        }
    }

    _readRegistry() {
        if (fs.existsSync(this._registryPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this._registryPath, 'utf8'));
                // Just delete old keys, do NOT merge them into skill
                delete data.py_script;
                delete data.script;
                delete data.layout;
                // Force dark as default
                if (!data.appearance) data.appearance = { background: 'dark' };
                if (data.appearance.background === 'bright') data.appearance.background = 'dark';
                return data;
            } catch (e) {
                console.error('Failed to read registry json', e);
            }
        }
        return { workspace: "", icon_path: "default", skill: {}, appearance: { background: 'dark' } };
    }

    _writeRegistry(data) {
        // Clean up old keys before writing
        const clean = Object.assign({}, data);
        delete clean.py_script;
        delete clean.script;
        delete clean.layout;
        fs.writeFileSync(this._registryPath, JSON.stringify(clean, null, 2), 'utf8');
    }


    _getTemplates() {
        const templatePath = path.join(this._extensionUri.fsPath, 'prompt_templates.json');
        if (!fs.existsSync(templatePath)) {
            return {
                skill_command: "Please complete the task using the guidelines in {path}.",
                script_command_with_doc: "Execute the script at {path} according to its documentation and usage at {doc_path}.",
                script_command_without_doc: "Execute the script at {path}."
            };
        }
        try {
            return JSON.parse(fs.readFileSync(templatePath, 'utf8'));
        } catch(e) {
            return {};
        }
    }

    _generateCommand(filePath) {
        const tpl = this._getTemplates();
        if (path.extname(filePath).toLowerCase() === '.md') {
            return (tpl.skill_command || "Please complete the task using the guidelines in {path}.").replace('{path}', filePath);
        } else {
            const md1 = filePath + '.md';
            const md2 = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)) + '.md');
            let doc = null;
            if (fs.existsSync(md1)) doc = md1;
            else if (fs.existsSync(md2)) doc = md2;
            
            if (doc) {
                return (tpl.script_command_with_doc || "Execute the script at {path} according to its documentation and usage at {doc_path}.").replace('{path}', filePath).replace('{doc_path}', doc);
            } else {
                return (tpl.script_command_without_doc || "Execute the script at {path}.").replace('{path}', filePath);
            }
        }
    }

    resolveWebviewView(webviewView, context, token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) this._updateWebview();
        });
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'refresh':
                    this._updateWebview();
                    break;
                case 'droppedFiles':
                    this._handleDroppedFiles(data.data);
                    break;
                case 'copy':
                    vscode.env.clipboard.writeText(data.text).then(() => {
                        vscode.window.showInformationMessage('\u5df2\u590d\u5236\uff0c\u8bf7\u5728\u804a\u5929\u6846\u4e2d\u6309 Ctrl+V \u7c98\u8d34\u3002');
                        const focusCommands = [
                            'antigravity.agentSidePanel.focus',
                            'antigravity.agentPanel.focus',
                            'antigravity.toggleChatFocus',
                            'antigravity.openAgent',
                            'claude-dev.SidebarProvider.focus',
                            'claude-vscode.focus',
                            'workbench.panel.chat.view.copilot.focus',
                            'workbench.panel.aichat.view.focus',
                            'workbench.action.chat.open',
                            'aichat.focus'
                        ];
                        (async () => {
                            for (const cmd of focusCommands) {
                                try { await vscode.commands.executeCommand(cmd); return; } catch (e) { }
                            }
                        })();
                    });
                    break;
                case 'removeItem':
                    {
                        const reg = this._readRegistry();
                        if (reg.skill && reg.skill[data.name]) {
                            delete reg.skill[data.name];
                            this._writeRegistry(reg);
                            const iconFile = path.join(path.dirname(this._registryPath), data.name + '.icon.svg');
                            if (fs.existsSync(iconFile)) try { fs.unlinkSync(iconFile); } catch (e) { }
                            vscode.window.showInformationMessage('Removed: ' + data.name);
                            this._updateWebview();
                        }
                    }
                    break;
            }
        });
        this._updateWebview();
    }

    async sync() {
        let registry = this._readRegistry();
        let workspace = registry.workspace;
        if (!workspace || !fs.existsSync(workspace)) {
            const resp = await vscode.window.showWarningMessage('Workspace not initialized or invalid. Select a workspace now?', 'Yes', 'No');
            if (resp === 'Yes') {
                await this.initWorkspace();
                registry = this._readRegistry();
                workspace = registry.workspace;
                if (!workspace) return;
            } else {
                return;
            }
        }
        vscode.window.showInformationMessage('Scanning workspace: ' + workspace + '...');

        // Ensure prompt_templates.json exists
        const templatePath = path.join(this._extensionUri.fsPath, 'prompt_templates.json');
        if (!fs.existsSync(templatePath)) {
            fs.writeFileSync(templatePath, JSON.stringify({ skill_command: "\u4f7f\u7528 {path} \u6765\u5b8c\u6210\u4efb\u52a1" }, null, 2), 'utf8');
        }
        let templates = { skill_command: "\u4f7f\u7528 {path} \u6765\u5b8c\u6210\u4efb\u52a1" };
        try { templates = JSON.parse(fs.readFileSync(templatePath, 'utf8')); } catch (e) { }

        const foundSkills = {};
        const walkSync = (dir, depth = 0) => {
            if (depth > 6) return;
            if (!fs.existsSync(dir)) return;
            try {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        const ignoredDirs = ['node_modules', '.git', '.venv', 'venv', '__pycache__'];
                        if (!ignoredDirs.includes(file)) walkSync(fullPath, depth + 1);
                    } else if (stat.isFile() && file === 'SKILL.md') {
                        foundSkills[path.basename(dir)] = fullPath;
                    }
                }
            } catch (e) { }
        };
        walkSync(workspace);

        const currentSkills = registry.skill || {};
        const newSkillsDict = {};
        // Keep existing skills
        for (const [name, existing] of Object.entries(currentSkills)) {
            if (existing && typeof existing === 'object' && existing.command) {
                newSkillsDict[name] = existing;
            } else if (typeof existing === 'string') {
                newSkillsDict[name] = {
                    path: existing,
                    command: (templates.skill_command || "\u4f7f\u7528 {path} \u6765\u5b8c\u6210\u4efb\u52a1").replace('{path}', existing)
                };
            }
        }
        // Override/add newly found
        for (const [name, p] of Object.entries(foundSkills)) {
            const existing = currentSkills[name];
            if (existing && typeof existing === 'object' && existing.command) {
                newSkillsDict[name] = { path: p, command: existing.command };
            } else {
                newSkillsDict[name] = {
                    path: p,
                    command: (templates.skill_command || "\u4f7f\u7528 {path} \u6765\u5b8c\u6210\u4efb\u52a1").replace('{path}', p)
                };
            }
        }
        registry.skill = newSkillsDict;
        this._writeRegistry(registry);
        vscode.window.showInformationMessage('\u540c\u6b65\u5b8c\u6210\uff0c\u5171\u52a0\u8f7d ' + Object.keys(newSkillsDict).length + ' skills.');
        this._ensureIconsGenerated(Object.keys(newSkillsDict));
        this._updateWebview();
    }

    async initWorkspace() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false, canSelectFolders: true, canSelectMany: false,
            openLabel: 'Select workspace directory'
        });
        if (uris && uris[0]) {
            const registry = this._readRegistry();
            registry.workspace = uris[0].fsPath;
            this._writeRegistry(registry);
            vscode.window.showInformationMessage('Workspace set to: ' + uris[0].fsPath);
            this._updateWebview();
        }
    }

    async _ensureIconsGenerated(skillNames) {
        const rootDir = path.dirname(this._registryPath);
        const keywordEmojiMap = {
            'paper': '\ud83d\udcc4', 'card': '\ud83d\udcc7', 'art': '\ud83c\udfa8', 'doc': '\ud83d\udcdd', 'code': '\ud83d\udcbb',
            'data': '\ud83d\udcca', 'web': '\ud83c\udf10', 'python': '\ud83d\udc0d', 'zip': '\ud83d\udce6', 'image': '\ud83d\uddbc\ufe0f',
            'merge': '\ud83d\udd17', 'download': '\u2b07\ufe0f', 'tool': '\ud83d\udee0\ufe0f', 'script': '\ud83d\udcdc', 'claw': '\ud83d\udd77\ufe0f',
            'py': '\ud83d\udc0d', 'js': '\ud83d\udcc4', 'frontend': '\ud83c\udfa8', 'pdf': '\ud83d\udcd5', 'pptx': '\ud83d\udcca',
            'xlsx': '\ud83d\udcca', 'slack': '\ud83d\udcac', 'gif': '\ud83c\udfac', 'brand': '\ud83c\udfa8', 'skill': '\u2699\ufe0f',
            'mcp': '\ud83d\udd0c', 'theme': '\ud83c\udfa8', 'test': '\ud83e\uddea', 'internal': '\ud83d\udce8', 'comms': '\ud83d\udce8'
        };
        for (const name of skillNames) {
            const iconPath = path.join(rootDir, name + '.icon.svg');
            if (!fs.existsSync(iconPath)) {
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                const hue = Math.abs(hash % 360);
                let emoji = '\u26a1';
                const lowerName = name.toLowerCase();
                for (const [key, val] of Object.entries(keywordEmojiMap)) {
                    if (lowerName.includes(key)) { emoji = val; break; }
                }
                const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'
                    + '<rect width="40" height="40" rx="8" fill="hsl(' + hue + ', 70%, 60%)"/>'
                    + '<text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="22">' + emoji + '</text>'
                    + '</svg>';
                fs.writeFileSync(iconPath, svg, 'utf8');
            }
        }
        this._updateWebview();
    }

    _handleDroppedFiles(dataString) {
        if (!dataString) return;
        const registry = this._readRegistry();
        const urls = dataString.split('\n');
        let addedCount = 0;
        for (const rawUrl of urls) {
            let cleanPath = rawUrl.trim();
            if (!cleanPath) continue;
            if (cleanPath.startsWith('file:///')) {
                cleanPath = decodeURIComponent(cleanPath.substring(8));
                if (cleanPath.match(/^[a-zA-Z]%3A/i)) cleanPath = decodeURIComponent(cleanPath);
            } else if (cleanPath.startsWith('file://')) {
                cleanPath = decodeURIComponent(cleanPath.substring(7));
            }
            cleanPath = path.normalize(cleanPath);
            const stat = fs.existsSync(cleanPath) ? fs.statSync(cleanPath) : null;
            if (stat && stat.isFile()) {
                const name = path.basename(cleanPath, path.extname(cleanPath));
                if (!registry.skill[name]) {
                    registry.skill[name] = { path: cleanPath, command: '\u4f7f\u7528 ' + cleanPath + ' \u6765\u5b8c\u6210\u4efb\u52a1' };
                    addedCount++;
                }
            }
        }
        if (addedCount > 0) {
            this._writeRegistry(registry);
            vscode.window.showInformationMessage('Successfully added ' + addedCount + ' \u4e2a\u6587\u4ef6\u6df7\u5165 Skill \u5217\u8868\uff01');
            this._ensureIconsGenerated(Object.keys(registry.skill));
            this._updateWebview();
        }
    }

    async editJson() {
        if (!fs.existsSync(this._registryPath)) this._initRegistry();
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(this._registryPath));
        await vscode.window.showTextDocument(doc);
    }

    async addFile() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Add to Skill list',
            filters: {
                'All Files': ['*']
            }
        });
        if (!uris || uris.length === 0) return;
        const registry = this._readRegistry();
        if (!registry.skill) registry.skill = {};
        let addedCount = 0;
        for (const uri of uris) {
            const filePath = uri.fsPath;
            const name = path.basename(filePath, path.extname(filePath));
            if (!registry.skill[name]) {
                registry.skill[name] = {
                    path: filePath,
                    command: '\u4f7f\u7528 ' + filePath + ' \u6765\u5b8c\u6210\u4efb\u52a1'
                };
                addedCount++;
            }
        }
        if (addedCount > 0) {
            this._writeRegistry(registry);
            vscode.window.showInformationMessage('Successfully added ' + addedCount + ' \u4e2a\u6587\u4ef6\u5230 Skill \u5217\u8868\uff01');
            this._ensureIconsGenerated(Object.keys(registry.skill));
            this._updateWebview();
        } else {
            vscode.window.showInformationMessage('Selected files already exist in the list.');
        }
    }

    async setAppearance() {
        const value = await vscode.window.showQuickPick([
            { label: 'dark', description: 'Dark background (Default)' },
            { label: 'bright', description: 'Bright background' },
            { label: 'custom', description: 'Select local image...' }
        ], { placeHolder: 'Select Appearance' });
        if (!value) return;
        let bgSetting = value.label;
        if (value.label === 'custom') {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false, openLabel: '\u9009\u62e9\u80cc\u666f\u56fe\u7247',
                filters: { 'Images': ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
            });
            if (uris && uris[0]) bgSetting = uris[0].fsPath;
        }
        const registry = this._readRegistry();
        if (!registry.appearance) registry.appearance = {};
        registry.appearance.background = bgSetting;
        this._writeRegistry(registry);
        this._updateWebview();
    }

    _updateWebview() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    _getHtmlForWebview(webview) {
        const registry = this._readRegistry();
        const skills = registry.skill || {};
        const appearance = registry.appearance || { background: 'dark' };

        let bgStyle = 'background-color:#1e1e1e;color:#cccccc;';
        if (appearance.background === 'bright') {
            bgStyle = 'background-color:#ffffff;color:#333333;';
        } else if (appearance.background === 'dark') {
            bgStyle = 'background-color:#1e1e1e;color:#cccccc;';
        } else {
            const imgUri = webview.asWebviewUri(vscode.Uri.file(appearance.background));
            bgStyle = "background-image:url('" + imgUri + "');background-size:cover;background-position:center;color:#ffffff;text-shadow:1px 1px 2px #000;";
        }

        // Build skill items HTML
        let skillsHtml = '';
        const rootDir = path.dirname(this._registryPath);
        for (const [name, p] of Object.entries(skills)) {
            const iconPath = path.join(rootDir, name + '.icon.svg');
            let iconContent;
            if (fs.existsSync(iconPath)) {
                const iconUri = webview.asWebviewUri(vscode.Uri.file(iconPath));
                iconContent = '<img src="' + iconUri + '" alt="' + name + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;"/>';
            } else {
                iconContent = '<div class="icon skill-icon">\u26a1</div>';
            }
            let commandData = p;
            if (typeof p === 'object' && p !== null) commandData = p.command || '';
            const safeCommand = String(commandData).replace(/"/g, '&quot;');
            const safeName = String(name).replace(/"/g, '&quot;');
            skillsHtml += '<div class="item" draggable="true" data-path="' + safeCommand + '" data-name="' + safeName + '">'
                + '<div class="icon" style="background:transparent;box-shadow:none;">' + iconContent + '</div>'
                + '<div class="name">' + name + '</div>'
                + '</div>';
        }

        return '<!DOCTYPE html>'
            + '<html lang="en">'
            + '<head>'
            + '<meta charset="UTF-8">'
            + '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
            + '<title>AI Skill Dock</title>'
            + '<style>'
            + 'body{margin:0;padding:0;font-family:var(--vscode-font-family),Arial,sans-serif;' + bgStyle + 'height:100vh;overflow:hidden;display:flex;align-items:center;}'
            + '.container{display:flex;flex-direction:row;align-items:center;width:100%;padding:0 10px;box-sizing:border-box;overflow-x:auto;overflow-y:hidden;}'
            + '.grid-container{display:flex;flex-wrap:nowrap;justify-content:flex-start;gap:15px;padding:5px 0;}'
            + '.item{display:flex;flex-direction:column;align-items:center;width:60px;cursor:grab;text-align:center;flex-shrink:0;}'
            + '.item:active{cursor:grabbing;}'
            + '.icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:5px;box-shadow:0 2px 5px rgba(0,0,0,0.2);transition:transform 0.1s;}'
            + '.item:hover .icon{transform:scale(1.05);}'
            + '.skill-icon{background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white!important;}'
            + '.name{font-size:11px;word-wrap:break-word;width:100%;line-height:1.2;}'
            + '.ctx-menu{display:none;position:fixed;background:#2d2d2d;border:1px solid #555;border-radius:6px;padding:4px 0;z-index:999;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:120px;}'
            + '.ctx-menu.show{display:block;}'
            + '.ctx-menu-item{padding:6px 16px;color:#ccc;font-size:12px;cursor:pointer;white-space:nowrap;}'
            + '.ctx-menu-item:hover{background:#3a3a3a;color:#fff;}'
            + '.container::-webkit-scrollbar{height:6px;}'
            + '.container::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.5);border-radius:3px;}'
            + '</style>'
            + '</head>'
            + '<body>'
            + '<div class="container">'
            + '<div class="grid-container">'
            + skillsHtml
            + '</div>'
            + '</div>'
            + '<div class="ctx-menu" id="ctxMenu"><div class="ctx-menu-item" id="ctxRemove">Remove</div></div>'
            + '<script>'
            + 'const vscode=acquireVsCodeApi();'
            + 'document.querySelectorAll(".item").forEach(function(el){'
            + 'el.addEventListener("dragstart",function(e){'
            + 'var pathData=e.currentTarget.getAttribute("data-path");'
            + 'e.dataTransfer.setData("text/plain",pathData);'
            + 'e.dataTransfer.setData("text/html",pathData);'
            + 'e.dataTransfer.effectAllowed="copy";'
            + '});'
            + 'el.addEventListener("click",function(e){'
            + 'var pathData=e.currentTarget.getAttribute("data-path");'
            + 'vscode.postMessage({type:"copy",text:pathData});'
            + 'var icon=e.currentTarget.querySelector(".icon");'
            + 'var old=icon.style.transform;'
            + 'icon.style.transform="scale(0.9)";'
            + 'setTimeout(function(){icon.style.transform=old||"";},150);'
            + '});'
            + '});'
            + 'var ctxMenu=document.getElementById("ctxMenu");'
            + 'var ctxTarget=null;'
            + 'document.querySelectorAll(".item").forEach(function(el){'
            + 'el.addEventListener("contextmenu",function(e){'
            + 'e.preventDefault();'
            + 'ctxTarget=e.currentTarget.getAttribute("data-name");'
            + 'ctxMenu.style.left=e.pageX+"px";'
            + 'ctxMenu.style.top=e.pageY+"px";'
            + 'ctxMenu.classList.add("show");'
            + '});'
            + '});'
            + 'document.getElementById("ctxRemove").addEventListener("click",function(){'
            + 'if(ctxTarget){vscode.postMessage({type:"removeItem",name:ctxTarget});}'
            + 'ctxMenu.classList.remove("show");ctxTarget=null;'
            + '});'
            + 'document.addEventListener("click",function(){ctxMenu.classList.remove("show");});'
            + 'document.addEventListener("dragover",function(e){e.preventDefault();});'
            + 'document.addEventListener("drop",function(e){'
            + 'e.preventDefault();'
            + 'var uriList=e.dataTransfer.getData("text/uri-list");'
            + 'if(uriList){vscode.postMessage({type:"droppedFiles",data:uriList});}else{'
            + 'var plainText=e.dataTransfer.getData("text/plain");'
            + 'if(plainText){vscode.postMessage({type:"droppedFiles",data:plainText});}}'
            + '});'
            + 'var container=document.querySelector(".container");'
            + 'if(container){container.addEventListener("wheel",function(e){'
            + 'if(e.deltaY!==0){e.preventDefault();container.scrollLeft+=e.deltaY;}'
            + '});}'
            + '</script>'
            + '</body>'
            + '</html>';
    }
}

module.exports = { SkillDockProvider };
