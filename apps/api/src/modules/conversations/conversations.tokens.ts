/**
 * DI tokens for the conversations slice. Configuration values are injected as
 * values (not a global config service) so adapters and use cases stay easy to
 * instantiate in unit tests.
 */
export const OPENAI_API_KEY = Symbol("OPENAI_API_KEY");
export const EXPERT_PROMPT_MAX_LENGTH = Symbol("EXPERT_PROMPT_MAX_LENGTH");
