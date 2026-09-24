import { DEMO_CASES, HHG_002_DATA } from './demoData';

const USE_MOCK = true;

export const apiService = {
  getCases: async () => {
    if (USE_MOCK) return Promise.resolve(DEMO_CASES);
    throw new Error('Backend not connected yet');
  },
  getCaseDetails: async (caseId: string) => {
    if (USE_MOCK) return Promise.resolve(caseId === 'HHG-002' ? HHG_002_DATA : null);
    throw new Error('Backend not connected yet');
  },
};