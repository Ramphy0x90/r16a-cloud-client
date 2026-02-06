import { createAction, props } from '@ngrx/store';
import { features } from '../features';
import { ChangeThemeProp } from './types';

export const changeTheme = createAction(`[${features.APP}] Change Theme`, props<ChangeThemeProp>());
