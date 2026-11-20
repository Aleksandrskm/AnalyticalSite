'use strict';

const initial = () => ({
    currentChartFormat: 'full',
    settlementsColumnsCache: null,
    rankingColumnsCache: null,

    ratingPlacesMap: new Map(),
    ratingPlacesTotal: 0,

    settlementsData: { items: [], total: 0, page: 0, pageSize: 100, allItems: [] },
    resData: { items: [], total: 0, page: 0, pageSize: 1 },

    chartAllData: [], chartCurrentData: [], chartDisplayData: [],

    selectedSettlementMode: null,
    selectedSettlementForInfo: null,
    selectedSettlementId: null,
    selectedSettlementLat: null,
    selectedSettlementLon: null,
    selectedSettlementArea: null,
    selectedSettlementName: null,
    selectedSettlementHighlighted: false,

    currentRegions: [], currentKinds: [], currentPopRange: null,

    isCancelled: false,
    isCalculateMode: false,
    allRatings: {},

    currentSortField: null, currentSortOrder: 'asc',
    currentSettlementsFiltered: [],
    currentFilterField: '', currentFilterValue: '', currentFilterExact: false,
    savedFilterField: '', savedFilterValue: '', savedFilterExact: false,
    originalDataForFilter: [], originalTotalForFilter: 0,
    currentDisplayPage: 0,

    showRatings: false,

    ratingChart: null, isChartMode: false, chartType: 'provided',
    analyticsChart: null, analyticsBarServices: null, analyticsBarMobile: null,
    isAnalyticsMode: false,

    chartSearchQuery: '', searchResults: [],
    selectedSearchItem: null, selectedSearchIndex: -1,
    zoomStartIndex: 0, zoomEndIndex: 0, currentDisplayDataLength: 0
});

export const state = initial();

export function resetDataState() {
    Object.assign(state, initial());
}

export function resetFilterState() {
    state.currentFilterField = '';
    state.currentFilterValue = '';
    state.currentFilterExact = false;
    state.savedFilterField = '';
    state.savedFilterValue = '';
    state.savedFilterExact = false;
    state.currentDisplayPage = 0;
}