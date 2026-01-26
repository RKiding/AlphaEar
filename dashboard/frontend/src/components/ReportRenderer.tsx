import { useMemo, useState } from 'react'
import type { RunData } from '../types/RunData'
import { SignalCard } from './SignalCard'
import { KLineChart } from './KLineChart'
import { BarChart3, Target, TrendingUp, GitMerge, ChevronDown, ChevronRight, List, Info, Sparkles, FileText } from 'lucide-react'
import './ReportRenderer.css'

interface Props {
    data: RunData
    query?: string
}

export function ReportRenderer({ data, query }: Props) {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(['signals', 'charts'])
    )

    const chartList = Object.values(data.charts || {})
    const structured = data.report_structured
    const reportSignals = structured?.signals || []
    const topSignals = useMemo(() => {
        const list = [...reportSignals]
        return list
            .sort((a, b) => (b?.confidence || 0) - (a?.confidence || 0))
            .slice(0, 3)
    }, [reportSignals])

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections)
        if (newSet.has(section)) {
            newSet.delete(section)
        } else {
            newSet.add(section)
        }
        setExpandedSections(newSet)
    }

    const cleanedSectionText = (content: string) => {
        return content
            .split('\n')
            .filter((line) => {
                const trimmed = line.trim()
                if (!trimmed) return false
                if (trimmed === '[TOC]') return false
                if (trimmed.startsWith('|')) return false
                if (/^[-]{3,}$/.test(trimmed)) return false
                return true
            })
            .slice(0, 6)
            .join('\n')
    }

    const transmissionChains = useMemo(() => {
        const source = reportSignals.length ? reportSignals : data.signals || []
        return source
            .map((s: any) => s?.transmission_chain || [])
            .filter((chain: any[]) => Array.isArray(chain) && chain.length > 0)
            .slice(0, 3)
    }, [reportSignals, data.signals])

    return (
        <div className="report-renderer report-layout">
            <aside className="report-sidebar">
                <div className="sidebar-title"><List size={14} /> 目录</div>
                <nav className="report-toc">
                    <a href="#overview">概览</a>
                    <a href="#signals">核心信号</a>
                    <a href="#charts">行情图表</a>
                    {transmissionChains.length > 0 && <a href="#graph">传导链条</a>}
                </nav>
            </aside>

            <div className="report-main">
                <div className="report-title">
                    <h1><BarChart3 size={20} style={{ marginRight: 10 }} />{structured?.title || '分析报告'}</h1>
                    <div className="report-meta">
                        <span className="run-id">Run: {data.run_id}</span>
                        {query && <span className="query">查询: {query}</span>}
                    </div>
                </div>

                <section id="overview" className="report-section">
                    <div className="section-header">
                        <h2><Info size={16} style={{ marginRight: 8 }} />概览</h2>
                    </div>
                    <div className="section-content">
                        <div className="summary-grid">
                            <div className="summary-card">
                                <div className="summary-label">识别信号</div>
                                <div className="summary-value">{reportSignals.length || data.signals.length}</div>
                            </div>
                            <div className="summary-card">
                                <div className="summary-label">图表数量</div>
                                <div className="summary-value">{chartList.length}</div>
                            </div>
                            <div className="summary-card">
                                <div className="summary-label">传导节点</div>
                                <div className="summary-value">{data.graph?.nodes?.length || transmissionChains.length || 0}</div>
                            </div>
                        </div>

                        <div className="highlight-card">
                            <div className="highlight-title">高置信信号</div>
                            {topSignals.length === 0 ? (
                                <div className="empty-state">暂无信号</div>
                            ) : (
                                <div className="highlight-list">
                                    {topSignals.map((signal: any, i: number) => (
                                        <div key={signal?.signal_id || i} className="highlight-item">
                                            <span className="highlight-rank">#{i + 1}</span>
                                            <span className="highlight-title-text">{signal?.title}</span>
                                            <span className="highlight-score">C {signal?.confidence?.toFixed(2) || '-'} / I {signal?.intensity}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {structured?.summary_bullets?.length ? (
                    <section id="insights" className="report-section">
                        <div className="section-header">
                            <h2><Sparkles size={16} style={{ marginRight: 8 }} />报告精要</h2>
                        </div>
                        <div className="section-content">
                            <ul className="insight-list">
                                {structured.summary_bullets.slice(0, 8).map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </section>
                ) : null}

                {structured?.sections?.length ? (
                    <section id="sections" className="report-section">
                        <div className="section-header">
                            <h2><FileText size={16} style={{ marginRight: 8 }} />研报章节</h2>
                        </div>
                        <div className="section-content">
                            <div className="section-grid">
                                {structured.sections.slice(0, 6).map((sec, idx) => (
                                    <div key={idx} className="section-card">
                                        <div className="section-card-title">{sec.title}</div>
                                        <div className="section-card-body">
                                            {cleanedSectionText(sec.content)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                ) : null}

                {structured?.clusters?.length ? (
                    <section id="clusters" className="report-section">
                        <div className="section-header">
                            <h2><Target size={16} style={{ marginRight: 8 }} />主题聚类</h2>
                        </div>
                        <div className="section-content">
                            <div className="cluster-grid">
                                {structured.clusters.map((cluster, idx) => (
                                    <div key={idx} className="cluster-card">
                                        <div className="cluster-title">{cluster.title || `主题 ${idx + 1}`}</div>
                                        {cluster.rationale && <div className="cluster-rationale">{cluster.rationale}</div>}
                                        <div className="cluster-signals">
                                            {(cluster.signals || []).slice(0, 4).map((s: any, i: number) => (
                                                <div key={i} className="cluster-signal">• {s?.title}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                ) : null}

                {structured?.clusters?.length ? (
                    <section id="signals" className="report-section">
                        <div className="section-header">
                            <h2><Target size={16} style={{ marginRight: 8 }} />核心信号</h2>
                            <span className="section-count">{structured.clusters.length} 个主题</span>
                        </div>
                        <div className="section-content">
                            <div className="cluster-grid">
                                {structured.clusters.map((cluster, idx) => (
                                    <div key={idx} className="cluster-card">
                                        <div className="cluster-title">{cluster.title || `主题 ${idx + 1}`}</div>
                                        {cluster.rationale && <div className="cluster-rationale">{cluster.rationale}</div>}
                                        <div className="cluster-signals">
                                            {(cluster.signals || []).slice(0, 6).map((s: any, i: number) => (
                                                <div key={i} className="cluster-signal">• {s?.title}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                ) : (
                    <section id="signals" className="report-section">
                        <div className="section-header">
                            <h2><Target size={16} style={{ marginRight: 8 }} />核心信号</h2>
                            <span className="section-count">{reportSignals.length || data.signals.length} 个</span>
                        </div>
                        <div className="section-content">
                            <div className="signals-grid">
                                {(reportSignals.length ? reportSignals : data.signals).slice(0, 6).map((signal: any, i: number) => (
                                    <SignalCard key={signal.signal_id || i} signal={signal} />
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                <section id="charts" className="report-section">
                    <div
                        className="section-header"
                        onClick={() => toggleSection('charts')}
                    >
                        <h2><TrendingUp size={16} style={{ marginRight: 8 }} />行情图表</h2>
                        <span className="section-count">{chartList.length} 个</span>
                        <span className="toggle-icon">
                            {expandedSections.has('charts') ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    </div>
                    {expandedSections.has('charts') && (
                        <div className="section-content">
                            {chartList.length === 0 ? (
                                <div className="empty-state">暂无图表数据</div>
                            ) : (
                                <div className="charts-grid">
                                    {chartList.filter(chart => chart && chart.prices && chart.prices.length > 0).map((chart) => (
                                        <div key={chart.ticker} className="chart-card">
                                            <KLineChart data={chart} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {transmissionChains.length > 0 && (
                    <section id="graph" className="report-section">
                        <div className="section-header">
                            <h2><GitMerge size={16} style={{ marginRight: 8 }} />传导链条</h2>
                        </div>
                        <div className="section-content">
                            <div className="graph-preview">
                                {transmissionChains.map((chain: any[], idx: number) => (
                                    <div key={idx} className="chain-flow">
                                        {chain.map((node: any, i: number) => (
                                            <span key={`${idx}-${i}`} className="chain-node">
                                                {i > 0 && <span className="chain-arrow">→</span>}
                                                <span className={`node-badge ${node?.impact_type || 'factor'}`}>
                                                    {node?.node_name || node?.label || node?.name}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </div>
    )
}
