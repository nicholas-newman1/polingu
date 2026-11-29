import { createContext } from 'react';

/** Whether ReviewDataProvider is still loading the learner's data and the built-in content. */
export const ReviewDataLoadingContext = createContext<boolean | null>(null);
