> 🌐 [中文 (Simplified Chinese)](./README_zh-CN.md) | **English**
> 
# AI Skill Dock

## Introduction

**AI Skill Dock** is a management tool designed for AI-empowered IDEs (such as VS Code, Cursor, Antigravity, etc.). This extension provides a visual way to centrally manage your `SKILL.md` (Agent Prompt Playbooks) and local scripts. By simply clicking or dragging the icons on the interface, you can quickly insert shortcuts containing absolute paths or custom commands into AI chat boxes for immediate invocation.

## How to Use

### 1. Installation
Open the **Extensions** marketplace in VS Code (or a supported derived version) and search for **"AI Skill Dock"** to download and install. After installation and restarting/reloading the window, a corresponding entry icon will appear in the Activity Bar or Status Bar. Click it to open the panel.

### 2. Adding Skills or Scripts to the Interface

The extension provides three ways to add skills and scripts:

**(1) Select workspace + Sync (Skills Only):**
- Click the **"Settings"** button (gear icon) at the top of the panel and select **"Initialize Workspace (Init Workspace)"**.
- Select a local folder to serve as your working directory (the directory name can be anything and may contain various projects/subdirectories).
- Once selected, click the **"Sync"** button on the main interface. The extension will automatically scan the working directory and its subdirectories, extracting all files named `SKILL.md` and adding them as skill icons in the panel.

**(2) Via the "+" button on the panel (Both Skills and Scripts):**
- Click the **"Add"** button (+) at the top of the panel, and a file selector will pop up.
- You can manually select any skill file or script file on your machine (like `.py`, `.js`, or other external documents). The system will immediately create a new icon using its original file name.
- *(Note 1: Icons manually added this way or written directly into JSON will be permanently retained during the next "Sync" scan, ensuring they are not cleaned up simply because they are outside the current workspace directory.)*
- *(Note 2: For any added script program, it is strongly recommended that you provide a corresponding **`.md` explanatory file**. This effectively helps the AI Agent understand the purpose and usage of the script; otherwise, when faced with an unknown bare-code file, the Agent may need to load and scan the entire source code itself, resulting in unnecessary token consumption and resource waste.)*

**(3) By Modyfying `skills_registry.json` (Both Skills and Scripts):**
- Open the underlying `skills_registry.json` configuration file. You can manually insert correctly formatted key-value pairs into the `"skill": {}` dictionary (the key name is the icon name rendered in the UI). For example:
```json
"my-awesome-skill": {
  "path": "C:\\path\\to\\your\\any_skill.md",
  "command": "Use C:\\path\\to\\your\\any_skill.md to complete the task"
},
"my-data-script": {
  "path": "C:\\path\\to\\your\\script.py",
  "command": "Use C:\\path\\to\\your\\script.py to process data"
}
```
After saving the file, return to the extension panel and click "Sync" at the top to refresh. The newly added skill or script will then appear.

### 3. Removing Skills or Scripts from the Interface

**(1) Right-Click Method:**
- In the visual panel, hover your mouse over the skill or script icon you want to remove.
- **Right-click** to bring up the context menu, then click **Remove**. The item will be removed from the panel (this also deletes it from the json file and clears the associated SVG image cache locally).

**(2) By Modifying `skills_registry.json`:**
- Manually open the configuration file and find the dictionary node corresponding to the skill or script you want to remove under `"skill"`.
- **Delete this key-value block and save** the file. The UI will cull the item the next time it re-renders or when you click "Sync".

### 4. Customizing Commands for Each Skill or Script

The "command" refers to the plain text sentence that is sent to the AI (via the clipboard) when you click or drag a specific icon.

**How to modify:**
- Click **"Edit skill and json lists"** in the panel's top settings menu (or open `skills_registry.json` directly).
- Locate the dictionary for the corresponding skill or script and modify its `"command"` value.
- Change it to the specific prompt intention you want the AI to receive and save. For example: `Review my current code based on the guidance in this document: C:\\path\\to\\SKILL.md`.

### 5. Using it in the IDE's AI Chat Box

**(1) VS Code:**
- Click the icon of the skill or script on the panel.
- The command will be copied to the system clipboard, and the extension will automatically focus your cursor in the chat box of tools like Claude Code or GitHub Copilot.
- If focus shifts successfully, simply press `Ctrl + V` (Windows) in the input box to execute.

**(2) Cursor and Antigravity:**
- Similarly, click the target skill or script icon. The command is stored in the system clipboard.
- Because these versions use closed-source logic or highly modified underlying entry mechanisms, third-party extensions are sandboxed and cannot force focus redirection.
- In these products, you must manually left-click inside the IDE's right-side AI chat input box, then press `Ctrl + V` to paste and execute.

**(3) Others:**
- Not yet tested. You may try installing it first. Compatibility and testing for more derived editors will be addressed in future major updates.

### 6. Customizing the Interface Appearance

**(1) Via the settings button on the interface:**
- Click **Settings** -> **Appearance** on the top bar of the panel.
- A dropdown menu will appear at the top of the page, where you can select:
  - `dark`: Dark background (default).
  - `bright`: Bright white background.
  - `custom`: Opens a file selector, allowing you to choose any image (png/jpg, etc.) on your machine as the rendering background.

**(2) By Modifying `skills_registry.json`:**
- Find the `"appearance": { "background": "dark" }` node in the JSON hierarchy. Change `dark` to `bright` or to the specific absolute local path of an image. Save and refresh.
- *(Note: The current mainline version of the project does not involve layout changes. If there are residual layout settings in your JSON memory, they will be automatically removed in the next update.)*

---

## Personalized SVG Icon Theme Setup

When you sync or add a brand-new skill or script and no default image is provided, the extension uses a built-in simple hash table to assign a set of SVG background colors and matches an appropriate Emoji based on the application name.

**Absolute path of the default svg folder on your system:**
Since VS Code mostly stores offline extensions in completely hidden specific directories, the preferred landing location for these auto-generated SVGs is:
`C:\Users\[Your System Username]\.vscode\extensions\local.ai-skill-dock-0.0.1\media\default\`
*(If using Cursor, etc., it may be mounted in the `.cursor\extensions\...` directory instead)*

If you want to customize the skin yourself, simply create an `.icon.svg` image, name it strictly `<Name>.icon.svg`, test it, and place it in the absolute path directory mentioned above to overwrite the original image.

---

## Configuration File Introduction and Management

Core data and fine-tuning logic are hosted and configured via plain-text JSON. Their underlying absolute paths on the system are also located at:
`C:\Users\[Your System Username]\.vscode\extensions\local.ai-skill-dock-0.0.1\`

- **`skills_registry.json`**:
  The core database of the extension. It stores the local absolute paths corresponding to various functional icons, your custom appearance and working directory configurations, and a comprehensive record of the specifically reset `command` for each script. For completely personalized invocation intents, modify the `command` field of the selected program in this underlying file.
- **`prompt_templates.json`**:
  The global storage location for the extension's default command templates. It is strictly used to provide a basic plain-text wrapper for newly imported items that haven't yet had a `command` manually set.

---

## Support and Version Roadmap

- **(1) Windows OS**: The plugin currently natively supports foundational path configuration and interoperable clipboard operations within Windows environments.
- **(2) Mac OS & Linux Distributions (e.g. Ubuntu)**: Adaptations for core pathing and line-ending differences are underway. Full cross-platform support will be rolled out in upcoming releases.

---

## Source Code & Contact Us

If you encounter issues during use or wish to contribute to the project's development, you can submit an Issue or a Pull Request to the developer via the project repository link below:
[🔗 Project GitHub Repository](https://github.com/your-username/ai-skill-dock)
