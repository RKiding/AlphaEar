import { useEffect, useState } from 'react'
import { Flame, RefreshCw, Lightbulb, X, Loader2 } from 'lucide-react'
import './HotNewsPanel.css'

interface HotNewsItem {
    id: string
    source: string
    rank: number
    title: string
    url: string
    publish_time?: string
}

interface HotNewsSourceGroup {
    source: string
    source_name: string
    items: HotNewsItem[]
}

interface HotNewsResponse {
    updated_at: string
    sources: HotNewsSourceGroup[]
}

interface Props {
    onPickQuery: (query: string) => void
}

const SOURCE_OPTIONS = [
    { id: 'all', name: '全部' },
    { id: 'cls', name: '财联社' },
    { id: 'wallstreetcn', name: '华尔街见闻' },
    { id: 'xueqiu', name: '雪球' },
    { id: 'eastmoney', name: '东方财富' },
    { id: 'yicai', name: '第一财经' }
]

const API_BASE = import.meta.env.DEV ? 'http://localhost:8765' : ''

export function HotNewsPanel({ onPickQuery }: Props) {
    const [activeSource, setActiveSource] = useState('all')
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<HotNewsResponse | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Suggestion modal state
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestingFor, setSuggestingFor] = useState<string>('')
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [suggestLoading, setSuggestLoading] = useState(false)

    const fetchHotNews = async (sourceId: string = activeSource) => {
        try {
            setLoading(true)
            setError(null)
            const sourcesParam = sourceId === 'all'
                ? SOURCE_OPTIONS.filter(s => s.id !== 'all').map(s => s.id).join(',')
                : sourceId
            const res = await fetch(`${API_BASE}/api/hot-news?sources=${encodeURIComponent(sourcesParam)}&count=8`)
            if (!res.ok) {
                throw new Error('热点获取失败')
            }
            const json = await res.json()
            setData(json)
        } catch (e) {
            setError((e as Error).message || '热点获取失败')
        } finally {
            setLoading(false)
        }
    }

    const fetchSuggestions = async (newsTitle: string) => {
        setSuggestingFor(newsTitle)
        setShowSuggestions(true)
        setSuggestLoading(true)
        setSuggestions([])

        try {
            const res = await fetch(`${API_BASE}/api/suggest-queries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newsTitle })
            })
            if (res.ok) {
                const json = await res.json()
                setSuggestions(json.suggestions || [])
            } else {
                // Fallback
                setSuggestions([
                    `${newsTitle} 对A股的影响`,
                    `${newsTitle} 相关概念股`,
                    newsTitle
                ])
            }
        } catch {
            setSuggestions([newsTitle])
        } finally {
            setSuggestLoading(false)
        }
    }

    const handleSelectQuery = (query: string) => {
        onPickQuery(query)
        setShowSuggestions(false)
    }

    useEffect(() => {
        fetchHotNews('all')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleSourceClick = (sourceId: string) => {
        setActiveSource(sourceId)
        fetchHotNews(sourceId)
    }

    return (
        <div className="hot-news-panel">
            <div className="hot-news-header">
                <div className="hot-news-title">
                    <Flame size={14} /> 热点新闻
                </div>
                <button
                    className="hot-news-refresh"
                    onClick={() => fetchHotNews(activeSource)}
                    disabled={loading}
                    title="刷新"
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
            </div>

            <div className="hot-news-sources">
                {SOURCE_OPTIONS.map((s) => (
                    <button
                        key={s.id}
                        className={`source-chip ${activeSource === s.id ? 'active' : ''}`}
                        onClick={() => handleSourceClick(s.id)}
                    >
                        {s.name}
                    </button>
                ))}
            </div>

            <div className="hot-news-body">
                {loading ? (
                    <div className="hot-news-empty">加载中...</div>
                ) : error ? (
                    <div className="hot-news-empty">{error}</div>
                ) : !data || data.sources.length === 0 ? (
                    <div className="hot-news-empty">暂无热点</div>
                ) : (
                    data.sources.map((group) => (
                        <div key={group.source} className="hot-news-group">
                            <div className="group-title">{group.source_name}</div>
                            <div className="hot-news-list">
                                {group.items.map((item) => (
                                    <div key={item.id} className="hot-news-item">
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="item-title"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {item.rank}. {item.title}
                                        </a>
                                        <button
                                            className="item-pick insight-btn"
                                            onClick={() => fetchSuggestions(item.title)}
                                            title="生成洞察查询"
                                        >
                                            <Lightbulb size={12} /> 洞察
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Query Suggestions Modal */}
            {showSuggestions && (
                <div className="suggestions-modal-overlay" onClick={() => setShowSuggestions(false)}>
                    <div className="suggestions-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Lightbulb size={16} /> 选择分析角度</h3>
                            <button className="close-btn" onClick={() => setShowSuggestions(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="modal-news-title">{suggestingFor}</div>
                        <div className="suggestions-list">
                            {suggestLoading ? (
                                <div className="suggestions-loading">
                                    <Loader2 size={24} className="spin" />
                                    <span>AI 正在生成洞察角度...</span>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="suggestions-empty">暂无建议</div>
                            ) : (
                                suggestions.map((query, idx) => (
                                    <button
                                        key={idx}
                                        className="suggestion-item"
                                        onClick={() => handleSelectQuery(query)}
                                    >
                                        <span className="suggestion-num">{idx + 1}</span>
                                        <span className="suggestion-text">{query}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
