/**
 * Shared type definitions for Dashboard run data
 * Consolidates types previously duplicated across App.tsx, ComparisonView.tsx, ReportRenderer.tsx
 */

import type { Signal, ChartData } from '../store'

export interface RunData {
    run_id: string
    signals: Signal[]
    charts: Record<string, ChartData>
    graph: { nodes: any[]; edges: any[] }
    report_path?: string
    report_content?: string
    report_structured?: ReportStructured
}

export interface ReportStructured {
    title?: string
    summary_bullets?: string[]
    sections?: Array<{ title: string; content: string }>
    clusters?: Array<{
        title: string
        rationale?: string
        signal_ids?: number[]
        signals?: Signal[]
    }>
    signals?: Signal[]
}

/**
 * Signal delta for comparison view
 */
export interface SignalDelta {
    signal: Signal
    oldSignal?: Signal
    sentiment_delta?: number
    confidence_delta?: number
    intensity_delta?: number
    status: 'new' | 'removed' | 'changed' | 'unchanged'
}
