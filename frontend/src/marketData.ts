export type MarketItem = {
  symbol: string
  name: string
  price: number
  change: string
  positive: boolean
}

export const marketItems: MarketItem[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2941.2, change: '+1.24%', positive: true },
  { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3884.65, change: '+0.82%', positive: true },
  { symbol: 'INFY', name: 'Infosys', price: 1522.4, change: '-0.36%', positive: false },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1674.1, change: '+0.58%', positive: true },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 1208.75, change: '-0.14%', positive: false },
]

export const marketBySymbol = Object.fromEntries(marketItems.map((item) => [item.symbol, item])) as Record<string, MarketItem>

export const formatCurrency = (value: number, withSign = false) => {
  const sign = withSign && value > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)}`
}
