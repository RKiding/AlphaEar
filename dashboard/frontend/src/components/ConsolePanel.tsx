import { useDashboardStore } from '../store'
import { useEffect, useRef } from 'react'
import { Terminal, CheckCircle, XCircle, Bot, ChevronLeft, ChevronRight } from 'lucide-react'
import './ConsolePanel.css'

export function ConsolePanel() {
    const { steps, phase, progress, status, consoleCollapsed, setConsoleCollapsed } = useDashboardStore()
    const consoleRef = useRef<HTMLDivElement>(null)

    // 自动滚动到底部
    useEffect(() => {
        if (consoleRef.current && !consoleCollapsed) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight
        }
    }, [steps, consoleCollapsed])

    const getStepClass = (stepType: string) => {
        switch (stepType) {
            case 'error': return 'step-error'
            case 'warning': return 'step-warning'
            case 'result': return 'step-result'
            case 'signal': return 'step-signal'
            case 'tool_call': return 'step-tool'
            case 'thought': return 'step-thought'
            case 'phase': return 'step-phase'
            default: return 'step-default'
        }
    }

    const getAgentColor = (agent: string) => {
        switch (agent) {
            case 'TrendAgent': return '#4fc3f7'
            case 'FinAgent': return '#81c784'
            case 'ForecastAgent': return '#ba68c8'
            case 'ReportAgent': return '#ffb74d'
            case 'IntentAgent': return '#f06292'
            default: return '#90a4ae'
        }
    }

    // Collapsed state - vertical sidebar
    if (consoleCollapsed) {
        return (
            <div className="console-panel collapsed" onClick={() => setConsoleCollapsed(false)}>
                <div className="collapsed-sidebar">
                    <ChevronRight size={16} className="expand-icon" />
                    <Terminal size={14} />
                    <span className="vertical-title">Agent Console</span>
                    <span className={`status-dot ${status}`} />
                </div>
            </div>
        )
    }

    return (
        <div className="console-panel">
            <div className="console-header" onClick={() => setConsoleCollapsed(true)}>
                <span className="console-title"><Terminal size={14} />Agent Console</span>
                <div className="header-right">
                    <span className="console-status" data-status={status}>
                        {status === 'running' ? phase : status === 'completed' ? <><CheckCircle size={12} /> 完成</> : status === 'failed' ? <><XCircle size={12} /> 失败</> : '等待开始'}
                    </span>
                    <span className="collapse-toggle">
                        <ChevronLeft size={14} />
                    </span>
                </div>
            </div>

            <div className="progress-bar">
                <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                />
            </div>

            <div className="console-content" ref={consoleRef}>
                {steps.length === 0 ? (
                    <div className="console-empty">
                        <div className="empty-icon"><Bot size={40} /></div>
                        <div>输入查询并点击开始分析</div>
                    </div>
                ) : (
                    steps.map((step, i) => (
                        <div key={i} className={`console-step ${getStepClass(step.step_type)}`}>
                            <span className="step-time">
                                {new Date(step.timestamp).toLocaleTimeString()}
                            </span>
                            <span
                                className="step-agent"
                                style={{ color: getAgentColor(step.agent) }}
                            >
                                {step.agent}
                            </span>
                            <span className="step-content">{step.content}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
