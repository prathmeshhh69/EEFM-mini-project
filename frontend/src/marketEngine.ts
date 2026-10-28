import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { marketItems, type MarketItem } from './marketData'

export type PricePoint = { timestamp: number; price: number }
export type SimulatedStock = MarketItem & {
  baseline: number
  previousPrice: number
  high: number
  low: number
  history: PricePoint[]
}

type MarketContextValue = {
  stocks: SimulatedStock[]
  bySymbol: Record<string, SimulatedStock>
  paused: boolean
  speed: number
  setPaused: (paused: boolean) => void
  setSpeed: (speed: number) => void
}

const MarketContext = createContext<MarketContextValue | null>(null)
const MAX_POINTS = 180
const speeds = [1000, 2000, 4000]

const makeInitialState = (): SimulatedStock[] => marketItems.map((item) => ({
  ...item,
  baseline: item.price,
  previousPrice: item.price,
  high: item.price,
  low: item.price,
  history: [{ timestamp: Date.now(), price: item.price }],
}))

const nextPrice = (stock: SimulatedStock) => {
  const occasionalMove = Math.random() < 0.045 ? (Math.random() - 0.5) * 0.012 : 0
  const movement = (Math.random() - 0.5) * 0.0028 + occasionalMove
  return Math.max(stock.baseline * 0.82, Math.min(stock.baseline * 1.18, stock.price * (1 + movement)))
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [stocks, setStocks] = useState(makeInitialState)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(speeds[1])
  const stocksRef = useRef(stocks)
  useEffect(() => { stocksRef.current = stocks }, [stocks])

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      const timestamp = Date.now()
      const next = stocksRef.current.map((stock) => {
        const price = Number(nextPrice(stock).toFixed(2))
        const history = [...stock.history, { timestamp, price }].slice(-MAX_POINTS)
        const change = price - stock.baseline
        return {
          ...stock,
          price,
          previousPrice: stock.price,
          change: `${change >= 0 ? '+' : ''}${((change / stock.baseline) * 100).toFixed(2)}%`,
          positive: change >= 0,
          high: Math.max(stock.high, price),
          low: Math.min(stock.low, price),
          history,
        }
      })
      stocksRef.current = next
      setStocks(next)
    }, speed)
    return () => window.clearInterval(timer)
  }, [paused, speed])

  const value = useMemo(() => ({
    stocks,
    bySymbol: Object.fromEntries(stocks.map((stock) => [stock.symbol, stock])),
    paused,
    speed,
    setPaused,
    setSpeed,
  }), [stocks, paused, speed])

  return createElement(MarketContext.Provider, { value }, children)
}

export const useMarket = () => {
  const context = useContext(MarketContext)
  if (!context) throw new Error('useMarket must be used inside MarketProvider')
  return context
}

export const getPattern = (history: PricePoint[]) => {
  const recent = history.slice(-12)
  if (recent.length < 3) return { label: 'Sideways movement', detail: 'There is not enough simulated history yet to identify a clear direction.' }
  const first = recent[0].price
  const last = recent[recent.length - 1].price
  const range = (Math.max(...recent.map((point) => point.price)) - Math.min(...recent.map((point) => point.price))) / first
  const drift = (last - first) / first
  if (range > 0.012) return { label: 'Volatility', detail: 'Prices are moving more sharply than usual in this simulated interval.' }
  if (drift > 0.0015) return { label: 'Upward momentum', detail: 'Recent simulated prices are generally rising, with normal short pullbacks.' }
  if (drift < -0.0015) return { label: 'Downward momentum', detail: 'Recent simulated prices are generally falling, with occasional bounces.' }
  return { label: 'Sideways movement', detail: 'Prices are fluctuating within a relatively narrow simulated range.' }
}
