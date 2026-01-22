import { X } from 'lucide-react'
import { KLineChart } from './KLineChart'
import type { ChartData } from '../store'
import './ChartModal.css'

interface Props {
    data: ChartData | null
    onClose: () => void
}

export function ChartModal({ data, onClose }: Props) {
    if (!data || !data.prices || data.prices.length === 0) return null

    return (
        <div className="chart-modal-overlay" onClick={onClose}>
            <div className="chart-modal-content" onClick={e => e.stopPropagation()}>
                <div className="chart-modal-header">
                    <h3>
                        <span className="stock-name">{data.name}</span>
                        <span className="stock-code">{data.ticker}</span>
                    </h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="chart-modal-body">
                    <KLineChart data={data} />
                </div>
            </div>
        </div>
    )
}
