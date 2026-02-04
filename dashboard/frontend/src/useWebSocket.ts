import { useEffect, useRef, useCallback } from 'react'
import { useDashboardStore } from './store'

const WS_URL = import.meta.env.DEV
    ? 'ws://localhost:8765/ws'
    : `ws://${window.location.host}/ws`

export function useWebSocket() {
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<number | null>(null)

    const {
        setConnected,
        setRunning,
        setCompleted,
        setFailed,
        addStep,
        addSignal,
        updateChart,
        updateGraph,
        updateProgress,
        setHistory,
        setQueryGroups,
        token // Get token from store
    } = useDashboardStore()

    const connect = useCallback(() => {
        // Prevent connection if no token or already connected
        if (!token) return
        if (wsRef.current?.readyState === WebSocket.OPEN) return

        const urlWithToken = `${WS_URL}?token=${token}`
        const ws = new WebSocket(urlWithToken)
        wsRef.current = ws

        ws.onopen = () => {
            console.log('✅ WebSocket connected')
            setConnected(true)

            // 请求初始数据
            ws.send(JSON.stringify({ command: 'get_status' }))  // 同步当前运行状态
            ws.send(JSON.stringify({ command: 'get_history' }))
            ws.send(JSON.stringify({ command: 'get_query_groups' }))
        }

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data)
                handleMessage(msg)
            } catch (e) {
                console.error('Failed to parse message:', e)
            }
        }

        ws.onclose = () => {
            console.log('❌ WebSocket disconnected')
            setConnected(false)

            // 自动重连 (only if token still exists)
            const currentToken = useDashboardStore.getState().token
            if (currentToken) {
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    console.log('🔄 Attempting to reconnect...')
                    connect()
                }, 3000)
            }
        }

        ws.onerror = (error) => {
            console.error('WebSocket error:', error)
        }
    }, [setConnected, token]) // Add token dependency

    const handleMessage = (msg: { type: string; data: any }) => {
        switch (msg.type) {
            case 'init':
                // 同步后端当前状态
                const isActuallyRunning = msg.data.is_running === true

                if (isActuallyRunning && msg.data.run_id) {
                    setRunning(msg.data.run_id)
                    // 恢复进度
                    if (msg.data.phase !== undefined && msg.data.progress !== undefined) {
                        updateProgress(msg.data.phase, msg.data.progress)
                    }
                    // 恢复步骤
                    msg.data.steps?.forEach((step: any) => addStep(step))
                    // 恢复信号
                    msg.data.signals?.forEach((signal: any) => addSignal(signal))
                    // 恢复图表 - with validation
                    Object.entries(msg.data.charts || {}).forEach(([ticker, chartData]) => {
                        const chart = chartData as any
                        // Only update if chart has valid prices array
                        if (chart && chart.prices && Array.isArray(chart.prices) && chart.prices.length > 0) {
                            updateChart(ticker, chart)
                        } else {
                            console.warn(`Skipping invalid chart data for ${ticker}:`, chart)
                        }
                    })
                    // 恢复传导图
                    if (msg.data.graph) updateGraph(msg.data.graph)
                    console.log('📡 Synced running state from backend:', msg.data.run_id)
                } else if (msg.data.status === 'completed' && msg.data.run_id) {
                    // 后端显示已完成
                    setCompleted()
                    console.log('📡 Backend reports completed state')
                } else {
                    // 后端实际未运行，重置到 idle 状态
                    console.log('📡 Backend is idle, resetting frontend state')
                }
                break

            case 'progress':
                updateProgress(msg.data.phase, msg.data.progress)
                break

            case 'step':
                addStep(msg.data)
                break

            case 'signal':
                addSignal(msg.data)
                break

            case 'chart':
                // Validate chart data before updating
                if (msg.data && msg.data.ticker && msg.data.prices && Array.isArray(msg.data.prices) && msg.data.prices.length > 0) {
                    updateChart(msg.data.ticker, msg.data)
                } else {
                    console.warn('Received invalid chart data:', msg.data)
                }
                break

            case 'graph':
                updateGraph(msg.data)
                break

            case 'completed':
                setCompleted()
                // 刷新历史
                wsRef.current?.send(JSON.stringify({ command: 'get_history' }))
                wsRef.current?.send(JSON.stringify({ command: 'get_query_groups' }))
                // 浏览器通知
                if (Notification.permission === 'granted') {
                    new Notification('DeepEar 分析完成', {
                        body: `发现 ${msg.data.signal_count} 个信号`,
                        icon: '/favicon.ico'
                    })
                }
                break

            case 'error':
                setFailed(msg.data.message)
                break

            case 'status':
                // Handle status updates from backend (e.g., cancel, reset)
                if (msg.data.status === 'idle' || msg.data.status === 'cancelled') {
                    setCompleted()  // This resets status to idle
                } else if (msg.data.status === 'cancelling') {
                    // Keep the running state but could show a cancelling indicator
                    console.log('⚠️ Workflow cancelling...')
                }
                break

            case 'history':
                setHistory(msg.data)
                break

            case 'query_groups':
                setQueryGroups(msg.data)
                break
        }
    }

    const sendCommand = useCallback((command: string, data?: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ command, ...data }))
        }
    }, [])

    useEffect(() => {
        connect()

        // 请求通知权限
        if (Notification.permission === 'default') {
            Notification.requestPermission()
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
            wsRef.current?.close()
        }
    }, [connect])

    return { sendCommand }
}
