import { fileURLToPath } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import { createSkillsProvider, discoverSkills, } from './skills-provider.js';
import { getBootstrap } from './bootstrap.js';
export const name = 'dsh-superpowers';
export const Config = Schema.object({
    enabled: Schema.boolean().default(true),
    providerName: Schema.string().default('superpowers'),
    skillsDir: Schema.string(),
    bootstrapSection: Schema.object({
        enabled: Schema.boolean().default(true),
        order: Schema.number().default(45),
    }),
    commands: Schema.object({
        enabled: Schema.boolean().default(true),
        perSkill: Schema.boolean().default(true),
    }),
});
/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */
export function apply(ctx, config = {}) {
    // Defensive guard: never crash the Cordis loader on a malformed or partial
    // context. Every cross-plugin service here is optional and resolved via
    // ctx.get() (skills / systemPrompt / commands).
    if (!ctx || typeof ctx.get !== 'function') {
        console.warn('[dsh-superpowers] invalid ctx (missing ctx.get); plugin not applied');
        return;
    }
    const cfg = {
        enabled: config.enabled ?? true,
        providerName: (config.providerName ?? 'superpowers').trim() || 'superpowers',
        skillsDir: config.skillsDir?.trim() || undefined,
        bootstrapSection: {
            enabled: config.bootstrapSection?.enabled ?? true,
            order: config.bootstrapSection?.order ?? 45,
        },
        commands: {
            enabled: config.commands?.enabled ?? true,
            perSkill: config.commands?.perSkill ?? true,
        },
    };
    if (!cfg.enabled) {
        console.log('[dsh-superpowers] disabled via config; nothing registered');
        return;
    }
    const skillsDir = cfg.skillsDir ?? defaultSkillsDir();
    const skillsMount = registerSkillsProvider(ctx, cfg.providerName, skillsDir);
    const promptMount = registerBootstrapSection(ctx, cfg.bootstrapSection, skillsDir);
    const commandsMount = registerSuperpowersCommands(ctx, skillsDir, cfg.commands);
    logStartup(cfg, skillsDir, { skills: skillsMount, prompt: promptMount, commands: commandsMount });
}
/**
 * Resolve the bundled `skills/` directory relative to the module location.
 * From the compiled artifact (lib/index.js) this resolves to ../skills —
 * the package's bundled skills directory.
 */
function defaultSkillsDir() {
    return fileURLToPath(new URL('../skills', import.meta.url));
}
function registerSkillsProvider(ctx, providerName, skillsDir) {
    // Preferred path (Cordis 4): wait for the skills service to be available,
    // then register the embedded provider (same pattern as dsh-plan-mode).
    if (typeof ctx.inject === 'function') {
        try {
            ctx.inject(['skills'], ((serviceCtx) => {
                const skills = serviceCtx.skills;
                if (!skills || typeof skills.registerProvider !== 'function') {
                    console.warn('[dsh-superpowers] ctx.skills unavailable in inject; skills not registered');
                    return;
                }
                try {
                    skills.registerProvider(() => createSkillsProvider({ rootDir: skillsDir, providerName }));
                }
                catch (err) {
                    console.error('[dsh-superpowers] failed to register skills provider:', err);
                }
            }));
            return 'injected';
        }
        catch (err) {
            console.error('[dsh-superpowers] failed to mount skills provider via ctx.inject:', err);
            return 'failed';
        }
    }
    // Fallback for hosts without ctx.inject: one-shot best-effort resolution.
    try {
        const skills = ctx.get('skills');
        if (!skills || typeof skills.registerProvider !== 'function') {
            console.warn('[dsh-superpowers] ctx.skills unavailable; skills not registered');
            return 'no-service';
        }
        skills.registerProvider(() => createSkillsProvider({ rootDir: skillsDir, providerName }));
        return 'get';
    }
    catch (err) {
        console.error('[dsh-superpowers] failed to register skills provider:', err);
        return 'failed';
    }
}
function registerBootstrapSection(ctx, sectionConfig, skillsDir) {
    if (!sectionConfig.enabled)
        return 'disabled';
    // Preferred path: wait for the systemPrompt service, then add the section.
    if (typeof ctx.inject === 'function') {
        try {
            ctx.inject(['systemPrompt'], ((serviceCtx) => {
                const systemPrompt = serviceCtx.systemPrompt;
                if (!systemPrompt || typeof systemPrompt.section !== 'function') {
                    console.warn('[dsh-superpowers] ctx.systemPrompt unavailable in inject; bootstrap section not injected');
                    return;
                }
                const text = getBootstrap(skillsDir);
                if (!text) {
                    console.warn('[dsh-superpowers] bootstrap not injected: missing using-superpowers SKILL.md or references/dsh-tools.md under ' + skillsDir);
                    return;
                }
                try {
                    systemPrompt.section({ name: 'superpowers:bootstrap', order: sectionConfig.order, text });
                }
                catch (err) {
                    console.error('[dsh-superpowers] failed to register bootstrap section:', err);
                }
            }));
            return 'injected';
        }
        catch (err) {
            console.error('[dsh-superpowers] failed to mount bootstrap section via ctx.inject:', err);
            return 'failed';
        }
    }
    // Fallback for hosts without ctx.inject.
    try {
        const systemPrompt = ctx.get('systemPrompt');
        if (!systemPrompt || typeof systemPrompt.section !== 'function') {
            console.warn('[dsh-superpowers] ctx.systemPrompt unavailable; bootstrap section not injected');
            return 'no-service';
        }
        const text = getBootstrap(skillsDir);
        if (!text) {
            console.warn('[dsh-superpowers] bootstrap not injected: missing using-superpowers SKILL.md or references/dsh-tools.md under ' + skillsDir);
            return 'no-text';
        }
        systemPrompt.section({ name: 'superpowers:bootstrap', order: sectionConfig.order, text });
        return 'get';
    }
    catch (err) {
        console.error('[dsh-superpowers] failed to register bootstrap section:', err);
        return 'failed';
    }
}
/**
 * Read-only startup banner for console diagnostics: reports the resolved
 * skills directory, discoverable skill count, config toggles, bootstrap
 * availability, and how each optional service was mounted ('injected' =
 * via ctx.inject, 'get' = one-shot fallback, 'no-service'/'failed'/... =
 * the mount did not land). Does not call the services themselves.
 */
function logStartup(cfg, skillsDir, mounts) {
    let skillCount = 0;
    try {
        skillCount = discoverSkills(skillsDir).length;
    }
    catch (err) {
        // Directory unreadable — the banner still reports 0 plus mount statuses.
    }
    let bootstrap = false;
    try {
        bootstrap = getBootstrap(skillsDir) !== undefined;
    }
    catch (err) {
        // ignore
    }
    console.log('[dsh-superpowers] loaded -> skillsDir=' +
        skillsDir +
        ' skills=' +
        skillCount +
        ' commands=' +
        cfg.commands.enabled +
        '/' +
        cfg.commands.perSkill +
        ' bootstrap=' +
        (bootstrap ? 'yes' : 'no') +
        ' provider=' +
        mounts.skills +
        ' systemPrompt=' +
        mounts.prompt +
        ' commandsMount=' +
        mounts.commands);
}
/* ------------------------------------------------------------------ */
/* Slash-command family: /superpowers [skill] + one command per skill  */
/* ------------------------------------------------------------------ */
/**
 * Build a minimal user-role message without importing @deepseek-ai/dsh-llm
 * (the core package lives in the harness install dir, not the profile's
 * node_modules; pulling a second copy risks brand/instance skew). The shape
 * mirrors `createUserMessage`: id + role + user source + one text block.
 */
function makeUserTextMessage(text) {
    return {
        id: 'dsh-superpowers-' +
            Date.now().toString(36) +
            '-' +
            Math.random().toString(36).slice(2, 10),
        role: 'user',
        source: { kind: 'user' },
        content: [{ type: 'text', text }],
    };
}
/**
 * Invoke one bundled skill: steer a user message containing the platform's
 * native explicit-invocation gesture `/skill-name`. dsh-tool-skill detects
 * that token at agent/pre-step and injects the full skill body with the
 * `skill-invocation` source, so selecting /brainstorming behaves exactly
 * like the user typing /brainstorming in the message box.
 */
function invokeSkill(agent, skillName, description, payload = '') {
    const a = agent;
    if (a && typeof a.steer === 'function') {
        try {
            const msgText = payload ? '/' + skillName + ' ' + payload : '/' + skillName;
            a.steer(makeUserTextMessage(msgText));
            return {
                kind: 'success',
                text: payload
                    ? 'Superpowers: 已调用技能 /' + skillName + '，你的诉求将随技能一起注入会话。'
                    : 'Superpowers: 已调用技能 /' + skillName + '，技能内容将随下一步注入会话。',
            };
        }
        catch (err) {
            return { kind: 'error', text: 'Superpowers: 调用技能 /' + skillName + ' 失败：' + String(err) };
        }
    }
    return {
        kind: 'success',
        text: '当前环境无法自动注入技能；请在消息框直接发送 /' +
            skillName +
            (payload ? ' ' + payload : '') +
            ' 载入技能。\n\n' +
            clipDescription(description, 200),
    };
}
function clipDescription(text, max = 140) {
    const t = (text ?? '').trim();
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
function registerSuperpowersCommands(ctx, skillsDir, commandsCfg) {
    if (!commandsCfg.enabled)
        return 'disabled';
    // Registrations are built in one factory shared by the inject path and the
    // legacy ctx.get fallback.
    const registerAll = (serviceCtx) => {
        const commands = serviceCtx.commands;
        if (!commands || typeof commands.register !== 'function') {
            console.warn('[dsh-superpowers] commands service missing register(); command family not mounted');
            return;
        }
        const skills = discoverSkills(skillsDir);
        // Overview command: /superpowers lists the family; /superpowers <skill> invokes one.
        const overviewHandler = async (invocation) => {
            try {
                const q = (invocation.rawInput ?? '').trim().replace(/^-+/, '');
                if (q) {
                    const parts = q.split(/\s+/);
                    const hit = skills.find((s) => s.name === parts[0]);
                    if (!hit) {
                        return {
                            kind: 'error',
                            text: 'Superpowers: 未知技能 ' + parts[0] + '。运行 /superpowers 查看命令家族。',
                        };
                    }
                    return invokeSkill(invocation.agent, hit.name, hit.description, parts.slice(1).join(' '));
                }
                const lines = skills.map((s) => '- /' + s.name + '：' + clipDescription(s.description, 160));
                const boot = getBootstrap(skillsDir);
                const status = boot !== undefined ? 'bootstrap 已注入' : 'bootstrap 未注入';
                return {
                    kind: 'success',
                    text: 'Superpowers 命令家族（' +
                        skills.length +
                        ' 个技能）：\n' +
                        lines.join('\n') +
                        '\n\n' +
                        status +
                        '\n\n用法：\n' +
                        '- 直达：输入 /技能名（例如 /brainstorming），命令会留在输入栏，继续输入你的诉求再回车\n' +
                        '- 经 /superpowers 调用：/superpowers <技能名> <你的诉求>（也支持 -brainstorming 写法）\n' +
                        '- 前缀过滤补全：输入 /superpowers- 后再输入技能名前缀（例如 /superpowers-brainstorming）',
                };
            }
            catch (err) {
                return { kind: 'error', text: String(err) };
            }
        };
        try {
            commands.register({
                name: 'superpowers',
                description: 'Superpowers overview: list skills or invoke one via /superpowers <skill>',
                input: { hint: '[skill]' },
                handler: overviewHandler,
            });
        }
        catch (err) {
            console.warn('[dsh-superpowers] failed to register /superpowers:', err);
        }
        if (!commandsCfg.perSkill)
            return;
        // One command per bundled skill in TWO forms (dual family): the flat
        // direct name (/brainstorming) and the prefix-namespaced form
        // (/superpowers-brainstorming). Typing /superpowers- keeps the palette
        // listing the skill names so the user can keep typing to filter, which
        // approximates a submenu within dsh-commands' flat command grammar.
        // Each registration failure is isolated so a colliding name cannot take
        // down the rest of the family.
        const deploySkillCommand = (name, skill) => {
            try {
                commands.register({
                    name,
                    description: clipDescription(skill.description),
                    // Keep the command in the input after picking (claim flow): the UI
                    // inserts '/<name> ' and defers submission until Enter, so the
                    // human can append their own request, which the handler forwards
                    // into the steered skill-gesture message below.
                    input: { hint: '描述你的任务，回车后随技能一起发送' },
                    handler: async (invocation) => {
                        try {
                            const payload = (invocation.rawInput ?? '').trim();
                            return invokeSkill(invocation.agent, skill.name, skill.description, payload);
                        }
                        catch (err) {
                            return { kind: 'error', text: String(err) };
                        }
                    },
                });
            }
            catch (err) {
                console.warn('[dsh-superpowers] failed to register /' + name + ':', err);
            }
        };
        for (const skill of skills) {
            deploySkillCommand(skill.name, skill);
            deploySkillCommand('superpowers-' + skill.name, skill);
        }
    };
    // Preferred path (Cordis 4): wait for the commands service to become
    // available, then mount the whole family (same pattern as dsh-plan-mode).
    if (typeof ctx.inject === 'function') {
        try {
            ctx.inject(['commands'], registerAll);
            return 'injected';
        }
        catch (err) {
            console.error('[dsh-superpowers] failed to mount command family via ctx.inject:', err);
            return 'failed';
        }
    }
    // Fallback for hosts without ctx.inject: one-shot best-effort resolution.
    try {
        const commands = ctx.get('commands');
        if (commands && typeof commands.register === 'function') {
            registerAll({ commands });
            return 'get';
        }
        return 'no-service';
    }
    catch (err) {
        console.error('[dsh-superpowers] failed to resolve command service:', err);
        return 'failed';
    }
}
/* ------------------------------------------------------------------ */
/* Re-exports: pure helpers importable from the package root           */
/* ------------------------------------------------------------------ */
export { parseFrontmatter, discoverSkills, createSkillsProvider, BUNDLED_SKILL_RANK, } from './skills-provider.js';
export { buildBootstrap, getBootstrap, guardBraceTemplates, stripFrontmatter, } from './bootstrap.js';
