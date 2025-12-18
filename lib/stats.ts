const STORAGE_KEY = 'base-tx-guard-stats';

interface Stats {
    prevented: number;
    successful: number;
}

const DEFAULT_STATS: Stats = {
    prevented: 0,
    successful: 0,
};

export function getStats(): Stats {
    if (typeof window === 'undefined') return DEFAULT_STATS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATS;
        return JSON.parse(raw);
    } catch {
        return DEFAULT_STATS;
    }
}

export function saveStats(stats: Stats) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

export function incrementPrevented() {
    const stats = getStats();
    stats.prevented += 1;
    saveStats(stats);
    return stats;
}

export function incrementSuccessful() {
    const stats = getStats();
    stats.successful += 1;
    saveStats(stats);
    return stats;
}
