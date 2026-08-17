import Schema from '@deepseek-ai/schemastery';
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-superpowers";
export interface BootstrapSectionConfig {
    enabled: boolean;
    order: number;
}
export interface CommandsConfig {
    enabled: boolean;
    perSkill: boolean;
}
export interface Config {
    enabled: boolean;
    providerName: string;
    skillsDir?: string;
    bootstrapSection: BootstrapSectionConfig;
    commands: CommandsConfig;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    providerName: Schema<string, string>;
    skillsDir: Schema<string, string>;
    bootstrapSection: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        order: Schema<number, number>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        order: Schema<number, number>;
    }>>;
    commands: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        perSkill: Schema<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        perSkill: Schema<boolean, boolean>;
    }>>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    providerName: Schema<string, string>;
    skillsDir: Schema<string, string>;
    bootstrapSection: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        order: Schema<number, number>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        order: Schema<number, number>;
    }>>;
    commands: Schema<Schemastery.ObjectS<{
        enabled: Schema<boolean, boolean>;
        perSkill: Schema<boolean, boolean>;
    }>, Schemastery.ObjectT<{
        enabled: Schema<boolean, boolean>;
        perSkill: Schema<boolean, boolean>;
    }>>;
}>>;
export declare function apply(ctx: Context, config?: Partial<Config>): void;
export { parseFrontmatter, discoverSkills, createSkillsProvider, BUNDLED_SKILL_RANK, } from './skills-provider.js';
export type { DiscoveredSkill, SkillCandidate, SkillDefinition, SkillsProvider, } from './skills-provider.js';
export { buildBootstrap, getBootstrap, guardBraceTemplates, stripFrontmatter, } from './bootstrap.js';
