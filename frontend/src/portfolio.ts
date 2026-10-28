import { marketBySymbol, marketItems } from './marketData'

export const INITIAL_CASH = 100000
export const PORTFOLIO_STORAGE_KEY = 'stocksense-virtual-portfolio'
const defaultPrices = Object.fromEntries(marketItems.map((item) => [item.symbol, item.price]))

export type Holding = {
  symbol: string
  quantity: number
  averagePrice: number
}

export type Transaction = {
  id: string
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  price: number
  total: number
  timestamp: string
}

export type PortfolioState = {
  cash: number
  holdings: Holding[]
  transactions: Transaction[]
}

export const createInitialPortfolio = (): PortfolioState => ({ cash: INITIAL_CASH, holdings: [], transactions: [] })

export const getHolding = (portfolio: PortfolioState, symbol: string) => portfolio.holdings.find((holding) => holding.symbol === symbol)

export const getHoldingValue = (holding: Holding, prices: Record<string, number> = defaultPrices) => holding.quantity * (prices[holding.symbol] ?? holding.averagePrice)

export const getPortfolioValue = (portfolio: PortfolioState, prices: Record<string, number> = defaultPrices) => portfolio.cash + portfolio.holdings.reduce((total, holding) => total + getHoldingValue(holding, prices), 0)

export const getUnrealizedProfitLoss = (portfolio: PortfolioState, prices: Record<string, number> = defaultPrices) => portfolio.holdings.reduce((total, holding) => total + holding.quantity * ((prices[holding.symbol] ?? holding.averagePrice) - holding.averagePrice), 0)

export const getTradeCount = (portfolio: PortfolioState) => portfolio.transactions.length

export const loadPortfolio = (): PortfolioState => {
  try {
    const stored = localStorage.getItem(PORTFOLIO_STORAGE_KEY)
    if (!stored) return createInitialPortfolio()
    const parsed = JSON.parse(stored) as Partial<PortfolioState>
    if (typeof parsed.cash !== 'number' || !Array.isArray(parsed.holdings) || !Array.isArray(parsed.transactions)) return createInitialPortfolio()
    const holdings = parsed.holdings.filter((holding): holding is Holding => Boolean(holding) && typeof holding.symbol === 'string' && marketBySymbol[holding.symbol] !== undefined && Number.isInteger(holding.quantity) && holding.quantity > 0 && typeof holding.averagePrice === 'number')
    const transactions = parsed.transactions.filter((transaction): transaction is Transaction => Boolean(transaction) && typeof transaction.id === 'string' && marketBySymbol[transaction.symbol] !== undefined && (transaction.action === 'BUY' || transaction.action === 'SELL') && Number.isInteger(transaction.quantity) && transaction.quantity > 0 && typeof transaction.price === 'number' && typeof transaction.total === 'number' && typeof transaction.timestamp === 'string')
    return { cash: Math.max(0, parsed.cash), holdings, transactions }
  } catch {
    return createInitialPortfolio()
  }
}

export const savePortfolio = (portfolio: PortfolioState) => {
  localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolio))
}

export const executeTrade = (portfolio: PortfolioState, symbol: string, action: Transaction['action'], quantity: number, prices: Record<string, number> = defaultPrices): { portfolio?: PortfolioState; error?: string } => {
  const marketItem = marketBySymbol[symbol]
  if (!marketItem) return { error: 'Please select a valid simulated stock.' }
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantity must be a positive whole number.' }
  const holding = getHolding(portfolio, symbol)
  const executionPrice = prices[symbol] ?? marketItem.price
  const total = executionPrice * quantity
  if (action === 'BUY' && total > portfolio.cash) return { error: 'You do not have enough virtual cash for this purchase.' }
  if (action === 'SELL' && (!holding || quantity > holding.quantity)) return { error: 'You cannot sell more shares than you currently own.' }

  const nextHoldings = portfolio.holdings.filter((item) => item.symbol !== symbol)
  if (action === 'BUY') {
    const currentQuantity = holding?.quantity ?? 0
    const nextQuantity = currentQuantity + quantity
    const averagePrice = (((holding?.averagePrice ?? 0) * currentQuantity) + total) / nextQuantity
    nextHoldings.push({ symbol, quantity: nextQuantity, averagePrice })
  } else if (holding && holding.quantity > quantity) {
    nextHoldings.push(holding ? { ...holding, quantity: holding.quantity - quantity } : holding)
  }

  const nextPortfolio: PortfolioState = {
    cash: action === 'BUY' ? portfolio.cash - total : portfolio.cash + total,
    holdings: nextHoldings,
    transactions: [{ id: `${Date.now()}-${symbol}`, symbol, action, quantity, price: executionPrice, total, timestamp: new Date().toISOString() }, ...portfolio.transactions],
  }
  return { portfolio: nextPortfolio }
}

export const holdingRows = (portfolio: PortfolioState, prices: Record<string, number> = defaultPrices) => portfolio.holdings.map((holding) => ({ ...holding, marketItem: marketBySymbol[holding.symbol], currentValue: getHoldingValue(holding, prices), profitLoss: holding.quantity * ((prices[holding.symbol] ?? holding.averagePrice) - holding.averagePrice) }))

export const allMarketItems = () => marketItems
