import { createAction, props } from '@ngrx/store';
import { features } from '../features';
import { UserPreferences } from '../../types/user';

export const setUserPreferences = createAction(
	`[${features.APP}] Set User Preferences`,
	props<{ preferences: UserPreferences }>(),
);

export const patchUserPreferences = createAction(
	`[${features.APP}] Patch User Preferences`,
	props<{ patch: Partial<UserPreferences> }>(),
);

export const clearUserPreferences = createAction(`[${features.APP}] Clear User Preferences`);
