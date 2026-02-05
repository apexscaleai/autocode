#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Colors
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');

// Parse args
const args = process.argv.slice(2);
const hasGlobal = args.includes('--global') || args.includes('-g');
const hasLocal = args.includes('--local') || args.includes('-l');
const hasOpencode = args.includes('--opencode');
const hasClaude = args.includes('--claude');
const hasGemini = args.includes('--gemini');
const hasCodex = args.includes('--codex');
const hasBoth = args.includes('--both'); // Legacy flag, keeps working
const hasAll = args.includes('--all');
const hasUninstall = args.includes('--uninstall') || args.includes('-u');

// Runtime selection - can be set by flags or interactive prompt
let selectedRuntimes = [];
if (hasAll) {
  selectedRuntimes = ['claude', 'opencode', 'gemini', 'codex'];
} else if (hasBoth) {
  selectedRuntimes = ['claude', 'opencode'];
} else {
  if (hasOpencode) selectedRuntimes.push('opencode');
  if (hasClaude) selectedRuntimes.push('claude');
  if (hasGemini) selectedRuntimes.push('gemini');
  if (hasCodex) selectedRuntimes.push('codex');
}

// Helper to get directory name for a runtime (used for local/project installs)
function getDirName(runtime) {
  if (runtime === 'opencode') return '.opencode';
  if (runtime === 'gemini') return '.gemini';
  if (runtime === 'codex') return '.codex';
  return '.claude';
}

/**
 * Get the global config directory for OpenCode
 * OpenCode follows XDG Base Directory spec and uses ~/.config/opencode/
 * Priority: OPENCODE_CONFIG_DIR > dirname(OPENCODE_CONFIG) > XDG_CONFIG_HOME/opencode > ~/.config/opencode
 */
function getOpencodeGlobalDir() {
  // 1. Explicit OPENCODE_CONFIG_DIR env var
  if (process.env.OPENCODE_CONFIG_DIR) {
    return expandTilde(process.env.OPENCODE_CONFIG_DIR);
  }
  
  // 2. OPENCODE_CONFIG env var (use its directory)
  if (process.env.OPENCODE_CONFIG) {
    return path.dirname(expandTilde(process.env.OPENCODE_CONFIG));
  }
  
  // 3. XDG_CONFIG_HOME/opencode
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(expandTilde(process.env.XDG_CONFIG_HOME), 'opencode');
  }
  
  // 4. Default: ~/.config/opencode (XDG default)
  return path.join(os.homedir(), '.config', 'opencode');
}

/**
 * Get the global config directory for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @param {string|null} explicitDir - Explicit directory from --config-dir flag
 */
function getGlobalDir(runtime, explicitDir = null) {
  if (runtime === 'opencode') {
    // For OpenCode, --config-dir overrides env vars
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    return getOpencodeGlobalDir();
  }
  
  if (runtime === 'gemini') {
    // Gemini: --config-dir > GEMINI_CONFIG_DIR > ~/.gemini
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.GEMINI_CONFIG_DIR) {
      return expandTilde(process.env.GEMINI_CONFIG_DIR);
    }
    return path.join(os.homedir(), '.gemini');
  }

  if (runtime === 'codex') {
    // Codex: --config-dir > CODEX_HOME > ~/.codex
    if (explicitDir) {
      return expandTilde(explicitDir);
    }
    if (process.env.CODEX_HOME) {
      return expandTilde(process.env.CODEX_HOME);
    }
    return path.join(os.homedir(), '.codex');
  }
  
  // Claude Code: --config-dir > CLAUDE_CONFIG_DIR > ~/.claude
  if (explicitDir) {
    return expandTilde(explicitDir);
  }
  if (process.env.CLAUDE_CONFIG_DIR) {
    return expandTilde(process.env.CLAUDE_CONFIG_DIR);
  }
  return path.join(os.homedir(), '.claude');
}

const banner = '\n' +
  cyan + '   █████╗  ██████╗\n' +
  '  ██╔══██╗██╔════╝\n' +
  '  ███████║██║\n' +
  '  ██╔══██║██║\n' +
  '  ██║  ██║╚██████╗\n' +
  '  ╚═╝  ╚═╝ ╚═════╝' + reset + '\n' +
  '\n' +
  '  AutoCode ' + dim + 'v' + pkg.version + reset + '\n' +
  '  A meta-prompting, context engineering and spec-driven\n' +
  '  development system for Claude Code, OpenCode, Gemini, and Codex (forked from Get Shit Done by TÂCHES).\n';

// Parse --config-dir argument
function parseConfigDirArg() {
  const configDirIndex = args.findIndex(arg => arg === '--config-dir' || arg === '-c');
  if (configDirIndex !== -1) {
    const nextArg = args[configDirIndex + 1];
    // Error if --config-dir is provided without a value or next arg is another flag
    if (!nextArg || nextArg.startsWith('-')) {
      console.error(`  ${yellow}--config-dir requires a path argument${reset}`);
      process.exit(1);
    }
    return nextArg;
  }
  // Also handle --config-dir=value format
  const configDirArg = args.find(arg => arg.startsWith('--config-dir=') || arg.startsWith('-c='));
  if (configDirArg) {
    const value = configDirArg.split('=')[1];
    if (!value) {
      console.error(`  ${yellow}--config-dir requires a non-empty path${reset}`);
      process.exit(1);
    }
    return value;
  }
  return null;
}
const explicitConfigDir = parseConfigDirArg();
const hasHelp = args.includes('--help') || args.includes('-h');
const forceStatusline = args.includes('--force-statusline');

console.log(banner);

// Show help if requested
if (hasHelp) {
  console.log(`  ${yellow}Usage:${reset} npx autocode-ac [options]\n\n  ${yellow}Options:${reset}\n    ${cyan}-g, --global${reset}              Install globally (to config directory)\n    ${cyan}-l, --local${reset}               Install locally (to current directory)\n    ${cyan}--claude${reset}                  Install for Claude Code only\n    ${cyan}--opencode${reset}                Install for OpenCode only\n    ${cyan}--gemini${reset}                  Install for Gemini only\n    ${cyan}--codex${reset}                   Install for Codex CLI only\n    ${cyan}--all${reset}                     Install for all runtimes\n    ${cyan}-u, --uninstall${reset}           Uninstall (remove all AutoCode-managed files)\n    ${cyan}-c, --config-dir <path>${reset}   Specify custom config directory\n    ${cyan}-h, --help${reset}                Show this help message\n    ${cyan}--force-statusline${reset}        Replace existing statusline config\n\n  ${yellow}Examples:${reset}\n    ${dim}# Interactive install (prompts for runtime and location)${reset}\n    npx autocode-ac\n\n    ${dim}# Install for Claude Code globally${reset}\n    npx autocode-ac --claude --global\n\n    ${dim}# Install for Codex globally${reset}\n    npx autocode-ac --codex --global\n\n    ${dim}# Install for Gemini globally${reset}\n    npx autocode-ac --gemini --global\n\n    ${dim}# Install for all runtimes globally${reset}\n    npx autocode-ac --all --global\n\n    ${dim}# Install to custom config directory${reset}\n    npx autocode-ac --claude --global --config-dir ~/.claude-bc\n\n    ${dim}# Install to current project only${reset}\n    npx autocode-ac --claude --local\n\n    ${dim}# Uninstall from Codex globally${reset}\n    npx autocode-ac --codex --global --uninstall\n\n  ${yellow}Notes:${reset}\n    The --config-dir option is useful when you have multiple configurations.\n    It takes priority over CLAUDE_CONFIG_DIR / GEMINI_CONFIG_DIR / CODEX_HOME environment variables.\n`);
  process.exit(0);
}

/**
 * Expand ~ to home directory (shell doesn't expand in env vars passed to node)
 */
function expandTilde(filePath) {
  if (filePath && filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Build a hook command path using forward slashes for cross-platform compatibility.
 * On Windows, $HOME is not expanded by cmd.exe/PowerShell, so we use the actual path.
 */
function buildHookCommand(configDir, hookName) {
  // Use forward slashes for Node.js compatibility on all platforms
  const hooksPath = configDir.replace(/\\/g, '/') + '/hooks/' + hookName;
  return `node "${hooksPath}"`;
}

/**
 * Read and parse settings.json, returning empty object if it doesn't exist
 */
function readSettings(settingsPath) {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

/**
 * Write settings.json with proper formatting
 */
function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

// Cache for attribution settings (populated once per runtime during install)
const attributionCache = new Map();

/**
 * Get commit attribution setting for a runtime
 * @param {string} runtime - 'claude', 'opencode', or 'gemini'
 * @returns {null|undefined|string} null = remove, undefined = keep default, string = custom
 */
function getCommitAttribution(runtime) {
  // Return cached value if available
  if (attributionCache.has(runtime)) {
    return attributionCache.get(runtime);
  }

  let result;

  if (runtime === 'opencode') {
    const config = readSettings(path.join(getGlobalDir('opencode', null), 'opencode.json'));
    result = config.disable_ai_attribution === true ? null : undefined;
  } else if (runtime === 'gemini') {
    // Gemini: check gemini settings.json for attribution config
    const settings = readSettings(path.join(getGlobalDir('gemini', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  } else if (runtime === 'codex') {
    // Codex CLI doesn't use Claude-style settings.json attribution; keep file defaults.
    result = undefined;
  } else {
    // Claude Code
    const settings = readSettings(path.join(getGlobalDir('claude', explicitConfigDir), 'settings.json'));
    if (!settings.attribution || settings.attribution.commit === undefined) {
      result = undefined;
    } else if (settings.attribution.commit === '') {
      result = null;
    } else {
      result = settings.attribution.commit;
    }
  }

  // Cache and return
  attributionCache.set(runtime, result);
  return result;
}

/**
 * Process Co-Authored-By lines based on attribution setting
 * @param {string} content - File content to process
 * @param {null|undefined|string} attribution - null=remove, undefined=keep, string=replace
 * @returns {string} Processed content
 */
function processAttribution(content, attribution) {
  if (attribution === null) {
    // Remove Co-Authored-By lines and the preceding blank line
    return content.replace(/(\r?\n){2}Co-Authored-By:.*$/gim, '');
  }
  if (attribution === undefined) {
    return content;
  }
  // Replace with custom attribution (escape $ to prevent backreference injection)
  const safeAttribution = attribution.replace(/\$/g, '$$$$');
  return content.replace(/Co-Authored-By:.*$/gim, `Co-Authored-By: ${safeAttribution}`);
}

/**
 * Convert Claude Code frontmatter to opencode format
 * - Converts 'allowed-tools:' array to 'permission:' object
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - Content with converted frontmatter
 */
// Color name to hex mapping for opencode compatibility
const colorNameToHex = {
  cyan: '#00FFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  magenta: '#FF00FF',
  orange: '#FFA500',
  purple: '#800080',
  pink: '#FFC0CB',
  white: '#FFFFFF',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
};

// Tool name mapping from Claude Code to OpenCode
// OpenCode uses lowercase tool names; special mappings for renamed tools
const claudeToOpencodeTools = {
  AskUserQuestion: 'question',
  SlashCommand: 'skill',
  TodoWrite: 'todowrite',
  WebFetch: 'webfetch',
  WebSearch: 'websearch',  // Plugin/MCP - keep for compatibility
};

// Tool name mapping from Claude Code to Gemini CLI
// Gemini CLI uses snake_case built-in tool names
const claudeToGeminiTools = {
  Read: 'read_file',
  Write: 'write_file',
  Edit: 'replace',
  Bash: 'run_shell_command',
  Glob: 'glob',
  Grep: 'search_file_content',
  WebSearch: 'google_web_search',
  WebFetch: 'web_fetch',
  TodoWrite: 'write_todos',
  AskUserQuestion: 'ask_user',
};

/**
 * Convert a Claude Code tool name to OpenCode format
 * - Applies special mappings (AskUserQuestion -> question, etc.)
 * - Converts to lowercase (except MCP tools which keep their format)
 */
function convertToolName(claudeTool) {
  // Check for special mapping first
  if (claudeToOpencodeTools[claudeTool]) {
    return claudeToOpencodeTools[claudeTool];
  }
  // MCP tools (mcp__*) keep their format
  if (claudeTool.startsWith('mcp__')) {
    return claudeTool;
  }
  // Default: convert to lowercase
  return claudeTool.toLowerCase();
}

/**
 * Convert a Claude Code tool name to Gemini CLI format
 * - Applies Claude→Gemini mapping (Read→read_file, Bash→run_shell_command, etc.)
 * - Filters out MCP tools (mcp__*) — they are auto-discovered at runtime in Gemini
 * - Filters out Task — agents are auto-registered as tools in Gemini
 * @returns {string|null} Gemini tool name, or null if tool should be excluded
 */
function convertGeminiToolName(claudeTool) {
  // MCP tools: exclude — auto-discovered from mcpServers config at runtime
  if (claudeTool.startsWith('mcp__')) {
    return null;
  }
  // Task: exclude — agents are auto-registered as callable tools
  if (claudeTool === 'Task') {
    return null;
  }
  // Check for explicit mapping
  if (claudeToGeminiTools[claudeTool]) {
    return claudeToGeminiTools[claudeTool];
  }
  // Default: lowercase
  return claudeTool.toLowerCase();
}

/**
 * Strip HTML <sub> tags for Gemini CLI output
 * Terminals don't support subscript — Gemini renders these as raw HTML.
 * Converts <sub>text</sub> to italic *(text)* for readable terminal output.
 */
function stripSubTags(content) {
  return content.replace(/<sub>(.*?)<\/sub>/g, '*($1)*');
}

/**
 * Convert Claude Code agent frontmatter to Gemini CLI format
 * Gemini agents use .md files with YAML frontmatter, same as Claude,
 * but with different field names and formats:
 * - tools: must be a YAML array (not comma-separated string)
 * - tool names: must use Gemini built-in names (read_file, not Read)
 * - color: must be removed (causes validation error)
 * - mcp__* tools: must be excluded (auto-discovered at runtime)
 */
function convertClaudeToGeminiAgent(content) {
  if (!content.startsWith('---')) return content;

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) return content;

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3);

  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const tools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Convert allowed-tools YAML array to tools list
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Handle inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        const parsed = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        for (const t of parsed) {
          const mapped = convertGeminiToolName(t);
          if (mapped) tools.push(mapped);
        }
      } else {
        // tools: with no value means YAML array follows
        inAllowedTools = true;
      }
      continue;
    }

    // Strip color field (not supported by Gemini CLI, causes validation error)
    if (trimmed.startsWith('color:')) continue;

    // Collect allowed-tools/tools array items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        const mapped = convertGeminiToolName(trimmed.substring(2).trim());
        if (mapped) tools.push(mapped);
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        inAllowedTools = false;
      }
    }

    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools as YAML array (Gemini requires array format)
  if (tools.length > 0) {
    newLines.push('tools:');
    for (const tool of tools) {
      newLines.push(`  - ${tool}`);
    }
  }

  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${stripSubTags(body)}`;
}

function convertClaudeToOpencodeFrontmatter(content) {
  // Replace tool name references in content (applies to all files)
  let convertedContent = content;
  convertedContent = convertedContent.replace(/\bAskUserQuestion\b/g, 'question');
  convertedContent = convertedContent.replace(/\bSlashCommand\b/g, 'skill');
  convertedContent = convertedContent.replace(/\bTodoWrite\b/g, 'todowrite');
  // Replace /ac:command with /ac-command for opencode (flat command structure)
  convertedContent = convertedContent.replace(/\/ac:/g, '/ac-');
  // Replace ~/.claude with ~/.config/opencode (OpenCode's correct config location)
  convertedContent = convertedContent.replace(/~\/\.claude\b/g, '~/.config/opencode');

  // Check if content has frontmatter
  if (!convertedContent.startsWith('---')) {
    return convertedContent;
  }

  // Find the end of frontmatter
  const endIndex = convertedContent.indexOf('---', 3);
  if (endIndex === -1) {
    return convertedContent;
  }

  const frontmatter = convertedContent.substring(3, endIndex).trim();
  const body = convertedContent.substring(endIndex + 3);

  // Parse frontmatter line by line (simple YAML parsing)
  const lines = frontmatter.split('\n');
  const newLines = [];
  let inAllowedTools = false;
  const allowedTools = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect start of allowed-tools array
    if (trimmed.startsWith('allowed-tools:')) {
      inAllowedTools = true;
      continue;
    }

    // Detect inline tools: field (comma-separated string)
    if (trimmed.startsWith('tools:')) {
      const toolsValue = trimmed.substring(6).trim();
      if (toolsValue) {
        // Parse comma-separated tools
        const tools = toolsValue.split(',').map(t => t.trim()).filter(t => t);
        allowedTools.push(...tools);
      }
      continue;
    }

    // Remove name: field - opencode uses filename for command name
    if (trimmed.startsWith('name:')) {
      continue;
    }

    // Convert color names to hex for opencode
    if (trimmed.startsWith('color:')) {
      const colorValue = trimmed.substring(6).trim().toLowerCase();
      const hexColor = colorNameToHex[colorValue];
      if (hexColor) {
        newLines.push(`color: "${hexColor}"`);
      } else if (colorValue.startsWith('#')) {
        // Validate hex color format (#RGB or #RRGGBB)
        if (/^#[0-9a-f]{3}$|^#[0-9a-f]{6}$/i.test(colorValue)) {
          // Already hex and valid, keep as is
          newLines.push(line);
        }
        // Skip invalid hex colors
      }
      // Skip unknown color names
      continue;
    }

    // Collect allowed-tools items
    if (inAllowedTools) {
      if (trimmed.startsWith('- ')) {
        allowedTools.push(trimmed.substring(2).trim());
        continue;
      } else if (trimmed && !trimmed.startsWith('-')) {
        // End of array, new field started
        inAllowedTools = false;
      }
    }

    // Keep other fields (including name: which opencode ignores)
    if (!inAllowedTools) {
      newLines.push(line);
    }
  }

  // Add tools object if we had allowed-tools or tools
  if (allowedTools.length > 0) {
    newLines.push('tools:');
    for (const tool of allowedTools) {
      newLines.push(`  ${convertToolName(tool)}: true`);
    }
  }

  // Rebuild frontmatter (body already has tool names converted)
  const newFrontmatter = newLines.join('\n').trim();
  return `---\n${newFrontmatter}\n---${body}`;
}

/**
 * Convert Claude Code markdown command to Gemini TOML format
 * @param {string} content - Markdown file content with YAML frontmatter
 * @returns {string} - TOML content
 */
function convertClaudeToGeminiToml(content) {
  // Check if content has frontmatter
  if (!content.startsWith('---')) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const endIndex = content.indexOf('---', 3);
  if (endIndex === -1) {
    return `prompt = ${JSON.stringify(content)}\n`;
  }

  const frontmatter = content.substring(3, endIndex).trim();
  const body = content.substring(endIndex + 3).trim();
  
  // Extract description from frontmatter
  let description = '';
  const lines = frontmatter.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('description:')) {
      description = trimmed.substring(12).trim();
      break;
    }
  }

  // Construct TOML
  let toml = '';
  if (description) {
    toml += `description = ${JSON.stringify(description)}\n`;
  }
  
  toml += `prompt = ${JSON.stringify(body)}\n`;
  
  return toml;
}

/**
 * Copy commands to a flat structure for OpenCode
 * OpenCode expects: command/ac-help.md (invoked as /ac-help)
 * Source structure: commands/ac/help.md
 * 
 * @param {string} srcDir - Source directory (e.g., commands/ac/)
 * @param {string} destDir - Destination directory (e.g., command/)
 * @param {string} prefix - Prefix for filenames (e.g., 'ac')
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude' or 'opencode')
 */
function copyFlattenedCommands(srcDir, destDir, prefix, pathPrefix, runtime) {
  if (!fs.existsSync(srcDir)) {
    return;
  }
  
  // Remove old <prefix>-*.md files before copying new ones
  if (fs.existsSync(destDir)) {
    for (const file of fs.readdirSync(destDir)) {
      if (file.startsWith(`${prefix}-`) && file.endsWith('.md')) {
        fs.unlinkSync(path.join(destDir, file));
      }
    }
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    
    if (entry.isDirectory()) {
      // Recurse into subdirectories, adding to prefix
      // e.g., commands/ac/debug/start.md -> command/ac-debug-start.md
      copyFlattenedCommands(srcPath, destDir, `${prefix}-${entry.name}`, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      // Flatten: help.md -> ac-help.md
      const baseName = entry.name.replace('.md', '');
      const destName = `${prefix}-${baseName}.md`;
      const destPath = path.join(destDir, destName);

      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      const opencodeDirRegex = /~\/\.opencode\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = content.replace(opencodeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));
      content = convertClaudeToOpencodeFrontmatter(content);

      fs.writeFileSync(destPath, content);
    }
  }
}

/**
 * Recursively copy directory, replacing paths in .md files
 * Deletes existing destDir first to remove orphaned files from previous versions
 * @param {string} srcDir - Source directory
 * @param {string} destDir - Destination directory
 * @param {string} pathPrefix - Path prefix for file references
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */
function copyWithPathReplacement(srcDir, destDir, pathPrefix, runtime) {
  const isOpencode = runtime === 'opencode';
  const dirName = getDirName(runtime);

  // Clean install: remove existing destination to prevent orphaned files
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true });
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyWithPathReplacement(srcPath, destPath, pathPrefix, runtime);
    } else if (entry.name.endsWith('.md')) {
      // Always replace ~/.claude/ as it is the source of truth in the repo
      let content = fs.readFileSync(srcPath, 'utf8');
      const claudeDirRegex = /~\/\.claude\//g;
      content = content.replace(claudeDirRegex, pathPrefix);
      content = processAttribution(content, getCommitAttribution(runtime));

      // Convert frontmatter for opencode compatibility
      if (isOpencode) {
        content = convertClaudeToOpencodeFrontmatter(content);
        fs.writeFileSync(destPath, content);
      } else if (runtime === 'gemini') {
        // Convert to TOML for Gemini (strip <sub> tags — terminals can't render subscript)
        content = stripSubTags(content);
        const tomlContent = convertClaudeToGeminiToml(content);
        // Replace extension with .toml
        const tomlPath = destPath.replace(/\.md$/, '.toml');
        fs.writeFileSync(tomlPath, tomlContent);
      } else {
        fs.writeFileSync(destPath, content);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Rewrite copied markdown content for Codex CLI.
 * Codex doesn't support slash commands like /ac:help, so we prefer $ac help.
 * We apply this only inside the installed skill directory (not in the repo source).
 */
function rewriteCodexSkillText(skillDir) {
  const targets = [
    path.join(skillDir, 'commands'),
    path.join(skillDir, 'autocode')
  ];

  const rewrite = (input) => {
    let out = input;

    // Program naming
    out = out.replace(/\bClaude Code\b/g, 'Codex CLI');
    out = out.replace(/\bRestart Claude Code\b/g, 'Restart Codex');
    out = out.replace(/\bLaunch Claude Code\b/g, 'Launch Codex');

    // Slash commands → Codex skill invocation
    // Example: /ac:plan-phase 1 -> $ac plan-phase 1
    out = out.replace(/\/ac:([a-z0-9-]+)/g, '$ac $1');
    // Example: /ac:<command> -> $ac <command>
    out = out.replace(/\/ac:</g, '$ac <');

    return out;
  };

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile() && p.endsWith('.md')) {
        const before = fs.readFileSync(p, 'utf8');
        const after = rewrite(before);
        if (after !== before) {
          fs.writeFileSync(p, after);
        }
      }
    }
  };

  for (const dir of targets) walk(dir);
}

/**
 * Clean up orphaned files from previous AutoCode versions
 */
function cleanupOrphanedFiles(configDir) {
  const orphanedFiles = [
    'hooks/ac-notify.sh',  // Removed upstream
    'hooks/ac-notify.sh',  // Removed in early AutoCode builds
    'hooks/statusline.js',  // Renamed upstream (statusline.js → ac-statusline.js → ac-statusline.js)
    'hooks/ac-statusline.js',  // Legacy
    'hooks/ac-check-update.js',  // Legacy
  ];

  for (const relPath of orphanedFiles) {
    const fullPath = path.join(configDir, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`  ${green}✓${reset} Removed orphaned ${relPath}`);
    }
  }
}

/**
 * Clean up orphaned hook registrations from settings.json
 */
function cleanupOrphanedHooks(settings) {
  const orphanedHookPatterns = [
    'ac-notify.sh', // Removed upstream
    'ac-notify.sh', // Removed in early AutoCode builds
    'hooks/statusline.js', // Legacy
    'ac-statusline.js', // Legacy
    'ac-check-update.js', // Legacy
    'ac-intel-index.js', // Removed upstream
    'ac-intel-session.js', // Removed upstream
    'ac-intel-prune.js', // Removed upstream
  ];

  let cleanedHooks = false;

  // Check all hook event types (Stop, SessionStart, etc.)
  if (settings.hooks) {
    for (const eventType of Object.keys(settings.hooks)) {
      const hookEntries = settings.hooks[eventType];
      if (Array.isArray(hookEntries)) {
        // Filter out entries that contain orphaned hooks
        const filtered = hookEntries.filter(entry => {
          if (entry.hooks && Array.isArray(entry.hooks)) {
            // Check if any hook in this entry matches orphaned patterns
            const hasOrphaned = entry.hooks.some(h =>
              h.command && orphanedHookPatterns.some(pattern => h.command.includes(pattern))
            );
            if (hasOrphaned) {
              cleanedHooks = true;
              return false;  // Remove this entry
            }
          }
          return true;  // Keep this entry
        });
        settings.hooks[eventType] = filtered;
      }
    }
  }

  if (cleanedHooks) {
    console.log(`  ${green}✓${reset} Removed orphaned hook registrations`);
  }

  // Fix #330: Update statusLine if it points to old statusline.js path
  if (settings.statusLine && settings.statusLine.command &&
      settings.statusLine.command.includes('statusline.js') &&
      !settings.statusLine.command.includes('ac-statusline.js')) {
    // Replace old path with new path
    settings.statusLine.command = settings.statusLine.command.replace(
      /statusline\.js/,
      'ac-statusline.js'
    );
    console.log(`  ${green}✓${reset} Updated statusline path (statusline.js → ac-statusline.js)`);
  }

  // Update legacy gsd-statusline.js path to ac-statusline.js
  if (settings.statusLine && settings.statusLine.command &&
      settings.statusLine.command.includes('gsd-statusline.js')) {
    settings.statusLine.command = settings.statusLine.command.replace(
      /gsd-statusline\.js/g,
      'ac-statusline.js'
    );
    console.log(`  ${green}✓${reset} Updated statusline path (gsd-statusline.js → ac-statusline.js)`);
  }

  return settings;
}

/**
 * Uninstall AutoCode from the specified directory for a specific runtime
 * Removes only AutoCode-managed files/directories, preserves user content
 * @param {boolean} isGlobal - Whether to uninstall from global or local
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */
function uninstall(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isCodex = runtime === 'codex';
  const dirName = getDirName(runtime);

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  let runtimeLabel = 'Claude Code';
  if (runtime === 'opencode') runtimeLabel = 'OpenCode';
  if (runtime === 'gemini') runtimeLabel = 'Gemini';
  if (runtime === 'codex') runtimeLabel = 'Codex CLI';

  console.log(`  Uninstalling AutoCode from ${cyan}${runtimeLabel}${reset} at ${cyan}${locationLabel}${reset}\n`);

  // Check if target directory exists
  if (!fs.existsSync(targetDir)) {
    console.log(`  ${yellow}⚠${reset} Directory does not exist: ${locationLabel}`);
    console.log(`  Nothing to uninstall.\n`);
    return;
  }

  let removedCount = 0;

  // Codex installs as a skill under skills/ac/
  if (isCodex) {
    const acSkillDir = path.join(targetDir, 'skills', 'ac');
    const legacySkillDir = path.join(targetDir, 'skills', 'gsd');
    if (fs.existsSync(acSkillDir)) {
      fs.rmSync(acSkillDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed skills/ac/`);
    }
    if (fs.existsSync(legacySkillDir)) {
      fs.rmSync(legacySkillDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed skills/ac/ (legacy)`);
    }

    if (removedCount === 0) {
      console.log(`  ${yellow}⚠${reset} No AutoCode files found to remove.`);
    }

    console.log(`
  ${green}Done!${reset} AutoCode has been uninstalled from ${runtimeLabel}.
  Your other files and settings have been preserved.
`);
    return;
  }

  // 1. Remove AutoCode commands directory
  if (isOpencode) {
    // OpenCode: remove command/ac-*.md files
    const commandDir = path.join(targetDir, 'command');
    if (fs.existsSync(commandDir)) {
      const files = fs.readdirSync(commandDir);
      for (const file of files) {
        if ((file.startsWith('ac-') || file.startsWith('ac-')) && file.endsWith('.md')) {
          fs.unlinkSync(path.join(commandDir, file));
          removedCount++;
        }
      }
      console.log(`  ${green}✓${reset} Removed AutoCode commands from command/`);
    }
  } else {
    // Claude Code & Gemini: remove commands/ac/ directory
    const acCommandsDir = path.join(targetDir, 'commands', 'ac');
    const legacyCommandsDir = path.join(targetDir, 'commands', 'gsd');
    if (fs.existsSync(acCommandsDir)) {
      fs.rmSync(acCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/ac/`);
    }
    if (fs.existsSync(legacyCommandsDir)) {
      fs.rmSync(legacyCommandsDir, { recursive: true });
      removedCount++;
      console.log(`  ${green}✓${reset} Removed commands/ac/ (legacy)`);
    }
  }

  // 2. Remove autocode directory (AutoCode system content)
  const autocodeDir = path.join(targetDir, 'autocode');
  const legacyDocsDir = path.join(targetDir, 'get-shit-done');
  if (fs.existsSync(autocodeDir)) {
    fs.rmSync(autocodeDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed autocode/`);
  }
  if (fs.existsSync(legacyDocsDir)) {
    fs.rmSync(legacyDocsDir, { recursive: true });
    removedCount++;
    console.log(`  ${green}✓${reset} Removed get-shit-done/ (legacy)`);
  }

  // 3. Remove AutoCode agents (ac-*.md files only)
  const agentsDir = path.join(targetDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir);
    let agentCount = 0;
    for (const file of files) {
      if ((file.startsWith('ac-') || file.startsWith('ac-')) && file.endsWith('.md')) {
        fs.unlinkSync(path.join(agentsDir, file));
        agentCount++;
      }
    }
    if (agentCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${agentCount} AutoCode agents`);
    }
  }

  // 4. Remove AutoCode hooks
  const hooksDir = path.join(targetDir, 'hooks');
  if (fs.existsSync(hooksDir)) {
    const hooksToRemove = [
      'ac-statusline.js',
      'ac-check-update.js',
      'ac-check-update.sh',
      'ac-statusline.js', // legacy
      'ac-check-update.js', // legacy
      'ac-check-update.sh', // legacy
      'statusline.js', // legacy
    ];
    let hookCount = 0;
    for (const hook of hooksToRemove) {
      const hookPath = path.join(hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        hookCount++;
      }
    }
    if (hookCount > 0) {
      removedCount++;
      console.log(`  ${green}✓${reset} Removed ${hookCount} AutoCode hooks`);
    }
  }

  // 5. Clean up settings.json (remove AutoCode hooks and statusline)
  const settingsPath = path.join(targetDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    let settings = readSettings(settingsPath);
    let settingsModified = false;

    // Remove AutoCode statusline if it references our hook
    if (settings.statusLine && settings.statusLine.command &&
        (settings.statusLine.command.includes('ac-statusline') || settings.statusLine.command.includes('ac-statusline'))) {
      delete settings.statusLine;
      settingsModified = true;
      console.log(`  ${green}✓${reset} Removed AutoCode statusline from settings`);
    }

    // Remove AutoCode hooks from SessionStart
    if (settings.hooks && settings.hooks.SessionStart) {
      const before = settings.hooks.SessionStart.length;
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(entry => {
        if (entry.hooks && Array.isArray(entry.hooks)) {
          // Filter out AutoCode hooks
          const hasAutoCodeHook = entry.hooks.some(h =>
            h.command && (
              h.command.includes('ac-check-update') ||
              h.command.includes('ac-statusline') ||
              h.command.includes('ac-check-update') ||
              h.command.includes('ac-statusline')
            )
          );
          return !hasAutoCodeHook;
        }
        return true;
      });
      if (settings.hooks.SessionStart.length < before) {
        settingsModified = true;
        console.log(`  ${green}✓${reset} Removed AutoCode hooks from settings`);
      }
      // Clean up empty array
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
      // Clean up empty hooks object
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks;
      }
    }

    if (settingsModified) {
      writeSettings(settingsPath, settings);
      removedCount++;
    }
  }

  // 6. For OpenCode, clean up permissions from opencode.json
  if (isOpencode) {
    const opencodeConfigDir = getOpencodeGlobalDir();
    const configPath = path.join(opencodeConfigDir, 'opencode.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        let modified = false;

        // Remove AutoCode permission entries
        if (config.permission) {
          for (const permType of ['read', 'external_directory']) {
            if (config.permission[permType]) {
              const keys = Object.keys(config.permission[permType]);
              for (const key of keys) {
                if (key.includes('autocode')) {
                  delete config.permission[permType][key];
                  modified = true;
                }
              }
              // Clean up empty objects
              if (Object.keys(config.permission[permType]).length === 0) {
                delete config.permission[permType];
              }
            }
          }
          if (Object.keys(config.permission).length === 0) {
            delete config.permission;
          }
        }

        if (modified) {
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
          removedCount++;
          console.log(`  ${green}✓${reset} Removed AutoCode permissions from opencode.json`);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }

  if (removedCount === 0) {
    console.log(`  ${yellow}⚠${reset} No AutoCode files found to remove.`);
  }

  console.log(`
  ${green}Done!${reset} AutoCode has been uninstalled from ${runtimeLabel}.
  Your other files and settings have been preserved.
`);
}

/**
 * Configure OpenCode permissions to allow reading AutoCode reference docs
 * This prevents permission prompts when AutoCode accesses the autocode directory
 */
function configureOpencodePermissions() {
  // OpenCode config file is at ~/.config/opencode/opencode.json
  const opencodeConfigDir = getOpencodeGlobalDir();
  const configPath = path.join(opencodeConfigDir, 'opencode.json');

  // Ensure config directory exists
  fs.mkdirSync(opencodeConfigDir, { recursive: true });

  // Read existing config or create empty object
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      // Invalid JSON - start fresh but warn user
      console.log(`  ${yellow}⚠${reset} opencode.json had invalid JSON, recreating`);
    }
  }

  // Ensure permission structure exists
  if (!config.permission) {
    config.permission = {};
  }

  // Build the AutoCode path using the actual config directory
  // Use ~ shorthand if it's in the default location, otherwise use full path
  const defaultConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const acPath = opencodeConfigDir === defaultConfigDir
    ? '~/.config/opencode/autocode/*'
    : `${opencodeConfigDir}/autocode/*`;
  
  let modified = false;

  // Configure read permission
  if (!config.permission.read || typeof config.permission.read !== 'object') {
    config.permission.read = {};
  }
  if (config.permission.read[acPath] !== 'allow') {
    config.permission.read[acPath] = 'allow';
    modified = true;
  }

  // Configure external_directory permission (the safety guard for paths outside project)
  if (!config.permission.external_directory || typeof config.permission.external_directory !== 'object') {
    config.permission.external_directory = {};
  }
  if (config.permission.external_directory[acPath] !== 'allow') {
    config.permission.external_directory[acPath] = 'allow';
    modified = true;
  }

  if (!modified) {
    return; // Already configured
  }

  // Write config back
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log(`  ${green}✓${reset} Configured read permission for AutoCode docs`);
}

/**
 * Verify a directory exists and contains files
 */
function verifyInstalled(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory not created`);
    return false;
  }
  try {
    const entries = fs.readdirSync(dirPath);
    if (entries.length === 0) {
      console.error(`  ${yellow}✗${reset} Failed to install ${description}: directory is empty`);
      return false;
    }
  } catch (e) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: ${e.message}`);
    return false;
  }
  return true;
}

/**
 * Verify a file exists
 */
function verifyFileInstalled(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`  ${yellow}✗${reset} Failed to install ${description}: file not created`);
    return false;
  }
  return true;
}

/**
 * Install to the specified directory for a specific runtime
 * @param {boolean} isGlobal - Whether to install globally or locally
 * @param {string} runtime - Target runtime ('claude', 'opencode', 'gemini')
 */
function install(isGlobal, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';
  const isGemini = runtime === 'gemini';
  const isCodex = runtime === 'codex';
  const dirName = getDirName(runtime);
  const src = path.join(__dirname, '..');

  // Get the target directory based on runtime and install type
  const targetDir = isGlobal
    ? getGlobalDir(runtime, explicitConfigDir)
    : path.join(process.cwd(), dirName);

  const locationLabel = isGlobal
    ? targetDir.replace(os.homedir(), '~')
    : targetDir.replace(process.cwd(), '.');

  if (isCodex) {
    const failures = [];
    const skillsDir = path.join(targetDir, 'skills');
    const acSkillDir = path.join(skillsDir, 'ac');

    // For Codex, rewrite ~/.claude/* references to the skill directory itself.
    const codexPathPrefix = acSkillDir.replace(/\\/g, '/') + '/';

    console.log(`  Installing for ${cyan}Codex CLI${reset} to ${cyan}${locationLabel}${reset}\n`);

    fs.mkdirSync(skillsDir, { recursive: true });

    // Clean install: remove existing skill dir to prevent orphaned files
    if (fs.existsSync(acSkillDir)) {
      fs.rmSync(acSkillDir, { recursive: true });
    }
    fs.mkdirSync(acSkillDir, { recursive: true });

    // Write SKILL.md first so the skill is visible even if a later copy fails
    writeCodexSkill(acSkillDir);
    if (verifyFileInstalled(path.join(acSkillDir, 'SKILL.md'), 'SKILL.md')) {
      console.log(`  ${green}✓${reset} Wrote SKILL.md`);
    } else {
      failures.push('SKILL.md');
    }

    // Copy command prompts (for routing), references, templates, and agents into the skill dir.
    const commandsSrc = path.join(src, 'commands', 'ac');
    const commandsDest = path.join(acSkillDir, 'commands', 'ac');
    copyWithPathReplacement(commandsSrc, commandsDest, codexPathPrefix, runtime);
    if (verifyInstalled(commandsDest, 'commands/ac')) {
      console.log(`  ${green}✓${reset} Installed commands/ac`);
    } else {
      failures.push('commands/ac');
    }

    const docsSrc = path.join(src, 'autocode');
    const docsDest = path.join(acSkillDir, 'autocode');
    copyWithPathReplacement(docsSrc, docsDest, codexPathPrefix, runtime);
    if (verifyInstalled(docsDest, 'autocode')) {
      console.log(`  ${green}✓${reset} Installed autocode`);
    } else {
      failures.push('autocode');
    }

    const agentsSrc = path.join(src, 'agents');
    if (fs.existsSync(agentsSrc)) {
      const agentsDest = path.join(acSkillDir, 'agents');
      fs.mkdirSync(agentsDest, { recursive: true });
      // Copy agents using the same path replacement logic
      copyWithPathReplacement(agentsSrc, agentsDest, codexPathPrefix, runtime);
      if (verifyInstalled(agentsDest, 'agents')) {
        console.log(`  ${green}✓${reset} Installed agents`);
      } else {
        failures.push('agents');
      }
    }

    // Copy CHANGELOG.md into the bundled docs
    const changelogSrc = path.join(src, 'CHANGELOG.md');
    const changelogDest = path.join(acSkillDir, 'autocode', 'CHANGELOG.md');
    if (fs.existsSync(changelogSrc)) {
      fs.copyFileSync(changelogSrc, changelogDest);
      if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {
        console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
      } else {
        failures.push('CHANGELOG.md');
      }
    }

    // Write VERSION file into bundled docs
    const versionDest = path.join(acSkillDir, 'autocode', 'VERSION');
    fs.writeFileSync(versionDest, pkg.version);
    if (verifyFileInstalled(versionDest, 'VERSION')) {
      console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);
    } else {
      failures.push('VERSION');
    }

    // Rewrite command/docs text to match Codex UX ($ac ... instead of /ac:...)
    rewriteCodexSkillText(acSkillDir);

    if (failures.length > 0) {
      console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
      process.exit(1);
    }

    return { runtime, codexSkillDir: acSkillDir };
  }

  // Path prefix for file references in markdown content
  // For global installs: use full path
  // For local installs: use relative
  const pathPrefix = isGlobal
    ? `${targetDir}/`
    : `./${dirName}/`;

  let runtimeLabel = 'Claude Code';
  if (isOpencode) runtimeLabel = 'OpenCode';
  if (isGemini) runtimeLabel = 'Gemini';
  if (runtime === 'codex') runtimeLabel = 'Codex CLI';

  console.log(`  Installing for ${cyan}${runtimeLabel}${reset} to ${cyan}${locationLabel}${reset}\n`);

  // Track installation failures
  const failures = [];

  // Clean up orphaned files from previous versions
  cleanupOrphanedFiles(targetDir);

  // OpenCode uses 'command/' (singular) with flat structure
  // Claude Code & Gemini use 'commands/' (plural) with nested structure
  if (isOpencode) {
    // OpenCode: flat structure in command/ directory
    const commandDir = path.join(targetDir, 'command');
    fs.mkdirSync(commandDir, { recursive: true });
    
    // Copy commands/ac/*.md as command/ac-*.md (flatten structure)
    const acSrc = path.join(src, 'commands', 'ac');
    copyFlattenedCommands(acSrc, commandDir, 'ac', pathPrefix, runtime);
    if (verifyInstalled(commandDir, 'command/ac-*')) {
      const count = fs.readdirSync(commandDir).filter(f => f.startsWith('ac-')).length;
      console.log(`  ${green}✓${reset} Installed ${count} commands to command/`);
    } else {
      failures.push('command/ac-*');
    }
  } else {
    // Claude Code & Gemini: nested structure in commands/ directory
    const commandsDir = path.join(targetDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    
    const acSrc = path.join(src, 'commands', 'ac');
    const acDest = path.join(commandsDir, 'ac');
    copyWithPathReplacement(acSrc, acDest, pathPrefix, runtime);
    if (verifyInstalled(acDest, 'commands/ac')) {
      console.log(`  ${green}✓${reset} Installed commands/ac`);
    } else {
      failures.push('commands/ac');
    }
  }

  // Copy autocode skill with path replacement
  const skillSrc = path.join(src, 'autocode');
  const skillDest = path.join(targetDir, 'autocode');
  copyWithPathReplacement(skillSrc, skillDest, pathPrefix, runtime);
  if (verifyInstalled(skillDest, 'autocode')) {
    console.log(`  ${green}✓${reset} Installed autocode`);
  } else {
    failures.push('autocode');
  }

  // Copy agents to agents directory
  const agentsSrc = path.join(src, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsDest = path.join(targetDir, 'agents');
    fs.mkdirSync(agentsDest, { recursive: true });

    // Remove old AutoCode agents (ac-*.md / ac-*.md) before copying new ones
    if (fs.existsSync(agentsDest)) {
      for (const file of fs.readdirSync(agentsDest)) {
        if ((file.startsWith('ac-') || file.startsWith('ac-')) && file.endsWith('.md')) {
          fs.unlinkSync(path.join(agentsDest, file));
        }
      }
    }

    // Copy new agents
    const agentEntries = fs.readdirSync(agentsSrc, { withFileTypes: true });
    for (const entry of agentEntries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        let content = fs.readFileSync(path.join(agentsSrc, entry.name), 'utf8');
        // Always replace ~/.claude/ as it is the source of truth in the repo
        const dirRegex = /~\/\.claude\//g;
        content = content.replace(dirRegex, pathPrefix);
        content = processAttribution(content, getCommitAttribution(runtime));
        // Convert frontmatter for runtime compatibility
        if (isOpencode) {
          content = convertClaudeToOpencodeFrontmatter(content);
        } else if (isGemini) {
          content = convertClaudeToGeminiAgent(content);
        }
        fs.writeFileSync(path.join(agentsDest, entry.name), content);
      }
    }
    if (verifyInstalled(agentsDest, 'agents')) {
      console.log(`  ${green}✓${reset} Installed agents`);
    } else {
      failures.push('agents');
    }
  }

  // Copy CHANGELOG.md
  const changelogSrc = path.join(src, 'CHANGELOG.md');
  const changelogDest = path.join(targetDir, 'autocode', 'CHANGELOG.md');
  if (fs.existsSync(changelogSrc)) {
    fs.copyFileSync(changelogSrc, changelogDest);
    if (verifyFileInstalled(changelogDest, 'CHANGELOG.md')) {
      console.log(`  ${green}✓${reset} Installed CHANGELOG.md`);
    } else {
      failures.push('CHANGELOG.md');
    }
  }

  // Write VERSION file
  const versionDest = path.join(targetDir, 'autocode', 'VERSION');
  fs.writeFileSync(versionDest, pkg.version);
  if (verifyFileInstalled(versionDest, 'VERSION')) {
    console.log(`  ${green}✓${reset} Wrote VERSION (${pkg.version})`);
  } else {
    failures.push('VERSION');
  }

  // Copy hooks from dist/ (bundled with dependencies)
  const hooksSrc = path.join(src, 'hooks', 'dist');
  if (fs.existsSync(hooksSrc)) {
    const hooksDest = path.join(targetDir, 'hooks');
    fs.mkdirSync(hooksDest, { recursive: true });
    const hookEntries = fs.readdirSync(hooksSrc);
    for (const entry of hookEntries) {
      const srcFile = path.join(hooksSrc, entry);
      if (fs.statSync(srcFile).isFile()) {
        const destFile = path.join(hooksDest, entry);
        fs.copyFileSync(srcFile, destFile);
      }
    }
    if (verifyInstalled(hooksDest, 'hooks')) {
      console.log(`  ${green}✓${reset} Installed hooks (bundled)`);
    } else {
      failures.push('hooks');
    }
  }

  if (failures.length > 0) {
    console.error(`\n  ${yellow}Installation incomplete!${reset} Failed: ${failures.join(', ')}`);
    process.exit(1);
  }

  // Configure statusline and hooks in settings.json
  // Gemini shares same hook system as Claude Code for now
  const settingsPath = path.join(targetDir, 'settings.json');
  const settings = cleanupOrphanedHooks(readSettings(settingsPath));
  const statuslineCommand = isGlobal
    ? buildHookCommand(targetDir, 'ac-statusline.js')
    : 'node ' + dirName + '/hooks/ac-statusline.js';
  const updateCheckCommand = isGlobal
    ? buildHookCommand(targetDir, 'ac-check-update.js')
    : 'node ' + dirName + '/hooks/ac-check-update.js';

  // Enable experimental agents for Gemini CLI (required for custom sub-agents)
  if (isGemini) {
    if (!settings.experimental) {
      settings.experimental = {};
    }
    if (!settings.experimental.enableAgents) {
      settings.experimental.enableAgents = true;
      console.log(`  ${green}✓${reset} Enabled experimental agents`);
    }
  }

  // Configure SessionStart hook for update checking (skip for opencode)
  if (!isOpencode) {
    if (!settings.hooks) {
      settings.hooks = {};
    }
    if (!settings.hooks.SessionStart) {
      settings.hooks.SessionStart = [];
    }

    const hasUpdateHook = settings.hooks.SessionStart.some(entry =>
      entry.hooks && entry.hooks.some(h => h.command && h.command.includes('ac-check-update'))
    );

    if (!hasUpdateHook) {
      settings.hooks.SessionStart.push({
        hooks: [
          {
            type: 'command',
            command: updateCheckCommand
          }
        ]
      });
      console.log(`  ${green}✓${reset} Configured update check hook`);
    }
  }

  return { settingsPath, settings, statuslineCommand, runtime };
}

/**
 * Write the Codex skill definition for AutoCode.
 * The actual AutoCode system prompts and references are copied into this skill directory.
 */
function writeCodexSkill(skillDir) {
  const skill = [
    '---',
    'name: ac',
    'description: Spec-driven development workflows (AutoCode) for Codex CLI. Uses .planning/ state files to plan, execute, and verify work.',
    'metadata:',
    '  short-description: AutoCode project workflow',
    '---',
    '',
    '# AutoCode',
    '',
    'This installs AutoCode as a Codex Skill. It’s a lightweight spec-driven development system that creates and maintains project state in `.planning/` and guides you through planning → execution → verification.',
    '',
    '## How to Use',
    '',
    '- Invoke: `$ac <command> [args]`',
    '- If you already have muscle memory from Claude Code, you can also paste `/ac:<command>` and I’ll treat it the same.',
    '- Verification-first: when a command includes success criteria, don’t stop until they are met. Run relevant tests/lint/build where applicable.',
    '',
    '## Commands (mirror Claude’s /ac:* set)',
    '',
    '- `help`',
    '- `new-project`',
    '- `new-milestone`',
    '- `map-codebase`',
    '- `plan-phase <n>`',
    '- `execute-phase <n>`',
    '- `discuss-phase <n>`',
    '- `verify-work`',
    '- `progress`',
    '- `add-phase`, `insert-phase`, `remove-phase`',
    '- `add-todo`, `check-todos`, `pause-work`, `resume-work`',
    '- `kanban`',
    '- `settings`, `set-profile`, `update`, `join-discord`',
    '',
    '## Power Features',
    '',
    '- Kanban UI: run the `kanban` command (or directly: `node autocode/tools/kanban.js`) to manage `.planning/todos/` visually.',
    '- Autopilot loop (optional): you can run `node autocode/tools/autopilot.js "<goal>" --verify "<cmd>"` to keep iterating until verification passes.',
    '',
    '## What’s Bundled In This Skill',
    '',
    '- `commands/ac/`: the original prompts (used as the source of truth)',
    '- `autocode/`: workflows, references, and templates',
    '- `agents/`: role prompts (planner/executor/verifier/researcher)',
    '',
    '## Codex Adaptation Rules',
    '',
    'These prompts were authored for Claude Code/OpenCode/Gemini. When following the command prompts:',
    '',
    '- Treat `AskUserQuestion` as “ask the user a multiple-choice question inline”.',
    '- Treat `Task(...)` sub-agent spawning as “do that work yourself”, and when “parallel” is requested, do it sequentially but keep outputs clearly separated.',
    '- Treat `Bash` as running shell commands via Codex.',
    '',
    '## Command Router',
    '',
    'When invoked, do this:',
    '',
    '1. Parse the user’s requested command (supports `help`, `/ac:help`, `/ac-help`, etc.).',
    '2. Read `commands/ac/<command>.md`.',
    '3. Follow the file’s `<objective>`, `<execution_context>`, and `<process>` to completion.',
    '4. Create/update project files under `.planning/` as specified.',
    '',
    'If a command isn’t found, list available files under `commands/ac/` and ask which to run.',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill);
}

/**
 * Apply statusline config, then print completion message
 */
function finishInstall(settingsPath, settings, statuslineCommand, shouldInstallStatusline, runtime = 'claude') {
  const isOpencode = runtime === 'opencode';

  if (shouldInstallStatusline && !isOpencode) {
    settings.statusLine = {
      type: 'command',
      command: statuslineCommand
    };
    console.log(`  ${green}✓${reset} Configured statusline`);
  }

  // Always write settings
  writeSettings(settingsPath, settings);

  // Configure OpenCode permissions
  if (isOpencode) {
    configureOpencodePermissions();
  }

  let program = 'Claude Code';
  if (runtime === 'opencode') program = 'OpenCode';
  if (runtime === 'gemini') program = 'Gemini';
  if (runtime === 'codex') program = 'Codex CLI';

  const command = isOpencode ? '/ac-help' : '/ac:help';
  console.log(`
  ${green}Done!${reset} Launch ${program} and run ${cyan}${command}${reset}.

  ${cyan}Join the community:${reset} https://discord.gg/5JJgD5svVS
`);
}

function finishCodexInstall(codexSkillDir) {
  const locationLabel = codexSkillDir.replace(os.homedir(), '~');
  console.log(`
  ${green}Done!${reset} Restart ${cyan}Codex${reset} to pick up the new skill.

  Then run:
    ${cyan}$ac help${reset}

  Installed at: ${dim}${locationLabel}${reset}

  ${cyan}Join the community:${reset} https://discord.gg/5JJgD5svVS
`);
}

/**
 * Handle statusline configuration with optional prompt
 */
function handleStatusline(settings, isInteractive, callback) {
  const hasExisting = settings.statusLine != null;

  if (!hasExisting) {
    callback(true);
    return;
  }

  if (forceStatusline) {
    callback(true);
    return;
  }

  if (!isInteractive) {
    console.log(`  ${yellow}⚠${reset} Skipping statusline (already configured)`);
    console.log(`    Use ${cyan}--force-statusline${reset} to replace\n`);
    callback(false);
    return;
  }

  const existingCmd = settings.statusLine.command || settings.statusLine.url || '(custom)';

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log(`
  ${yellow}⚠${reset} Existing statusline detected\n
  Your current statusline:
    ${dim}command: ${existingCmd}${reset}

  AutoCode includes a statusline showing:
    • Model name
    • Current task (from todo list)
    • Context window usage (color-coded)

  ${cyan}1${reset}) Keep existing
  ${cyan}2${reset}) Replace with AutoCode statusline
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    rl.close();
    const choice = answer.trim() || '1';
    callback(choice === '2');
  });
}

/**
 * Prompt for runtime selection
 */
function promptRuntime(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  console.log(`  ${yellow}Which runtime(s) would you like to install for?${reset}\n\n  ${cyan}1${reset}) Claude Code ${dim}(~/.claude)${reset}
  ${cyan}2${reset}) OpenCode    ${dim}(~/.config/opencode)${reset} - open source, free models
  ${cyan}3${reset}) Gemini      ${dim}(~/.gemini)${reset}
  ${cyan}4${reset}) Codex       ${dim}(~/.codex)${reset}
  ${cyan}5${reset}) All
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    if (choice === '5') {
      callback(['claude', 'opencode', 'gemini', 'codex']);
    } else if (choice === '4') {
      callback(['codex']);
    } else if (choice === '3') {
      callback(['gemini']);
    } else if (choice === '2') {
      callback(['opencode']);
    } else {
      callback(['claude']);
    }
  });
}

/**
 * Prompt for install location
 */
function promptLocation(runtimes) {
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to global install${reset}\n`);
    installAllRuntimes(runtimes, true, false);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let answered = false;

  rl.on('close', () => {
    if (!answered) {
      answered = true;
      console.log(`\n  ${yellow}Installation cancelled${reset}\n`);
      process.exit(0);
    }
  });

  const pathExamples = runtimes.map(r => {
    const globalPath = getGlobalDir(r, explicitConfigDir);
    return globalPath.replace(os.homedir(), '~');
  }).join(', ');

  const localExamples = runtimes.map(r => `./${getDirName(r)}`).join(', ');

  console.log(`  ${yellow}Where would you like to install?${reset}\n\n  ${cyan}1${reset}) Global ${dim}(${pathExamples})${reset} - available in all projects
  ${cyan}2${reset}) Local  ${dim}(${localExamples})${reset} - this project only
`);

  rl.question(`  Choice ${dim}[1]${reset}: `, (answer) => {
    answered = true;
    rl.close();
    const choice = answer.trim() || '1';
    const isGlobal = choice !== '2';
    installAllRuntimes(runtimes, isGlobal, true);
  });
}

/**
 * Install AutoCode for all selected runtimes
 */
function installAllRuntimes(runtimes, isGlobal, isInteractive) {
  const results = [];

  for (const runtime of runtimes) {
    const result = install(isGlobal, runtime);
    results.push(result);
  }

  // Handle statusline for Claude & Gemini (OpenCode uses themes)
  const claudeResult = results.find(r => r.runtime === 'claude');
  const geminiResult = results.find(r => r.runtime === 'gemini');
  const codexResult = results.find(r => r.runtime === 'codex');

  // Logic: if both are present, ask once if interactive? Or ask for each?
  // Simpler: Ask once and apply to both if applicable.
  
  if (claudeResult || geminiResult) {
    // Use whichever settings exist to check for existing statusline
    const primaryResult = claudeResult || geminiResult;
    
    handleStatusline(primaryResult.settings, isInteractive, (shouldInstallStatusline) => {
      if (claudeResult) {
        finishInstall(claudeResult.settingsPath, claudeResult.settings, claudeResult.statuslineCommand, shouldInstallStatusline, 'claude');
      }
      if (geminiResult) {
         finishInstall(geminiResult.settingsPath, geminiResult.settings, geminiResult.statuslineCommand, shouldInstallStatusline, 'gemini');
      }
      
      const opencodeResult = results.find(r => r.runtime === 'opencode');
      if (opencodeResult) {
        finishInstall(opencodeResult.settingsPath, opencodeResult.settings, opencodeResult.statuslineCommand, false, 'opencode');
      }

      if (codexResult) {
        finishCodexInstall(codexResult.codexSkillDir);
      }
    });
  } else {
    // No Claude/Gemini: OpenCode and/or Codex
    const opencodeResult = results.find(r => r.runtime === 'opencode');
    if (opencodeResult) {
      finishInstall(opencodeResult.settingsPath, opencodeResult.settings, opencodeResult.statuslineCommand, false, 'opencode');
    }
    if (codexResult) {
      finishCodexInstall(codexResult.codexSkillDir);
    }
  }
}

// Main logic
if (hasGlobal && hasLocal) {
  console.error(`  ${yellow}Cannot specify both --global and --local${reset}`);
  process.exit(1);
} else if (explicitConfigDir && hasLocal) {
  console.error(`  ${yellow}Cannot use --config-dir with --local${reset}`);
  process.exit(1);
} else if (hasUninstall) {
  if (!hasGlobal && !hasLocal) {
    console.error(`  ${yellow}--uninstall requires --global or --local${reset}`);
    process.exit(1);
  }
  const runtimes = selectedRuntimes.length > 0 ? selectedRuntimes : ['claude'];
  for (const runtime of runtimes) {
    uninstall(hasGlobal, runtime);
  }
} else if (selectedRuntimes.length > 0) {
  if (!hasGlobal && !hasLocal) {
    promptLocation(selectedRuntimes);
  } else {
    installAllRuntimes(selectedRuntimes, hasGlobal, false);
  }
} else if (hasGlobal || hasLocal) {
  // Default to Claude if no runtime specified but location is
  installAllRuntimes(['claude'], hasGlobal, false);
} else {
  // Interactive
  if (!process.stdin.isTTY) {
    console.log(`  ${yellow}Non-interactive terminal detected, defaulting to Claude Code global install${reset}\n`);
    installAllRuntimes(['claude'], true, false);
  } else {
    promptRuntime((runtimes) => {
      promptLocation(runtimes);
    });
  }
}
