
import db from './db.js';

export function getOverallStats(range: 'week' | 'month' = 'week') {
    // Determine start date based on range
    const now = new Date();
    let startDate = new Date();
    if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
    } else {
        startDate.setDate(now.getDate() - 30);
    }
    const startDateStr = startDate.toISOString();

    // 1. Total Events count in range
    const totalEvents = db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE timestamp >= ?
    `).get(startDateStr) as { count: number };

    // 2. Events breakdown by type
    const byType = db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM events 
        WHERE timestamp >= ? 
        GROUP BY type
        ORDER BY count DESC
    `).all(startDateStr) as { type: string, count: number }[];

    // 3. Current Streak (consecutive days with at least one event)
    // We need to query distinct dates in descending order
    const activityDates = db.prepare(`
        SELECT DISTINCT date(timestamp) as day 
        FROM events 
        ORDER BY day DESC 
        LIMIT 365
    `).all() as { day: string }[];

    let streak = 0;
    let checkDate = new Date();
    // Normalize checkDate to midnight YYYY-MM-DD
    checkDate.setHours(0, 0, 0, 0);

    // If latest activity was today or yesterday, streak is alive.
    // If not, streak is 0.

    // Helper to format date as YYYY-MM-DD
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    // Check if we have activity today
    const todayStr = fmt(checkDate);
    const hasActivityToday = activityDates.some(d => d.day === todayStr);

    if (hasActivityToday) {
        streak = 1;
        // Check backwards
        for (let i = 1; i < activityDates.length; i++) {
            const prevDate = new Date(checkDate);
            prevDate.setDate(prevDate.getDate() - i);
            const prevDateStr = fmt(prevDate);

            if (activityDates.some(d => d.day === prevDateStr)) {
                streak++;
            } else {
                break;
            }
        }
    } else {
        // checks if we had activity yesterday
        const yesterday = new Date(checkDate);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = fmt(yesterday);

        if (activityDates.some(d => d.day === yesterdayStr)) {
            streak = 1;
            // Check backwards from yesterday
            for (let i = 1; i < activityDates.length; i++) {
                const prevDate = new Date(yesterday);
                prevDate.setDate(prevDate.getDate() - i);
                const prevDateStr = fmt(prevDate);

                if (activityDates.some(d => d.day === prevDateStr)) {
                    streak++;
                } else {
                    break;
                }
            }
        }
    }

    // 4. Most active project
    const topProject = db.prepare(`
        SELECT p.name, COUNT(*) as count 
        FROM events e
        JOIN projects p ON e.project_id = p.id
        WHERE e.timestamp >= ?
        GROUP BY p.name
        ORDER BY count DESC
        LIMIT 1
    `).get(startDateStr) as { name: string, count: number } | undefined;

    return {
        totalEvents: totalEvents.count,
        byType,
        streak,
        topProject: topProject || null
    };
}

export function getActivityHeatmap() {
    // Get count per day for the last 365 days
    const result = db.prepare(`
        SELECT date(timestamp) as date, COUNT(*) as count,
        (SELECT type FROM events e2 WHERE date(e2.timestamp) = date(events.timestamp) GROUP BY type ORDER BY COUNT(*) DESC LIMIT 1) as topType
        FROM events
        WHERE timestamp >= date('now', '-365 days')
        GROUP BY date(timestamp)
        ORDER BY date ASC
    `).all();

    return result;
}

export function getTypeDistribution(range: 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate = new Date();
    if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
        startDate.setDate(now.getDate() - 30);
    } else {
        startDate.setDate(now.getDate() - 365);
    }
    const startDateStr = startDate.toISOString();

    const distribution = db.prepare(`
        SELECT type, COUNT(*) as count 
        FROM events 
        WHERE timestamp >= ? 
        GROUP BY type
    `).all(startDateStr);

    return distribution;
}
