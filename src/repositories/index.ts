/**
 * Repository layer: the ONLY place Drizzle queries live. Domain/business logic and
 * the CLI call these functions; they never write ad-hoc queries themselves.
 */
export * as usersRepo from './users.js';
export * as automationRepo from './automationSettings.js';
export * as jobsRepo from './jobs.js';
export * as jobSourcesRepo from './jobSources.js';
export * as matchesRepo from './jobMatches.js';
export * as applicationsRepo from './applications.js';
export * as eventsRepo from './applicationEvents.js';
export * as reviewsRepo from './reviewItems.js';
export * as prepRepo from './applicationPrep.js';
