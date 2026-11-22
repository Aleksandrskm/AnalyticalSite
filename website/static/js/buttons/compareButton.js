'use strict';
import { switchToCompareMode } from '../ui/compareView.js';
import { updateCompareButtonCounter } from '../ui/compareCounter.js';

export function handleCompareButton() {
    updateCompareButtonCounter();
    switchToCompareMode();
}