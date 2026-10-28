import { useEffect, useState } from 'react'
import { Activity, AlertTriangle, ArrowRight, ArrowUpRight, BrainCircuit, CheckCircle2, Clock3, Database, Gauge, GraduationCap, LoaderCircle, MessageSquareText, RotateCcw, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import { Button } from './components/ui/button'
import { formatCurrency, marketItems } from './marketData'
import { getPattern, useMarket, type SimulatedStock } from './marketEngine'
import {
  createInitialPortfolio,
  executeTrade,
  getPortfolioValue,
  getTradeCount,
  getUnrealizedProfitLoss,
  holdingRows,
  loadPortfolio,
  savePortfolio,
  type PortfolioState,
  type Transaction,
} from './portfolio'

type Page = 'Dashboard' | 'Market Watch' | 'Virtual Portfolio' | 'AI Analysis' | 'Market Intelligence' | 'Sentiment Analyzer' | 'Learn'
type AnalysisState = { status: 'idle' | 'loading' | 'success' | 'error'; text: string }
type MarketBrief = { overallAssessment: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; trendSignal: 'UPWARD' | 'DOWNWARD' | 'SIDEWAYS' | 'INSUFFICIENT_DATA'; sentimentSignal: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'NOT_PROVIDED'; reasoning: string; riskFactors: string[]; learningInsight: string; nextThingsToObserve: string[] }

const pages: Page[] = ['Dashboard', 'Market Watch', 'Virtual Portfolio', 'AI Analysis', 'Market Intelligence', 'Sentiment Analyzer', 'Learn']
const navIcons: Record<Page, string> = { Dashboard: '▦', 'Market Watch': '◌', 'Virtual Portfolio': '▤', 'AI Analysis': '✦', 'Market Intelligence': '⌁', 'Sentiment Analyzer': '◒', Learn: '?' }
function App() {
  const { stocks, paused, speed, setPaused, setSpeed } = useMarket()
  const prices = Object.fromEntries(stocks.map((stock) => [stock.symbol, stock.price]))
  const [activePage, setActivePage] = useState<Page>('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [portfolio, setPortfolio] = useState<PortfolioState>(loadPortfolio)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => { savePortfolio(portfolio) }, [portfolio])

  const selectPage = (page: Page) => { setActivePage(page); setMenuOpen(false); setNotice(null) }
  const handleTrade = (symbol: string, action: Transaction['action'], quantity: number) => {
    const result = executeTrade(portfolio, symbol, action, quantity, prices)
    if (result.error) { setNotice({ type: 'error', text: result.error }); return false }
    setPortfolio(result.portfolio!)
    setNotice({ type: 'success', text: `${action === 'BUY' ? 'Bought' : 'Sold'} ${quantity} ${symbol} share${quantity === 1 ? '' : 's'} at the simulated market price.` })
    return true
  }
  const resetPortfolio = () => {
    if (window.confirm('Reset your virtual portfolio? This will remove all holdings and transaction history.')) {
      setPortfolio(createInitialPortfolio())
      setNotice({ type: 'success', text: 'Your virtual portfolio has been reset to ₹1,00,000.' })
    }
  }
  const portfolioValue = getPortfolioValue(portfolio, prices)
  const profitLoss = getUnrealizedProfitLoss(portfolio, prices)

  return (
    <div className={`app-shell ${activePage === 'AI Analysis' ? 'analysis-mode' : ''}`}>
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark">S</span><span>StockSense <strong>AI</strong></span></div>
        <div className="sidebar-heading">Workspace</div>
        <nav aria-label="Main navigation">{pages.map((page) => <button className={`nav-item ${activePage === page ? 'active' : ''}`} key={page} onClick={() => selectPage(page)} type="button"><span className="nav-icon" aria-hidden="true">{navIcons[page]}</span><span>{page}</span></button>)}</nav>
        <div className="sidebar-footer"><div className="profile-avatar">PS</div><div><strong>Practice account</strong><span>Learning mode</span></div><span className="more-icon" aria-hidden="true">...</span></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><button className="menu-toggle" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{activePage}</strong></div><div className="topbar-actions"><span className="market-status"><i /> Simulated market</span><button className="icon-button" type="button" aria-label="Notifications">♧</button><div className="top-avatar">PS</div></div></header>
        <div className="page-content">
          <div className="simulation-notice"><span className="notice-icon">i</span><span><strong>Simulation environment</strong> All prices shown are fixed sample data for learning purposes and are not live market prices.</span></div>
          {activePage === 'Dashboard' && <Dashboard stocks={stocks} portfolio={portfolio} portfolioValue={portfolioValue} profitLoss={profitLoss} onNavigate={selectPage} />}
          {activePage === 'Market Watch' && <MarketWatch stocks={stocks} paused={paused} speed={speed} onPause={() => setPaused(!paused)} onSpeed={setSpeed} onTrade={(symbol) => { selectPage('Virtual Portfolio'); setTimeout(() => window.dispatchEvent(new CustomEvent('stocksense:select-stock', { detail: symbol })), 0) }} />}
          {activePage === 'Virtual Portfolio' && <PortfolioPage stocks={stocks} prices={prices} portfolio={portfolio} portfolioValue={portfolioValue} profitLoss={profitLoss} notice={notice} onTrade={handleTrade} onReset={resetPortfolio} />}
          {activePage === 'AI Analysis' && <AIAnalysis stocks={stocks} />}
          {activePage === 'Market Intelligence' && <MarketIntelligence stocks={stocks} />}
          {activePage === 'Sentiment Analyzer' && <SentimentAnalyzer />}
          {activePage === 'Learn' && <LearnPage />}
          {!pages.includes(activePage) && <PlaceholderPage page={activePage} onLearn={() => selectPage('Dashboard')} />}
        </div>
      </main>
    </div>
  )
}

function Dashboard({ stocks, portfolio, portfolioValue, profitLoss, onNavigate }: { stocks: SimulatedStock[]; portfolio: PortfolioState; portfolioValue: number; profitLoss: number; onNavigate: (page: Page) => void }) {
  const topGainer = [...stocks].sort((a, b) => (b.price - b.baseline) / b.baseline - (a.price - a.baseline) / a.baseline)[0]
  const topLoser = [...stocks].sort((a, b) => (a.price - a.baseline) / a.baseline - (b.price - b.baseline) / b.baseline)[0]
  const portfolioChart = stocks[0].history.slice(-12).map((point) => ({ day: new Date(point.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), value: point.price }))
  return <>
    <section className="page-intro"><div><p className="eyebrow">TUESDAY, 20 OCTOBER 2026</p><h1>Good afternoon, Prathamesh.</h1><p className="intro-copy">Here is your simulated market overview for today.</p></div><button className="outline-button" type="button" onClick={() => onNavigate('Virtual Portfolio')}>Trade stocks <span>↗</span></button></section>
    <section className="wallet-card"><div><p className="card-label">AVAILABLE VIRTUAL CASH</p><strong className="wallet-value">{formatCurrency(portfolio.cash)}</strong><p className="wallet-meta"><span>{portfolio.holdings.length} active holding{portfolio.holdings.length === 1 ? '' : 's'}</span> <span>Sample data only</span></p></div><div className="wallet-mark">₹</div></section>
    <section className="summary-grid" aria-label="Portfolio summary"><SummaryCard label="Portfolio value" value={formatCurrency(portfolioValue)} detail={profitLoss >= 0 ? `+${formatCurrency(profitLoss)} unrealized` : `${formatCurrency(profitLoss)} unrealized`} positive={profitLoss >= 0} /><SummaryCard label="Virtual profit / loss" value={formatCurrency(profitLoss, true)} detail="Current holdings" positive={profitLoss >= 0} /><SummaryCard label="Number of trades" value={String(getTradeCount(portfolio))} detail="All simulated trades" /></section>
    <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><p className="card-label">SIMULATED MARKET PULSE</p><h2>Latest price movement</h2></div><span className="sample-tag">Simulated</span></div><div className="chart-key"><span className="line-key" /> {stocks[0].symbol} price movement</div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={portfolioChart} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#161616" stopOpacity={0.12} /><stop offset="100%" stopColor="#161616" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#e7e7e7" vertical={false} /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#8a8a8a', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8a8a8a', fontSize: 11 }} domain={['dataMin - 10', 'dataMax + 10']} /><Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Simulated price']} labelStyle={{ color: '#666' }} contentStyle={{ border: '1px solid #dedede', borderRadius: 4, fontSize: 12 }} /><Area type="monotone" dataKey="value" stroke="#171717" strokeWidth={2} fill="url(#chartFill)" isAnimationActive /></AreaChart></ResponsiveContainer></div></section><section className="panel watch-panel"><div className="panel-heading"><div><p className="card-label">MARKET WATCH</p><h2>Tracked stocks</h2></div><button className="text-button" type="button" onClick={() => onNavigate('Market Watch')}>View all <span>→</span></button></div><div className="ranking-strip"><span>Top gainer <strong className="positive">{topGainer.symbol} {formatCurrency(topGainer.price)}</strong></span><span>Top loser <strong className="negative">{topLoser.symbol} {formatCurrency(topLoser.price)}</strong></span></div><MarketRows stocks={stocks} compact /></section></div>
  </>
}

function MarketRows({ stocks, compact = false }: { stocks: SimulatedStock[]; compact?: boolean }) {
  return <div className="market-list">{stocks.map((item) => <div className="market-row" key={item.symbol}><div className="stock-symbol">{item.symbol.slice(0, 2)}</div><div className="stock-name"><strong>{item.symbol}</strong><span>{item.name}</span></div><div className="stock-quote"><strong>{formatCurrency(item.price)}</strong><span className={item.positive ? 'positive' : 'negative'}>{item.change}</span></div>{!compact && <button className="small-trade-button" type="button">Select to trade</button>}</div>)}</div>
}

function MarketWatch({ stocks, paused, speed, onPause, onSpeed, onTrade }: { stocks: SimulatedStock[]; paused: boolean; speed: number; onPause: () => void; onSpeed: (speed: number) => void; onTrade: (symbol: string) => void }) {
  const [selectedSymbol, setSelectedSymbol] = useState(stocks[0].symbol)
  const [windowMinutes, setWindowMinutes] = useState(5)
  const selected = stocks.find((stock) => stock.symbol === selectedSymbol) ?? stocks[0]
  const pattern = getPattern(selected.history)
  const latestTimestamp = selected.history[selected.history.length - 1]?.timestamp ?? 0
  const chartData = selected.history.filter((point) => windowMinutes === 0 || point.timestamp > latestTimestamp - windowMinutes * 60 * 1000).map((point) => ({ time: new Date(point.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), price: point.price }))
  const [challenge, setChallenge] = useState('')
  const challengeAnswer = getPattern(selected.history).label === 'Upward momentum' ? 'upward' : getPattern(selected.history).label === 'Downward momentum' ? 'downward' : 'sideways'
  return <section><div className="ticker-bar">{[...stocks, ...stocks].map((stock, index) => <span key={`${stock.symbol}-${index}`}><strong>{stock.symbol}</strong> {formatCurrency(stock.price)} <em className={`${stock.positive ? 'positive' : 'negative'} ${stock.price >= stock.previousPrice ? 'price-flash-up' : 'price-flash-down'}`}>{stock.change}</em></span>)}</div><div className="page-intro"><div><p className="eyebrow">SIMULATED MARKET</p><h1>Market watch</h1><p className="intro-copy">Local simulated prices update every few seconds. They are not live NSE prices.</p></div><div className="market-controls"><span className="simulated-badge">SIMULATED MARKET</span><button className="outline-button" type="button" onClick={onPause}>{paused ? 'Resume' : 'Pause'}</button><select value={speed} onChange={(event) => onSpeed(Number(event.target.value))}><option value="1000">Fast</option><option value="2000">Normal</option><option value="4000">Slow</option></select></div></div><div className="market-watch-layout live-market-layout"><section className="panel"><div className="panel-heading"><div><p className="card-label">FIVE TRACKED STOCKS</p><h2>Watchlist</h2></div><span className="sample-tag">{paused ? 'Paused' : 'Updating'}</span></div><div className="market-list">{stocks.map((item) => <button className={`market-row market-row-button ${item.symbol === selected.symbol ? 'selected-row' : ''}`} key={item.symbol} type="button" onClick={() => setSelectedSymbol(item.symbol)}><div className="stock-symbol">{item.symbol.slice(0, 2)}</div><div className="stock-name"><strong>{item.symbol}</strong><span>{item.name}</span></div><div className="stock-quote"><strong className={item.price >= item.previousPrice ? 'price-flash-up' : 'price-flash-down'}>{formatCurrency(item.price)}</strong><span className={item.positive ? 'positive' : 'negative'}>{item.change}</span></div></button>)}</div></section><section className="panel selected-stock-panel"><div className="panel-heading"><div><p className="card-label">{selected.symbol} · SIMULATED HISTORY</p><h2>{formatCurrency(selected.price)}</h2></div><button className="small-trade-button" type="button" onClick={() => onTrade(selected.symbol)}>Trade</button></div><div className="stock-metrics"><span>Session high <strong>{formatCurrency(selected.high)}</strong></span><span>Session low <strong>{formatCurrency(selected.low)}</strong></span><span>Change <strong className={selected.positive ? 'positive' : 'negative'}>{selected.change}</strong></span></div><div className="time-controls"><span>Chart window</span><span className="window-buttons"><button type="button" className={windowMinutes === 1 ? 'active' : ''} onClick={() => setWindowMinutes(1)}>1 min</button><button type="button" className={windowMinutes === 5 ? 'active' : ''} onClick={() => setWindowMinutes(5)}>5 min</button><button type="button" className={windowMinutes === 0 ? 'active' : ''} onClick={() => setWindowMinutes(0)}>Session</button></span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData.length > 1 ? chartData : selected.history.map((point) => ({ time: String(point.timestamp), price: point.price }))}><XAxis dataKey="time" hide /><YAxis domain={['dataMin - 5', 'dataMax + 5']} hide /><Tooltip formatter={(value) => [formatCurrency(Number(value)), 'Simulated price']} /><Area type="monotone" dataKey="price" stroke={selected.positive ? '#517e5d' : '#9d5f5b'} fillOpacity={0.08} fill={selected.positive ? '#517e5d' : '#9d5f5b'} isAnimationActive /></AreaChart></ResponsiveContainer></div></section></div><section className="panel learning-panel"><div className="panel-heading"><div><p className="card-label">LEARN MARKET PATTERNS</p><h2>{pattern.label}</h2></div><span className="sample-tag">Educational only</span></div><p>{selected.symbol} has moved {pattern.label === 'Upward momentum' ? 'upward' : pattern.label === 'Downward momentum' ? 'downward' : 'within a changing range'} over this recent simulated interval. {pattern.detail} This example does not guarantee what happens next.</p><div className="challenge"><strong>Quick challenge:</strong> Does this short chart look upward, downward, or sideways? <select value={challenge} onChange={(event) => setChallenge(event.target.value)}><option value="">Choose...</option><option value="upward">Upward</option><option value="downward">Downward</option><option value="sideways">Sideways</option></select>{challenge && <span className={challenge === challengeAnswer ? 'positive' : 'negative'}>{challenge === challengeAnswer ? `Correct — ${challengeAnswer} movement in this simulation.` : `The answer is ${challengeAnswer}; compare the first and last points.`}</span>}</div></section></section>
}

type SentimentResult = { sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; summary: string; keyPhrases: string[]; marketImplication: string; disclaimer: string }
const exampleHeadlines = ['TCS reports stronger quarterly demand from enterprise clients', 'Technology shares fall as investors worry about higher interest rates', 'Market waits for more evidence before taking a clear direction']

function SentimentAnalyzer() {
  const [text, setText] = useState('')
  const [state, setState] = useState<AnalysisState>({ status: 'idle', text: '' })
  const [result, setResult] = useState<SentimentResult | null>(null)
  const maxLength = 2000
  const analyze = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) { setState({ status: 'error', text: 'Paste a headline or short news excerpt first.' }); setResult(null); return }
    if (trimmed.length > maxLength) { setState({ status: 'error', text: `Keep the text under ${maxLength.toLocaleString()} characters.` }); setResult(null); return }
    setState({ status: 'loading', text: '' }); setResult(null)
    try {
      const response = await fetch('/api/ai/sentiment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: trimmed }) })
      const data = await response.json() as { sentiment?: string; error?: string }
      if (!response.ok || typeof data.sentiment !== 'string') throw new Error(data.error || 'Sentiment analysis could not be completed.')
      const parsed = parseSentimentResult(data.sentiment)
      if (!parsed) throw new Error('Gemini returned an unexpected sentiment format. Please try again.')
      setResult(parsed); setState({ status: 'success', text: '' })
    } catch (error) { setState({ status: 'error', text: error instanceof Error ? error.message : 'Sentiment analysis could not be completed.' }) }
  }
  return <section className="sentiment-page"><div className="page-intro sentiment-intro"><div><p className="eyebrow">GEMINI TEXT SIGNALS</p><h1>Sentiment analyzer</h1><p className="intro-copy">Paste a headline and get a simple read on the tone of the text.</p></div><div className="sentiment-mark"><MessageSquareText size={22} /><span>TEXT ONLY</span></div></div><div className="sentiment-disclaimer"><span className="notice-icon">i</span><span>Educational text classification only. Sentiment is not a prediction of stock performance.</span></div><div className="sentiment-layout"><section className="sentiment-input-card"><div className="sentiment-card-heading"><div><p className="card-label">INPUT</p><h2>What are you reading?</h2></div><span className="character-count">{text.length.toLocaleString()} / {maxLength.toLocaleString()}</span></div><form onSubmit={analyze}><textarea aria-label="Headline or news excerpt" maxLength={maxLength} value={text} onChange={(event) => { setText(event.target.value); if (state.status !== 'idle') setState({ status: 'idle', text: '' }) }} placeholder="Paste a financial headline or short news excerpt..." /><div className="example-row"><span>Try an example</span>{exampleHeadlines.map((example) => <button type="button" key={example} onClick={() => setText(example)}>{example.length > 38 ? `${example.slice(0, 38)}...` : example}</button>)}</div><Button className="sentiment-submit" type="submit" disabled={state.status === 'loading'}><Sparkles size={15} />{state.status === 'loading' ? 'Analyzing sentiment...' : 'Analyze sentiment'}<ArrowUpRight size={14} /></Button></form>{state.status === 'loading' && <div className="sentiment-loading" role="status"><LoaderCircle className="loading-spinner" size={16} /><span>Gemini is reading the tone of the supplied text...</span></div>}{state.status === 'error' && <div className="analysis-error sentiment-error" role="alert"><AlertTriangle size={16} /><span>{state.text}</span></div>}</section>{result && <SentimentResultCard result={result} />}</div></section>
}

function SentimentResultCard({ result }: { result: SentimentResult }) {
  const positive = result.sentiment === 'POSITIVE'
  const negative = result.sentiment === 'NEGATIVE'
  return <section className={`sentiment-result sentiment-${result.sentiment.toLowerCase()}`}><div className="sentiment-result-header"><div className="sentiment-result-icon">{positive ? <TrendingUp size={22} /> : negative ? <TrendingDown size={22} /> : <Activity size={22} />}</div><div><p className="card-label">SENTIMENT READ</p><h2>{result.sentiment}</h2></div><div className="sentiment-confidence"><span>Confidence</span><strong>{result.confidence}</strong></div></div><div className="sentiment-summary"><p>{result.summary}</p></div><div className="sentiment-result-grid"><div><p className="result-label">KEY PHRASES</p><div className="phrase-list">{result.keyPhrases.length > 0 ? result.keyPhrases.map((phrase) => <span key={phrase}>{phrase}</span>) : <em>No supporting phrase returned.</em>}</div></div><div><p className="result-label">POSSIBLE RELEVANCE</p><p className="result-copy">{result.marketImplication}</p></div><div className="sentiment-risk"><p className="result-label">KEEP IN MIND</p><p className="result-copy">{result.disclaimer}</p></div></div></section>
}

function parseSentimentResult(text: string): SentimentResult | null {
  try {
    const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(normalized) as Partial<SentimentResult>
    const validSentiment = parsed.sentiment === 'POSITIVE' || parsed.sentiment === 'NEGATIVE' || parsed.sentiment === 'NEUTRAL'
    const validConfidence = parsed.confidence === 'LOW' || parsed.confidence === 'MEDIUM' || parsed.confidence === 'HIGH'
    if (!validSentiment || !validConfidence || typeof parsed.summary !== 'string' || typeof parsed.marketImplication !== 'string' || typeof parsed.disclaimer !== 'string' || !Array.isArray(parsed.keyPhrases) || parsed.keyPhrases.length > 3 || parsed.keyPhrases.some((phrase) => typeof phrase !== 'string')) return null
    return { sentiment: parsed.sentiment as SentimentResult['sentiment'], confidence: parsed.confidence as SentimentResult['confidence'], summary: parsed.summary, keyPhrases: parsed.keyPhrases as string[], marketImplication: parsed.marketImplication, disclaimer: parsed.disclaimer }
  } catch { return null }
}

type AnalysisResult = { verdict: 'BULLISH' | 'NEUTRAL' | 'BEARISH'; confidence: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; priceSummary: string; risk: string; watchFor: string[] }

const analysisStages = ['Reviewing price data', 'Evaluating evidence', 'Preparing insights']

function AIAnalysis({ stocks }: { stocks: SimulatedStock[] }) {
  const [symbol, setSymbol] = useState(stocks[0].symbol)
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle', text: '' })
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null)
  const [stage, setStage] = useState(0)
  const selected = stocks.find((item) => item.symbol === symbol) ?? stocks[0]
  const parsed = analysis.status === 'success' ? parseAnalysisResult(analysis.text) : null

  useEffect(() => {
    if (analysis.status !== 'loading') return
    const interval = window.setInterval(() => setStage((current) => (current + 1) % analysisStages.length), 1200)
    return () => window.clearInterval(interval)
  }, [analysis.status])

  const requestAnalysis = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAnalysis({ status: 'loading', text: '' })
    setStage(0)
    try {
      const response = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, stock: selected }) })
      const data = await response.json() as { analysis?: string; error?: string }
      if (!response.ok || !data.analysis) throw new Error(data.error || 'The analysis could not be generated.')
      if (!parseAnalysisResult(data.analysis)) throw new Error('Gemini returned an unexpected response. Please try again.')
      setAnalysis({ status: 'success', text: data.analysis })
      setLastAnalyzed(new Date())
    } catch (error) {
      setAnalysis({ status: 'error', text: error instanceof Error ? error.message : 'The analysis could not be generated. Please try again.' })
    }
  }

  return <section className="ai-terminal"><header className="analysis-header"><div className="analysis-title"><div className="terminal-kicker"><span className="live-dot" /> GEMINI ANALYTICS / SIMULATION</div><h1>AI stock analysis</h1><p>Clear, beginner-friendly explanations for your practice portfolio.</p></div><div className="analysis-meta"><div className="simulated-badge"><Database size={13} /> SIMULATED DATA</div>{lastAnalyzed && <span className="last-analysis"><Clock3 size={13} /> Updated {lastAnalyzed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div></header><section className="analysis-toolbar"><div className="ticker-identity"><div className="ticker-emblem">{selected.symbol.slice(0, 2)}</div><div><span className="ticker-symbol">{selected.symbol}</span><strong>{selected.name}</strong></div></div><div className="ticker-quote"><span>Current sample price</span><strong>{formatCurrency(selected.price)}</strong><em className={selected.positive ? 'quote-up' : 'quote-down'}>{selected.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{selected.change}</em></div><form onSubmit={requestAnalysis} className="analysis-action"><label htmlFor="analysis-stock">Stock<select id="analysis-stock" value={symbol} onChange={(event) => { setSymbol(event.target.value); setAnalysis({ status: 'idle', text: '' }); setLastAnalyzed(null) }}>{marketItems.map((item) => <option value={item.symbol} key={item.symbol}>{item.symbol} · {item.name}</option>)}</select></label><Button type="submit" disabled={analysis.status === 'loading'} className="analysis-primary"><Sparkles size={15} /> {analysis.status === 'loading' ? 'Analyzing...' : 'Analyze with Gemini'} <ArrowUpRight size={14} /></Button></form></section>{analysis.status === 'error' && <div className="analysis-error" role="alert"><AlertTriangle size={16} /> <span>{analysis.text}</span></div>}{analysis.status === 'loading' && <AnalysisLoading stage={stage} />}{analysis.status === 'idle' && <AnalysisEmpty onAnalyze={() => void requestAnalysis(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>)} />}{analysis.status === 'success' && parsed && <AnalysisDashboard selected={selected} result={parsed} />}</section>
}

function MarketIntelligence({ stocks }: { stocks: SimulatedStock[] }) {
  const [symbol, setSymbol] = useState(stocks[0].symbol)
  const [headline, setHeadline] = useState('')
  const [state, setState] = useState<AnalysisState>({ status: 'idle', text: '' })
  const [brief, setBrief] = useState<MarketBrief | null>(null)
  const selected = stocks.find((stock) => stock.symbol === symbol) ?? stocks[0]
  const recent = selected.history.slice(-12)
  const pattern = getPattern(recent)
  const trendSignal = pattern.label === 'Upward momentum' ? 'UPWARD' : pattern.label === 'Downward momentum' ? 'DOWNWARD' : 'SIDEWAYS'
  const returns = recent.slice(1).map((point, index) => Math.abs((point.price - recent[index].price) / recent[index].price))
  const volatility = returns.length === 0 || Math.max(...returns) < 0.002 ? 'LOW' : Math.max(...returns) < 0.006 ? 'MEDIUM' : 'HIGH'
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setState({ status: 'loading', text: '' }); setBrief(null)
    try {
      const response = await fetch('/api/ai/market-brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol, pricePoints: recent, changePercent: selected.change, trend: trendSignal, volatility, ...(headline.trim() ? { headline: headline.trim() } : {}) }) })
      const data = await response.json() as { brief?: string; error?: string }
      if (!response.ok || typeof data.brief !== 'string') throw new Error(data.error || 'The market brief could not be generated.')
      setBrief(JSON.parse(data.brief) as MarketBrief); setState({ status: 'success', text: '' })
    } catch (error) {
      setState({ status: 'error', text: error instanceof Error ? error.message : 'The market brief could not be generated.' })
    }
  }
  return <section className="intelligence-page"><div className="page-intro"><div><p className="eyebrow">AI MARKET INTELLIGENCE LAB</p><h1>Learn from connected signals.</h1><p className="intro-copy">One Gemini brief combines the selected stock's simulated price series with optional user-provided text.</p></div><span className="simulated-badge">SIMULATED PRICES</span></div><div className="intelligence-disclaimer"><Database size={15} /> Prices and trends are generated locally for education. They are not live NSE prices, and the headline is not verified financial news.</div><section className="intelligence-controls panel"><div className="intelligence-select"><label htmlFor="intelligence-stock">Stock<select id="intelligence-stock" value={symbol} onChange={(event) => { setSymbol(event.target.value); setBrief(null); setState({ status: 'idle', text: '' }) }}>{stocks.map((stock) => <option key={stock.symbol} value={stock.symbol}>{stock.symbol} · {stock.name}</option>)}</select></label><div className="intelligence-snapshot"><span>Current <strong>{formatCurrency(selected.price)}</strong></span><span>Trend <strong>{trendSignal}</strong></span><span>Volatility <strong>{volatility}</strong></span></div></div><div className="intelligence-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={recent.map((point) => ({ time: point.timestamp, price: point.price }))}><XAxis dataKey="time" hide /><YAxis domain={['dataMin - 5', 'dataMax + 5']} hide /><Area type="monotone" dataKey="price" stroke="#517e5d" fill="#517e5d" fillOpacity={0.08} isAnimationActive /></AreaChart></ResponsiveContainer></div><form className="headline-form" onSubmit={submit}><label htmlFor="intelligence-headline">Optional financial headline <textarea id="intelligence-headline" value={headline} maxLength={2000} onChange={(event) => setHeadline(event.target.value)} placeholder="Paste text for a tone signal, or leave empty to use price data alone." /></label><Button type="submit" disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Generating brief...' : 'Generate Market Brief'} <ArrowUpRight size={14} /></Button></form></section>{state.status === 'error' && <div className="trade-notice error" role="alert">{state.text}</div>}{state.status === 'loading' && <div className="intelligence-loading panel"><LoaderCircle className="loading-spinner" size={17} /> Gemini is connecting the supplied signals...</div>}{state.status === 'idle' && <div className="intelligence-empty panel"><Sparkles size={20} /><div><strong>Ready for a concise learning brief</strong><p>Submit with no headline to see how simulated price data alone is interpreted.</p></div></div>}{brief && <MarketBriefResult brief={brief} headlineProvided={Boolean(headline.trim())} />}</section>
}

function MarketBriefResult({ brief, headlineProvided }: { brief: MarketBrief; headlineProvided: boolean }) {
  return <section className="market-brief-result"><div className="brief-overall panel"><div><p className="card-label">OVERALL ASSESSMENT</p><h2 className={`brief-${brief.overallAssessment.toLowerCase()}`}>{brief.overallAssessment}</h2><p>{brief.reasoning}</p></div><div className="brief-badges"><span>{brief.trendSignal}</span><span>{headlineProvided ? brief.sentimentSignal : 'SENTIMENT NOT PROVIDED'}</span></div></div><div className="brief-perspectives"><InsightCard icon={<TrendingUp size={16} />} eyebrow="01 / TREND ANALYST" title="Recent simulated movement"><p>The supplied series is classified as <strong>{brief.trendSignal}</strong>. {brief.learningInsight}</p></InsightCard><InsightCard icon={<MessageSquareText size={16} />} eyebrow="02 / SENTIMENT ANALYST" title="User-provided tone"><p>{headlineProvided ? `The headline signal is ${brief.sentimentSignal}. Tone is not proof of price movement or company performance.` : 'No headline was supplied, so this brief does not infer a sentiment signal.'}</p></InsightCard><InsightCard icon={<ShieldAlert size={16} />} eyebrow="03 / RISK & LEARNING COACH" title="What this establishes"><p>These connected signals illustrate an analytical concept, not a reliable forecast. Examine the risks and next observations below.</p></InsightCard></div><div className="brief-details"><section className="panel"><p className="card-label">LIMITATIONS TO REMEMBER</p><ul>{brief.riskFactors.map((risk) => <li key={risk}>{risk}</li>)}</ul></section><section className="panel"><p className="card-label">NEXT THINGS TO OBSERVE</p><ul>{brief.nextThingsToObserve.map((item) => <li key={item}>{item}</li>)}</ul></section></div></section>
}

function AnalysisEmpty({ onAnalyze }: { onAnalyze: () => void }) {
  return <section className="analysis-empty"><div className="empty-orbit"><BrainCircuit size={29} /></div><div><p className="terminal-kicker">READY FOR REVIEW</p><h2>Turn sample data into a clearer point of view.</h2><p>Select a supported stock above. Gemini will explain only the supplied simulated price and change, then call out what is still unknown.</p></div><Button variant="outline" onClick={onAnalyze}><Sparkles size={15} /> Run first analysis</Button></section>
}

function AnalysisLoading({ stage }: { stage: number }) {
  return <section className="analysis-loading" role="status"><div className="loading-topline"><div><LoaderCircle className="loading-spinner" size={17} /><strong>Gemini is composing an explanation</strong></div><span>UI progress indicator</span></div><div className="loading-stage"><span className="stage-number">0{stage + 1}</span><span>{analysisStages[stage]}</span><div className="stage-track"><i style={{ width: `${((stage + 1) / analysisStages.length) * 100}%` }} /></div></div><div className="analysis-skeleton"><i /><i /><i /><i /></div></section>
}

function AnalysisDashboard({ selected, result }: { selected: typeof marketItems[number]; result: AnalysisResult }) {
  const VerdictIcon = result.verdict === 'BULLISH' ? TrendingUp : result.verdict === 'BEARISH' ? TrendingDown : Activity
  return <div className="analysis-dashboard"><section className={`verdict-card verdict-${result.verdict.toLowerCase()}`}><div className="verdict-icon"><VerdictIcon size={24} /></div><div className="verdict-copy"><div className="verdict-label">GEMINI VERDICT <span>Based on supplied sample data</span></div><h2>{result.verdict}</h2><p>{result.reason}</p></div><div className="verdict-aside"><div className="confidence-chip"><Gauge size={14} /><span>Confidence</span><strong>{result.confidence}</strong></div><div className="risk-chip"><ShieldAlert size={14} /><span>Risk</span><strong>CAUTION</strong></div></div></section><div className="analysis-grid compact-analysis-grid"><InsightCard className="reason-card" icon={<BrainCircuit size={16} />} eyebrow="01 / REASON" title="Why this view"><p>{result.reason}</p></InsightCard><InsightCard className="price-card" icon={<Activity size={16} />} eyebrow="02 / PRICE SUMMARY" title="The supplied snapshot"><div className="price-readout"><div><span>Current sample price</span><strong>{formatCurrency(selected.price)}</strong></div><div><span>Reported change</span><strong className={selected.positive ? 'quote-up' : 'quote-down'}>{selected.change}</strong></div></div><p className="fact-label"><CheckCircle2 size={13} /> Supplied data</p><p>{result.priceSummary}</p></InsightCard><InsightCard className="risk-card" icon={<ShieldAlert size={16} />} eyebrow="03 / RISK" title="Keep in mind"><p>{result.risk}</p></InsightCard><InsightCard className="watch-card" icon={<TargetIcon />} eyebrow="04 / WHAT TO WATCH" title="Useful next signals"><ul>{result.watchFor.map((item) => <li key={item}>{item}</li>)}</ul></InsightCard></div><div className="analysis-caution"><AlertTriangle size={15} /><span>Educational explanation based on simulated data, not live market data or investment advice.</span></div></div>
}

function InsightCard({ icon, eyebrow, title, className = '', children }: { icon: React.ReactNode; eyebrow: string; title: string; className?: string; children: React.ReactNode }) { return <article className={`insight-card ${className}`}><div className="insight-heading"><span className="insight-icon">{icon}</span><div><p>{eyebrow}</p><h3>{title}</h3></div></div><div className="insight-body">{children}</div></article> }

function parseAnalysisResult(text: string): AnalysisResult | null { try { const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''); const parsed = JSON.parse(normalized) as Partial<AnalysisResult>; if ((parsed.verdict !== 'BULLISH' && parsed.verdict !== 'NEUTRAL' && parsed.verdict !== 'BEARISH') || (parsed.confidence !== 'LOW' && parsed.confidence !== 'MEDIUM' && parsed.confidence !== 'HIGH') || typeof parsed.reason !== 'string' || typeof parsed.priceSummary !== 'string' || typeof parsed.risk !== 'string' || !Array.isArray(parsed.watchFor) || parsed.watchFor.length < 1 || parsed.watchFor.length > 2 || parsed.watchFor.some((item) => typeof item !== 'string')) return null; return { verdict: parsed.verdict, confidence: parsed.confidence, reason: parsed.reason, priceSummary: parsed.priceSummary, risk: parsed.risk, watchFor: parsed.watchFor as string[] } } catch { return null } }
function TargetIcon() { return <span className="target-icon" aria-hidden="true">◎</span> }

function PortfolioPage({ stocks, prices, portfolio, portfolioValue, profitLoss, notice, onTrade, onReset }: { stocks: SimulatedStock[]; prices: Record<string, number>; portfolio: PortfolioState; portfolioValue: number; profitLoss: number; notice: { type: 'success' | 'error'; text: string } | null; onTrade: (symbol: string, action: Transaction['action'], quantity: number) => boolean; onReset: () => void }) {
  const [symbol, setSymbol] = useState(marketItems[0].symbol)
  const [action, setAction] = useState<Transaction['action']>('BUY')
  const [quantity, setQuantity] = useState('')
  const selected = stocks.find((item) => item.symbol === symbol) ?? stocks[0]
  useEffect(() => { const selectStock = (event: Event) => setSymbol((event as CustomEvent<string>).detail); window.addEventListener('stocksense:select-stock', selectStock); return () => window.removeEventListener('stocksense:select-stock', selectStock) }, [])
  const submitTrade = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const didTrade = onTrade(symbol, action, Number(quantity)); if (didTrade) setQuantity('') }
  const rows = holdingRows(portfolio, prices)
  return <section><div className="page-intro"><div><p className="eyebrow">PRACTICE ACCOUNT</p><h1>Virtual portfolio</h1><p className="intro-copy">Buy and sell using ₹1,00,000 of virtual cash.</p></div><button className="reset-button" type="button" onClick={onReset}>Reset portfolio</button></div>{notice && <div className={`trade-notice ${notice.type}`} role="status">{notice.text}</div>}<div className="portfolio-stats"><Stat label="Available cash" value={formatCurrency(portfolio.cash)} /><Stat label="Portfolio value" value={formatCurrency(portfolioValue)} /><Stat label="Unrealized P/L" value={formatCurrency(profitLoss, true)} positive={profitLoss >= 0} /></div><div className="trading-grid"><section className="panel trade-panel"><div className="panel-heading"><div><p className="card-label">TRADE DESK</p><h2>Place simulated order</h2></div><span className="sample-tag">Current simulated price</span></div><form onSubmit={submitTrade}><label htmlFor="stock">Stock<select id="stock" value={symbol} onChange={(event) => setSymbol(event.target.value)}>{stocks.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} - {formatCurrency(item.price)}</option>)}</select></label><div className="order-toggle" role="group" aria-label="Order action"><button type="button" className={action === 'BUY' ? 'selected' : ''} onClick={() => setAction('BUY')}>Buy</button><button type="button" className={action === 'SELL' ? 'selected sell' : ''} onClick={() => setAction('SELL')}>Sell</button></div><label htmlFor="quantity">Quantity<input id="quantity" type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Enter whole shares" /></label><div className="order-total"><span>Execution price</span><strong>{formatCurrency(selected.price)} <small>per share</small></strong><span>Estimated total</span><strong>{formatCurrency(selected.price * (Number(quantity) || 0))}</strong></div><button className="submit-trade" type="submit">{action === 'BUY' ? 'Buy shares' : 'Sell shares'} <span>→</span></button></form></section><HoldingsPanel rows={rows} /></div><TransactionHistory transactions={portfolio.transactions} /></section>
}

function Stat({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) { return <article className="portfolio-stat"><p className="card-label">{label}</p><strong className={positive ? 'positive' : ''}>{value}</strong></article> }
function HoldingsPanel({ rows }: { rows: ReturnType<typeof holdingRows> }) { return <section className="panel holdings-panel"><div className="panel-heading"><div><p className="card-label">YOUR HOLDINGS</p><h2>Open positions</h2></div></div>{rows.length === 0 ? <p className="empty-state">No holdings yet. Use the trade desk to buy your first simulated shares.</p> : <div className="holdings-list">{rows.map((row) => <div className="holding-row" key={row.symbol}><div><strong>{row.symbol}</strong><span>{row.quantity} shares at {formatCurrency(row.averagePrice)}</span></div><div><strong>{formatCurrency(row.currentValue)}</strong><span className={row.profitLoss >= 0 ? 'positive' : 'negative'}>{formatCurrency(row.profitLoss, true)}</span></div></div>)}</div>}</section> }
function TransactionHistory({ transactions }: { transactions: Transaction[] }) { return <section className="panel history-panel"><div className="panel-heading"><div><p className="card-label">ACTIVITY</p><h2>Transaction history</h2></div><span className="sample-tag">{transactions.length} trade{transactions.length === 1 ? '' : 's'}</span></div>{transactions.length === 0 ? <p className="empty-state">Your completed simulated trades will appear here.</p> : <div className="history-table"><div className="history-header"><span>Stock</span><span>Action</span><span>Qty</span><span>Price</span><span>Total</span><span>Time</span></div>{transactions.map((transaction) => <div className="history-row" key={transaction.id}><strong>{transaction.symbol}</strong><span className={transaction.action === 'BUY' ? 'buy-label' : 'sell-label'}>{transaction.action}</span><span>{transaction.quantity}</span><span>{formatCurrency(transaction.price)}</span><span>{formatCurrency(transaction.total)}</span><span>{new Date(transaction.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span></div>)}</div>}</section> }

type QuizQuestion = { question: string; options: string[]; answer: number }
type Lesson = { id: number; title: string; description: string; time: string; icon: string; content: string[]; quiz: QuizQuestion[] }

const LEARNING_STORAGE_KEY = 'stocksense-learning-progress'
const lessons: Lesson[] = [
  { id: 1, title: 'Stock Market Basics', description: 'Understand what shares are and why prices move.', time: '5 min read', icon: '01', content: ['A stock, or share, represents a small ownership stake in a company. Owning a share gives you an economic interest in that business.', 'Companies issue shares to raise money for growth, operations, or new projects. Investors buy shares because they believe the business may create value over time.', 'Prices change as buyers and sellers react to new information, expectations, company performance, and overall demand. A price can move up or down, and no movement is guaranteed.'], quiz: [{ question: 'What does one share usually represent?', options: ['A small ownership stake in a company', 'A guaranteed profit', 'A bank loan'], answer: 0 }, { question: 'Why might a company issue shares?', options: ['To guarantee its stock price', 'To raise money for its business', 'To avoid reporting results'], answer: 1 }, { question: 'What can change a stock price?', options: ['Only the company logo', 'Buyer and seller demand and new information', 'A fixed rule that never changes'], answer: 1 }] },
  { id: 2, title: 'Risk and Return', description: 'Learn why possible returns come with uncertainty.', time: '6 min read', icon: '02', content: ['Risk is the possibility that an investment outcome will be different from what you expected. Potential return is the gain an investor hopes to earn.', 'Higher possible returns often come with higher uncertainty. This relationship is not a promise: a risky investment can still lose money.', 'Diversification means spreading money across different investments instead of relying on one. Past performance is useful context, but it never guarantees future results.'], quiz: [{ question: 'What does diversification try to do?', options: ['Spread exposure across different investments', 'Guarantee a positive return', 'Make every investment identical'], answer: 0 }, { question: 'What is the relationship between risk and possible return?', options: ['Risk removes all uncertainty', 'More possible return can come with more uncertainty', 'They are always exactly equal'], answer: 1 }, { question: 'Does past performance guarantee future results?', options: ['Yes, always', 'Only for large companies', 'No'], answer: 2 }] },
  { id: 3, title: 'Fundamental Analysis', description: 'Read the basic signals behind a company.', time: '7 min read', icon: '03', content: ['Fundamental analysis looks at information about a business. Revenue is money earned from sales, while profit is what remains after expenses.', 'Debt shows money the company owes and must manage. Earnings reports can help investors understand how the business performed during a period.', 'These figures matter because they add context beyond a share price. No single metric guarantees investment success, so fundamentals should be considered together with other information.'], quiz: [{ question: 'What is revenue?', options: ['Money earned from sales', 'The company share price', 'Money paid to shareholders only'], answer: 0 }, { question: 'Why can debt matter?', options: ['It shows money the company must manage and repay', 'It guarantees growth', 'It is always a profit'], answer: 0 }, { question: 'Can one metric guarantee investment success?', options: ['Yes', 'No', 'Only revenue can'], answer: 1 }] },
  { id: 4, title: 'Understanding Sentiment', description: 'Separate the tone of financial news from facts.', time: '5 min read', icon: '04', content: ['Positive sentiment can appear in language about growth, strong results, or optimism. Negative sentiment can appear in language about falling demand, losses, or concern. Neutral sentiment may describe information without a clear emotional direction.', 'Sentiment is about the tone expressed in text. It is not the same as a verified fact, and it cannot tell you what a stock price will do next.', 'Use the Sentiment Analyzer to practice identifying tone in a headline. Treat its output as an educational starting point and read the full source and facts yourself.'], quiz: [{ question: 'What does sentiment describe?', options: ['The tone expressed in text', 'A guaranteed price movement', 'A company balance sheet'], answer: 0 }, { question: 'Can positive news guarantee a rising stock price?', options: ['Yes', 'No', 'Only in a simulator'], answer: 1 }, { question: 'What can the Sentiment Analyzer help you practice?', options: ['Identifying tone in a supplied headline', 'Predicting tomorrow’s price', 'Finding live news sources'], answer: 0 }] },
  { id: 5, title: 'Virtual Trading', description: 'Practice buying, selling, and tracking a portfolio.', time: '6 min read', icon: '05', content: ['The simulator gives you virtual cash to practice placing buy and sell orders. A holding is a stock and quantity that you currently own in the simulator.', 'Your portfolio shows available cash, holding value, and profit or loss. Profit and loss can change when the simulated price changes, even before you sell.', 'StockSense uses fixed sample prices, not live market prices. Experiment with small decisions, review your history, and use the simulator to learn without putting real money at risk.'], quiz: [{ question: 'What is a holding?', options: ['A stock and quantity you own in the simulator', 'A guaranteed return', 'A live broker account'], answer: 0 }, { question: 'What can virtual profit or loss show?', options: ['How a simulated holding compares with its purchase price', 'A guaranteed future result', 'A live market prediction'], answer: 0 }, { question: 'What prices does StockSense use?', options: ['Live exchange prices', 'Fixed sample prices for learning', 'Prices chosen by a broker'], answer: 1 }] },
]

function LearnPage() {
  const [completed, setCompleted] = useState<number[]>(() => { try { const saved = JSON.parse(localStorage.getItem(LEARNING_STORAGE_KEY) || '[]'); return Array.isArray(saved) ? saved.filter((id): id is number => Number.isInteger(id) && lessons.some((lesson) => lesson.id === id)) : [] } catch { return [] } })
  const [openLesson, setOpenLesson] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  useEffect(() => { localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(completed)) }, [completed])
  const activeLesson = lessons.find((lesson) => lesson.id === openLesson)
  const open = (lesson: Lesson) => { setOpenLesson(lesson.id); setAnswers({}); setSubmitted(false); setScore(null) }
  const submitQuiz = () => { if (!activeLesson || activeLesson.quiz.some((_question, index) => answers[index] === undefined)) return; const nextScore = activeLesson.quiz.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0); setScore(nextScore); setSubmitted(true); if (nextScore >= 2) setCompleted((current) => [...new Set([...current, activeLesson.id])]) }
  const progress = Math.round((completed.length / lessons.length) * 100)
  return <section className="learn-page"><div className="page-intro learn-intro"><div><p className="eyebrow">PRACTICE YOUR KNOWLEDGE</p><h1>Financial Learning Hub</h1><p className="intro-copy">Learn investing basics, then put them into practice with the virtual trading simulator.</p></div><div className="learn-progress-ring"><strong>{progress}%</strong><span>complete</span></div></div><section className="learn-summary"><div className="learn-summary-icon"><GraduationCap size={22} /></div><div><p className="card-label">YOUR PROGRESS</p><strong>{completed.length} of {lessons.length} lessons complete</strong><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div><div className="learn-summary-action">{completed.length === lessons.length ? 'Learning path complete' : completed.length > 0 ? 'Keep building your foundation' : 'Start with the basics'}</div></section><div className="lesson-grid">{lessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} completed={completed.includes(lesson.id)} onOpen={() => open(lesson)} />)}</div>{activeLesson && <LessonDetail lesson={activeLesson} completed={completed.includes(activeLesson.id)} answers={answers} submitted={submitted} score={score} onAnswer={(question, answer) => setAnswers((current) => ({ ...current, [question]: answer }))} onSubmit={submitQuiz} onClose={() => setOpenLesson(null)} onRetry={() => { setAnswers({}); setSubmitted(false); setScore(null) }} />}</section>
}

function LessonCard({ lesson, completed, onOpen }: { lesson: Lesson; completed: boolean; onOpen: () => void }) { return <article className={`lesson-card ${completed ? 'lesson-complete' : ''}`}><div className="lesson-card-top"><span className="lesson-number">{lesson.icon}</span>{completed ? <span className="completion-badge"><CheckCircle2 size={13} /> Complete</span> : <span className="lesson-status">Not started</span>}</div><h2>{lesson.title}</h2><p>{lesson.description}</p><div className="lesson-card-footer"><span><Clock3 size={13} /> {lesson.time}</span><button type="button" onClick={onOpen}>{completed ? 'Review lesson' : 'Start lesson'} <ArrowRight size={14} /></button></div></article> }

function LessonDetail({ lesson, completed, answers, submitted, score, onAnswer, onSubmit, onClose, onRetry }: { lesson: Lesson; completed: boolean; answers: Record<number, number>; submitted: boolean; score: number | null; onAnswer: (question: number, answer: number) => void; onSubmit: () => void; onClose: () => void; onRetry: () => void }) { return <section className="lesson-detail" aria-labelledby="lesson-detail-title"><div className="lesson-detail-header"><div><p className="eyebrow">LESSON {lesson.icon}</p><h2 id="lesson-detail-title">{lesson.title}</h2><p>{lesson.description}</p></div><button className="lesson-close" type="button" onClick={onClose} aria-label="Close lesson">×</button></div><div className="lesson-copy">{lesson.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><div className="quiz-block"><div className="quiz-heading"><div><p className="card-label">QUICK CHECK</p><h3>Test your understanding</h3></div>{completed && <span className="completion-badge"><CheckCircle2 size={13} /> Passed</span>}</div>{lesson.quiz.map((question, questionIndex) => <fieldset className="quiz-question" key={question.question}><legend>{questionIndex + 1}. {question.question}</legend><div className="quiz-options">{question.options.map((option, optionIndex) => <label className={submitted ? optionIndex === question.answer ? 'answer-correct' : answers[questionIndex] === optionIndex ? 'answer-wrong' : '' : ''} key={option}><input type="radio" name={`question-${lesson.id}-${questionIndex}`} checked={answers[questionIndex] === optionIndex} onChange={() => onAnswer(questionIndex, optionIndex)} disabled={submitted} /> <span>{option}</span></label>)}</div></fieldset>)}{!submitted ? <Button className="quiz-submit" onClick={onSubmit} disabled={Object.keys(answers).length !== lesson.quiz.length}>Submit quiz</Button> : <div className={`quiz-feedback ${score !== null && score >= 2 ? 'passed' : 'retry'}`} role="status"><strong>{score} / {lesson.quiz.length}</strong><span>{score !== null && score >= 2 ? 'Nice work. Lesson marked complete.' : 'You need at least 2 correct answers to complete this lesson.'}</span><button type="button" onClick={onRetry}><RotateCcw size={13} /> Retry quiz</button></div>}</div></section> }

function SummaryCard({ label, value, detail, positive = false }: { label: string; value: string; detail: string; positive?: boolean }) { return <article className="summary-card"><p className="card-label">{label}</p><strong className="summary-value">{value}</strong><p className={positive ? 'positive summary-detail' : 'summary-detail'}>{positive && '↗ '}{detail}</p></article> }
function PlaceholderPage({ page, onLearn }: { page: Page; onLearn: () => void }) { const copy: Record<Page, { title: string; description: string }> = { Dashboard: { title: 'Your dashboard', description: 'Your portfolio overview will appear here.' }, 'Market Watch': { title: 'Market watch', description: 'Track sample stock movements and build your watchlist.' }, 'Virtual Portfolio': { title: 'Virtual portfolio', description: 'Review your simulated holdings, allocation, and trade history.' }, 'AI Analysis': { title: 'AI analysis', description: 'Analysis tools will be available here in a future version.' }, 'Market Intelligence': { title: 'Market intelligence', description: 'Connect simulated price patterns with an educational Gemini brief.' }, 'Sentiment Analyzer': { title: 'Sentiment analyzer', description: 'Explore market sentiment learning exercises here.' }, Learn: { title: 'Learning hub', description: 'Build your investing knowledge with guided lessons and practice.' } }; return <section className="placeholder-page"><div className="placeholder-icon">{navIcons[page]}</div><p className="eyebrow">STOCKSENSE AI</p><h1>{copy[page].title}</h1><p>{copy[page].description}</p><button className="dark-button" type="button" onClick={onLearn}>Return to dashboard <span>→</span></button></section> }

export default App
