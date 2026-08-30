export const repositoryRoot = new URL('../../', import.meta.url)
export const workflowPluginRoot = new URL('../../plugins/workflow/', import.meta.url)
export const workflowSkillRoot = (name) => new URL(`skills/${name}/`, workflowPluginRoot)
